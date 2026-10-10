import {
  SafeMultiChainSigAccountV1 as SafeAccount,
  SocialRecoveryModuleGracePeriodSelector,
} from 'abstractionkit'
import {
  decodeFunctionData,
  getAddress,
  hexToBigInt,
  isAddress,
  parseAbi,
  sliceHex,
  toFunctionSelector,
  type Address,
  type Hex,
} from 'viem'

import { ALLOWANCE_MODULE_ADDRESS, SAFE_PROXY_FACTORY_141 } from '@/lib/config'

import { isSanctioned } from './compliance'
import { getWalletByAccount, getWalletByKeySafe } from './registry'
import { store } from './store'

/**
 * Swissquote sponsorship policy (PDR-003, PDR-015, PDR-017, PDR-019, issue #23).
 * Friction, never a veto: a refused operation can still be sent with the user's own gas.
 *
 * - Level 0 (not linked): SPONSORED_OPS_PER_MONTH sponsored operations a month.
 * - Level 1 (linked client, registry): unlimited.
 * - Security operations (setup, recovery and eviction, owners, modules, allowance settings)
 *   are always sponsored, outside the quota.
 * - Never sponsored: transfers to a sanctioned address (PDR-023), and anything sent by a
 *   Key Safe reported stolen (PDR-017).
 */

export const SPONSORED_OPS_PER_MONTH = Number(process.env.SPONSORED_OPS_PER_MONTH ?? 10)

const RECOVERY_MODULES = Object.values(SocialRecoveryModuleGracePeriodSelector).map((a) => String(a).toLowerCase())
const SETUP_CONTRACTS = [
  SafeAccount.DEFAULT_WEB_AUTHN_SIGNER_FACTORY, // passkey verifier proxies
  SAFE_PROXY_FACTORY_141, // Account deployment (ADR-017)
].map((a) => a.toLowerCase())

const SAFE_ADMIN_SELECTORS = [
  'function addOwnerWithThreshold(address,uint256)',
  'function removeOwner(address,address,uint256)',
  'function swapOwner(address,address,address)',
  'function changeThreshold(uint256)',
  'function enableModule(address)',
  'function disableModule(address,address)',
  'function setGuard(address)',
  'function setFallbackHandler(address)',
].map((signature) => toFunctionSelector(signature) as string)

const executorAbi = parseAbi([
  'function executeUserOpWithErrorString(address to, uint256 value, bytes data, uint8 operation)',
  'function executeUserOp(address to, uint256 value, bytes data, uint8 operation)',
])
const innerAbi = parseAbi([
  'function multiSend(bytes transactions)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)',
  'function transfer(address to, uint256 amount)',
  'function approve(address spender, uint256 amount)',
  'function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)',
])

type Call = { self: Address; to: Address; value: bigint; data: Hex }
type Classified = { security: boolean; counterparties: Address[] }

/** MultiSend packed encoding: operation (1) · to (20) · value (32) · data length (32) · data. */
function unpackMultiSend(self: Address, packed: Hex): Call[] {
  const calls: Call[] = []
  let offset = 0
  const size = (packed.length - 2) / 2
  while (offset < size) {
    const to = getAddress(sliceHex(packed, offset + 1, offset + 21))
    const value = hexToBigInt(sliceHex(packed, offset + 21, offset + 53))
    const length = Number(hexToBigInt(sliceHex(packed, offset + 53, offset + 85)))
    const data = length ? sliceHex(packed, offset + 85, offset + 85 + length) : '0x'
    calls.push({ self, to, value, data })
    offset += 85 + length
  }
  return calls
}

function classify(call: Call, depth = 0): Classified {
  if (depth > 4) return { security: false, counterparties: [call.to] }
  const to = call.to.toLowerCase()
  const selector = call.data.length >= 10 ? call.data.slice(0, 10) : '0x'
  const merge = (parts: Classified[]): Classified => ({
    security: parts.length > 0 && parts.every((p) => p.security),
    counterparties: parts.flatMap((p) => p.counterparties),
  })

  if (RECOVERY_MODULES.includes(to) || SETUP_CONTRACTS.includes(to)) return { security: true, counterparties: [] }
  if (to === call.self.toLowerCase() && SAFE_ADMIN_SELECTORS.includes(selector)) {
    return { security: true, counterparties: [] }
  }

  try {
    const { functionName, args } = decodeFunctionData({ abi: innerAbi, data: call.data })
    switch (functionName) {
      case 'multiSend':
        return merge(unpackMultiSend(call.self, args[0]).map((c) => classify(c, depth + 1)))
      case 'execTransaction': // a 2-factor Account transaction (ADR-017): look inside, from the Account
        return classify({ self: call.to, to: args[0], value: args[1], data: args[2] }, depth + 1)
      case 'executeAllowanceTransfer':
        return { security: false, counterparties: [args[2]] }
      case 'transfer':
        return { security: false, counterparties: [args[0]] }
      case 'approve':
        return { security: false, counterparties: [args[0], call.to] }
    }
  } catch {
    // Not one of the calls above: a generic contract call.
  }
  if (to === ALLOWANCE_MODULE_ADDRESS.toLowerCase()) return { security: true, counterparties: [] } // limit settings
  return { security: false, counterparties: [call.to] }
}

export type RpcUserOperation = { sender?: string; factory?: string | null; initCode?: string; callData?: string }

/** Decodes the Safe 4337 executor call and classifies every inner call. */
export function classifyUserOperation(userOp: RpcUserOperation): Classified {
  const sender = getAddress(userOp.sender as string)
  const deploys = Boolean(userOp.factory) || (userOp.initCode && userOp.initCode !== '0x')
  const { args } = decodeFunctionData({ abi: executorAbi, data: (userOp.callData ?? '0x') as Hex })
  const [to, value, data] = args
  const inner = classify({ self: sender, to, value, data })
  return deploys && inner.counterparties.length === 0 ? { security: true, counterparties: [] } : inner
}

export type Decision =
  | { sponsored: true; kind: 'security' | 'quota' | 'linked'; used?: number }
  | { sponsored: false; reason: 'reported-stolen' | 'sanctioned' | 'quota' | 'invalid'; message: string }

const monthKey = (sender: string) => `sponsor:${sender.toLowerCase()}:${new Date().toISOString().slice(0, 7)}`

/**
 * `final` = pm_getPaymasterData (the operation is about to be signed): the quota is consumed
 * there. pm_getPaymasterStubData only checks it.
 */
export async function decide(userOp: RpcUserOperation, final: boolean): Promise<Decision> {
  if (!userOp?.sender || !isAddress(userOp.sender)) {
    return { sponsored: false, reason: 'invalid', message: 'Missing sender' }
  }
  const sender = getAddress(userOp.sender)

  if (await store().get('stolenKeySafes', sender.toLowerCase())) {
    return {
      sponsored: false,
      reason: 'reported-stolen',
      message: 'This device was reported stolen. Swissquote no longer sponsors its operations.',
    }
  }

  let classified: Classified
  try {
    classified = classifyUserOperation(userOp)
  } catch {
    return { sponsored: false, reason: 'invalid', message: 'Unrecognised operation format' }
  }

  for (const counterparty of classified.counterparties) {
    if (await isSanctioned(counterparty)) {
      return {
        sponsored: false,
        reason: 'sanctioned',
        message: `Swissquote does not facilitate transfers to ${counterparty}: the address is on a sanctions list.`,
      }
    }
  }

  if (classified.security) return { sponsored: true, kind: 'security' }

  const linked = (await getWalletByKeySafe(sender)) ?? (await getWalletByAccount(sender))
  if (linked) return { sponsored: true, kind: 'linked' }

  const key = monthKey(sender)
  const used = final ? await store().increment(key, 40 * 24 * 60 * 60) : (await store().count(key)) + 1
  if (used > SPONSORED_OPS_PER_MONTH) {
    return {
      sponsored: false,
      reason: 'quota',
      message: `Monthly sponsored quota reached (${SPONSORED_OPS_PER_MONTH}). Link your Swissquote account for unlimited sponsored network fees.`,
    }
  }
  return { sponsored: true, kind: 'quota', used }
}
