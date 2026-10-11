import {
  AllowanceModule,
  EXECUTE_RECOVERY_PRIMARY_TYPE,
  SocialRecoveryModule,
  SocialRecoveryModuleGracePeriodSelector,
  type MetaTransaction,
  type RecoverySignaturePair,
} from 'abstractionkit'
import {
  concat,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  getContractAddress,
  hashTypedData,
  keccak256,
  pad,
  parseAbi,
  size,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
  type LocalAccount,
} from 'viem'

import {
  ACCOUNT_RECOVERY_MODULE,
  ALLOWANCE_MODULE_ADDRESS,
  ALLOWANCE_RESET_MINUTES,
  CHAIN_ID,
  MULTISEND_CALL_ONLY_141,
  NODE_URL,
  SAFE_FALLBACK_HANDLER_141,
  SAFE_L2_141_PROXY_INIT_HASH,
  SAFE_L2_141_SINGLETON,
  SAFE_MODULE_SETUP,
  SAFE_PROXY_FACTORY_141,
  USDC_ADDRESS,
  type Level,
} from './config'
import { isDeployed, publicClient } from './wallet'

/**
 * Account Safe (ADR-017, ADR-019): the address that holds all funds.
 *
 *   owners: Key Safe (passkey) + Kit owner key (+ hardware key), threshold 2
 *   modules: Allowance Module (Key Safe = delegate, daily limit) + recovery module (eviction)
 *
 * Face ID alone spends up to the daily limit (allowance transfer sent by the Key
 * Safe). Everything else is an `execTransaction` signed by 2 of the user's factors.
 * Helpers proven on Base Sepolia by scripts/spike-two-safe.mts.
 */

const safeAbi = parseAbi([
  'function setup(address[] _owners, uint256 _threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool)',
  'function nonce() view returns (uint256)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
  'function getModulesPaginated(address start, uint256 pageSize) view returns (address[] array, address next)',
  'function enableModule(address module)',
  'function disableModule(address prevModule, address module)',
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
  'function swapOwner(address prevOwner, address oldOwner, address newOwner)',
])
const proxyFactoryAbi = parseAbi([
  'function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
])
const moduleSetupAbi = parseAbi(['function enableModules(address[] modules)'])
const multiSendAbi = parseAbi(['function multiSend(bytes transactions) payable'])

const SENTINEL_OWNERS = '0x0000000000000000000000000000000000000001' as const
const RECOVERY_MODULES = Object.values(SocialRecoveryModuleGracePeriodSelector).map((a) => a.toLowerCase())

const allowanceModule = new AllowanceModule(ALLOWANCE_MODULE_ADDRESS)

/**
 * The allowance's reset base, in minutes: the last 00:00 UTC. With base 0 the module would count
 * 24 h from the setup minute instead; with this base the daily limit refills at 00:00 UTC.
 */
const lastUtcMidnightMin = () => BigInt(Math.floor(Date.now() / 86_400_000) * 1440)
const evictionModule = (module: Address) => new SocialRecoveryModule(module)

// ── Types ───────────────────────────────────────────────────────────────────

/** A call the Account executes through `execTransaction`. Operation 1 (delegatecall) is only used for batches. */
export type AccountCall = { to: Address; data: Hex; value?: bigint; operation?: 0 | 1 }

/** One owner's approval of an Account transaction. */
export type AccountSignature =
  | { kind: 'ecdsa'; signer: Address; data: Hex } // EOA owner (the Kit): v = 27/28
  | { kind: 'sender'; signer: Address } // owner that is msg.sender (the Key Safe in its own UserOp): v = 1
  | { kind: 'contract'; signer: Address; data: Hex } // EIP-1271 owner (security key verifier proxy): v = 0

/** The Kit's owner key, or any ECDSA key that co-signs Account transactions. */
export type KitSigner = Pick<LocalAccount, 'address' | 'signTypedData'>

export type AccountState = {
  deployed: boolean
  nonce: bigint
  owners: Address[]
  threshold: number
  modules: Address[]
  /** Recovery module used for evictions (ADR-019), if enabled. */
  evictionModule: Address | null
  guardians: Address[]
  guardianThreshold: number
  /** Daily allowance of the Key Safe (delegate). Values already account for the daily reset. */
  allowance: { delegate: Address; amount: bigint; spent: bigint; remaining: bigint; resetsAt: number | null } | null
  pendingEviction: { newOwners: Address[]; newThreshold: number; executeAfter: number; approvals: number } | null
}

const asCall = (m: MetaTransaction): AccountCall => ({
  to: m.to as Address,
  data: m.data as Hex,
  value: BigInt(m.value ?? 0),
})

// ── Address and setup ───────────────────────────────────────────────────────

/** Safe setup: owners [Key Safe, Kit], threshold 2, Allowance Module enabled. Independent of the level. */
function accountInitializer(keySafe: Address, kitOwner: Address): Hex {
  return encodeFunctionData({
    abi: safeAbi,
    functionName: 'setup',
    args: [
      [keySafe, kitOwner],
      2n,
      SAFE_MODULE_SETUP,
      encodeFunctionData({ abi: moduleSetupAbi, functionName: 'enableModules', args: [[ALLOWANCE_MODULE_ADDRESS]] }),
      SAFE_FALLBACK_HANDLER_141,
      zeroAddress,
      0n,
      zeroAddress,
    ],
  })
}

/** Deterministic Account address (CREATE2 through the Safe v1.4.1 proxy factory). */
export function predictAccountAddress({
  keySafe,
  kitOwner,
  saltNonce = 0n,
}: {
  keySafe: Address
  kitOwner: Address
  saltNonce?: bigint
}): Address {
  const salt = keccak256(encodePacked(['bytes32', 'uint256'], [keccak256(accountInitializer(keySafe, kitOwner)), saltNonce]))
  return getContractAddress({ opcode: 'CREATE2', from: SAFE_PROXY_FACTORY_141, salt, bytecodeHash: SAFE_L2_141_PROXY_INIT_HASH })
}

/**
 * Calls for ONE Key Safe UserOp (send them with `sendCalls`): deploy the Account, then one
 * `execTransaction` (Kit ECDSA + Key Safe v = 1) that enables the eviction module, makes
 * the Key Safe a delegate with the user's daily limit and registers the guardians.
 */
export async function accountSetupCalls(
  params: {
    keySafe: Address
    kitOwner: Address
    kitGuardian: Address
    dailyLimit: bigint
    level: Level
    swissquoteGuardian?: Address
    saltNonce?: bigint
    token?: Address
  },
  kitSigner: KitSigner,
): Promise<MetaTransaction[]> {
  const { keySafe, kitOwner, kitGuardian, dailyLimit, level, swissquoteGuardian, saltNonce = 0n, token = USDC_ADDRESS } = params
  if (kitSigner.address.toLowerCase() !== kitOwner.toLowerCase()) throw new Error('kitSigner does not match kitOwner')
  if (level === 1 && !swissquoteGuardian) throw new Error('Level 1 needs the Swissquote guardian address')
  if (dailyLimit <= 0n || dailyLimit >= 2n ** 96n) throw new Error('Invalid daily limit')

  const account = predictAccountAddress({ keySafe, kitOwner, saltNonce })
  const recovery = evictionModule(ACCOUNT_RECOVERY_MODULE[level])
  const configure = batchCalls([
    { to: account, data: encodeFunctionData({ abi: safeAbi, functionName: 'enableModule', args: [ACCOUNT_RECOVERY_MODULE[level]] }) },
    asCall(allowanceModule.createAddDelegateMetaTransaction(keySafe)),
    asCall(allowanceModule.createBaseSetAllowanceMetaTransaction(keySafe, token, dailyLimit, ALLOWANCE_RESET_MINUTES, lastUtcMidnightMin())),
    asCall(recovery.createAddGuardianWithThresholdMetaTransaction(kitGuardian, 1n)),
    ...(level === 1 && swissquoteGuardian ? [asCall(recovery.createAddGuardianWithThresholdMetaTransaction(swissquoteGuardian, 2n))] : []),
  ])
  const signatures = encodeSafeSignatures([await kitSignature(kitSigner, account, configure, 0n), senderSignature(keySafe)])
  return [
    {
      to: SAFE_PROXY_FACTORY_141,
      value: 0n,
      data: encodeFunctionData({
        abi: proxyFactoryAbi,
        functionName: 'createProxyWithNonce',
        args: [SAFE_L2_141_SINGLETON, accountInitializer(keySafe, kitOwner), saltNonce],
      }),
    },
    accountExecCall(account, configure, signatures),
  ]
}

// ── Reads ───────────────────────────────────────────────────────────────────

export const accountNonce = (account: Address) =>
  publicClient.readContract({ address: account, abi: safeAbi, functionName: 'nonce' })

/**
 * Full Account state. The public RPC is load-balanced: right after a transaction some nodes have not
 * seen the block yet and module reads fail, so a failed read is retried a few times.
 */
export async function readAccount(
  account: Address,
  options: { keySafe?: Address; token?: Address } = {},
): Promise<AccountState> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await readAccountOnce(account, options)
    } catch (error) {
      if (attempt >= 4) throw error
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt))
    }
  }
}

async function readAccountOnce(
  account: Address,
  options: { keySafe?: Address; token?: Address },
): Promise<AccountState> {
  if (!(await isDeployed(account))) {
    return {
      deployed: false, nonce: 0n, owners: [], threshold: 0, modules: [], evictionModule: null,
      guardians: [], guardianThreshold: 0, allowance: null, pendingEviction: null,
    }
  }
  const [nonce, owners, threshold, [modules]] = await Promise.all([
    accountNonce(account),
    publicClient.readContract({ address: account, abi: safeAbi, functionName: 'getOwners' }),
    publicClient.readContract({ address: account, abi: safeAbi, functionName: 'getThreshold' }),
    publicClient.readContract({ address: account, abi: safeAbi, functionName: 'getModulesPaginated', args: [SENTINEL_OWNERS, 10n] }),
  ])
  const eviction = modules.find((m) => RECOVERY_MODULES.includes(m.toLowerCase())) ?? null
  const delegate = options.keySafe ?? ((await allowanceModule.getDelegates(NODE_URL, account))[0] as Address | undefined)

  const [evictionState, allowance] = await Promise.all([
    eviction ? readEviction(account, eviction) : null,
    delegate ? readAllowance(account, delegate, options.token ?? USDC_ADDRESS) : null,
  ])
  return {
    deployed: true,
    nonce,
    owners: [...owners],
    threshold: Number(threshold),
    modules: [...modules],
    evictionModule: eviction,
    guardians: evictionState?.guardians ?? [],
    guardianThreshold: evictionState?.threshold ?? 0,
    allowance,
    pendingEviction: evictionState?.pending ?? null,
  }
}

async function readAllowance(account: Address, delegate: Address, token: Address) {
  const a = await allowanceModule.getTokensAllowance(NODE_URL, account, delegate, token)
  return {
    delegate,
    amount: a.amount,
    spent: a.spent,
    remaining: a.amount > a.spent ? a.amount - a.spent : 0n,
    resetsAt: a.resetTimeMin > 0n ? Number(a.lastResetMin + a.resetTimeMin) * 60_000 : null,
  }
}

async function readEviction(account: Address, module: Address) {
  const m = evictionModule(module)
  const [guardians, threshold, request] = await Promise.all([
    m.getGuardians(NODE_URL, account),
    m.threshold(NODE_URL, account),
    m.getRecoveryRequest(NODE_URL, account),
  ])
  return {
    guardians: guardians as Address[],
    threshold: Number(threshold),
    pending:
      request.executeAfter > 0n
        ? {
            newOwners: request.newOwners as Address[],
            newThreshold: Number(request.newThreshold),
            executeAfter: Number(request.executeAfter),
            approvals: Number(request.guardiansApprovalCount),
          }
        : null,
  }
}

// ── Spending ────────────────────────────────────────────────────────────────

/** Face ID alone: the Key Safe spends from its daily allowance (empty delegate signature, payment = 0). */
export function allowanceTransferCall({
  account,
  to,
  amount,
  keySafe,
  token = USDC_ADDRESS,
}: {
  account: Address
  to: Address
  amount: bigint
  keySafe: Address
  token?: Address
}): MetaTransaction {
  return allowanceModule.createAllowanceTransferMetaTransaction(account, token, to, amount, keySafe, { delegateSignature: '0x' })
}

/** Above the limit: a plain token transfer executed by the Account (needs 2 factors). */
export function tokenTransferCall({ to, amount, token = USDC_ADDRESS }: { to: Address; amount: bigint; token?: Address }): AccountCall {
  return { to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] }) }
}

// ── Two-factor Account transactions ─────────────────────────────────────────

/** EIP-712 SafeTx payload of `call` at `nonce` (Safe v1.4.1 domain: chainId + verifyingContract). */
export function accountTypedData(account: Address, call: AccountCall, nonce: bigint) {
  return {
    domain: { chainId: Number(CHAIN_ID), verifyingContract: account },
    types: {
      SafeTx: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'safeTxGas', type: 'uint256' },
        { name: 'baseGas', type: 'uint256' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasToken', type: 'address' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'SafeTx' as const,
    message: {
      to: call.to,
      value: call.value ?? 0n,
      data: call.data,
      operation: call.operation ?? 0,
      safeTxGas: 0n,
      baseGas: 0n,
      gasPrice: 0n,
      gasToken: zeroAddress,
      refundReceiver: zeroAddress,
      nonce,
    },
  }
}

/** The digest each owner approves. A security key signs it as its WebAuthn challenge. */
export const accountTxDigest = (account: Address, call: AccountCall, nonce: bigint): Hex =>
  hashTypedData(accountTypedData(account, call, nonce))

export async function kitSignature(kit: KitSigner, account: Address, call: AccountCall, nonce: bigint): Promise<AccountSignature> {
  return { kind: 'ecdsa', signer: kit.address, data: await kit.signTypedData(accountTypedData(account, call, nonce)) }
}

/** The Key Safe approves by being msg.sender of the `execTransaction` (its own UserOp). */
export const senderSignature = (signer: Address): AccountSignature => ({ kind: 'sender', signer })

/** Security key: `data` = SafeAccount.createWebAuthnSignature(assertion over accountTxDigest). */
export const contractSignature = (signer: Address, data: Hex): AccountSignature => ({ kind: 'contract', signer, data })

/** Safe signature blob: owners sorted ascending, static parts, then the dynamic contract signatures. */
export function encodeSafeSignatures(signatures: AccountSignature[]): Hex {
  const sorted = [...signatures].sort((a, b) => (BigInt(a.signer) < BigInt(b.signer) ? -1 : 1))
  const staticLength = 65 * sorted.length
  let dynamic: Hex = '0x'
  const statics = sorted.map((sig) => {
    if (sig.kind === 'ecdsa') return sig.data
    if (sig.kind === 'sender') return concat([pad(sig.signer, { size: 32 }), pad('0x00', { size: 32 }), '0x01'])
    const offset = staticLength + size(dynamic)
    dynamic = concat([dynamic, pad(toHex(size(sig.data)), { size: 32 }), sig.data])
    return concat([pad(sig.signer, { size: 32 }), pad(toHex(offset), { size: 32 }), '0x00'])
  })
  return concat([...statics, dynamic])
}

/** The `execTransaction` call to send (by the Key Safe via `sendCalls`, or by the relayer). */
export function accountExecCall(account: Address, call: AccountCall, signatures: Hex): MetaTransaction {
  return {
    to: account,
    value: 0n,
    data: encodeFunctionData({
      abi: safeAbi,
      functionName: 'execTransaction',
      args: [call.to, call.value ?? 0n, call.data, call.operation ?? 0, 0n, 0n, 0n, zeroAddress, zeroAddress, signatures],
    }),
  }
}

/**
 * One 2-factor Account transaction sent by the Key Safe: the Kit owner key signs the SafeTx at the
 * current nonce and the Key Safe approves as msg.sender (one sponsored UserOp). Used above the daily
 * limit (#12), for the limit (#13), to cancel an eviction (#16), for the handover (#15) and the level
 * upgrade (#21).
 */
export async function twoFactorCall(params: {
  account: Address
  keySafe: Address
  call: AccountCall
  kit: KitSigner
}): Promise<MetaTransaction> {
  const { account, keySafe, call, kit } = params
  const nonce = await accountNonce(account)
  const signatures = encodeSafeSignatures([await kitSignature(kit, account, call, nonce), senderSignature(keySafe)])
  return accountExecCall(account, call, signatures)
}

/** Several Account calls as one delegatecall to MultiSendCallOnly: one signature set, atomic. */
export function batchCalls(calls: AccountCall[]): AccountCall {
  if (calls.length === 1) return calls[0]
  if (calls.some((c) => (c.operation ?? 0) !== 0)) throw new Error('batchCalls: only plain calls can be batched')
  const transactions = concat(
    calls.map((c) =>
      encodePacked(['uint8', 'address', 'uint256', 'uint256', 'bytes'], [0, c.to, c.value ?? 0n, BigInt(size(c.data)), c.data]),
    ),
  )
  return {
    to: MULTISEND_CALL_ONLY_141,
    data: encodeFunctionData({ abi: multiSendAbi, functionName: 'multiSend', args: [transactions] }),
    operation: 1,
  }
}

// ── Owners (security key, immediate eviction) ───────────────────────────────

/** Add an owner (e.g. a security key's verifier proxy), keeping threshold 2. */
export const addOwnerCall = (account: Address, owner: Address, threshold = 2n): AccountCall => ({
  to: account,
  data: encodeFunctionData({ abi: safeAbi, functionName: 'addOwnerWithThreshold', args: [owner, threshold] }),
})

/** Replace an owner in place. `owners` in on-chain order (getOwners). */
export function swapOwnerCall(account: Address, owners: Address[], oldOwner: Address, newOwner: Address): AccountCall {
  const i = owners.findIndex((o) => o.toLowerCase() === oldOwner.toLowerCase())
  if (i < 0) throw new Error(`${oldOwner} is not an owner`)
  const prev = i === 0 ? SENTINEL_OWNERS : owners[i - 1]
  return { to: account, data: encodeFunctionData({ abi: safeAbi, functionName: 'swapOwner', args: [prev, oldOwner, newOwner] }) }
}

/** Move the daily allowance from the old Key Safe to the new one. */
/** New daily limit for the Key Safe (PDR-020): 2 factors, same daily reset as at setup. */
export function setDailyLimitCall({
  keySafe,
  dailyLimit,
  token = USDC_ADDRESS,
}: {
  keySafe: Address
  dailyLimit: bigint
  token?: Address
}): AccountCall {
  if (dailyLimit <= 0n || dailyLimit >= 2n ** 96n) throw new Error('Invalid daily limit')
  return asCall(allowanceModule.createBaseSetAllowanceMetaTransaction(keySafe, token, dailyLimit, ALLOWANCE_RESET_MINUTES, lastUtcMidnightMin()))
}

/**
 * Upgrade to level 1 (PDR-015, PDR-019, issue #21): Swissquote becomes the second eviction guardian
 * (threshold 2, identity check before it signs) and the delay drops to the level-1 module's.
 * When both levels share one module (the 3-minute demo), Swissquote is just added; otherwise the
 * level-0 module is swapped for the level-1 one with both guardians. 2 factors (twoFactorCall).
 */
export function upgradeToLevel1Call(params: {
  account: Address
  state: Pick<AccountState, 'modules' | 'evictionModule' | 'guardians' | 'pendingEviction'>
  kitGuardian: Address
  swissquoteGuardian: Address
}): AccountCall {
  const { account, state, kitGuardian, swissquoteGuardian } = params
  const current = state.evictionModule
  const target = ACCOUNT_RECOVERY_MODULE[1]
  if (!current) throw new Error('This Account has no lock-out module')
  if (state.pendingEviction) throw new Error('A lock-out is in progress: cancel or finish it first')
  if (state.guardians.some((g) => g.toLowerCase() === swissquoteGuardian.toLowerCase())) {
    throw new Error('This Account is already at level 1')
  }
  const addSwissquote = asCall(evictionModule(target).createAddGuardianWithThresholdMetaTransaction(swissquoteGuardian, 2n))
  if (current.toLowerCase() === target.toLowerCase()) return batchCalls([addSwissquote])
  const i = state.modules.findIndex((m) => m.toLowerCase() === current.toLowerCase())
  const prev = i <= 0 ? SENTINEL_OWNERS : state.modules[i - 1]
  return batchCalls([
    { to: account, data: encodeFunctionData({ abi: safeAbi, functionName: 'disableModule', args: [prev, current] }) },
    { to: account, data: encodeFunctionData({ abi: safeAbi, functionName: 'enableModule', args: [target] }) },
    asCall(evictionModule(target).createAddGuardianWithThresholdMetaTransaction(kitGuardian, 1n)),
    addSwissquote,
  ])
}

export function handoverCall({
  oldKeySafe,
  newKeySafe,
  dailyLimit,
  token = USDC_ADDRESS,
}: {
  oldKeySafe: Address
  newKeySafe: Address
  dailyLimit: bigint
  token?: Address
}): AccountCall {
  return batchCalls(allowanceMoveCalls(oldKeySafe, newKeySafe, dailyLimit, token))
}

/**
 * Immediate eviction (Kit + security key, PDR-017): swap the Key Safe and move the allowance, atomically.
 * With `cancelEviction` (the eviction module), a time-locked lock-out still running is cancelled in the same
 * transaction: it is no longer needed.
 */
export function replaceKeySafeCall(params: {
  account: Address
  owners: Address[]
  oldKeySafe: Address
  newKeySafe: Address
  dailyLimit: bigint
  token?: Address
  cancelEviction?: Address
}): AccountCall {
  const { account, owners, oldKeySafe, newKeySafe, dailyLimit, token = USDC_ADDRESS, cancelEviction } = params
  return batchCalls([
    ...(cancelEviction ? [cancelEvictionCall(cancelEviction)] : []),
    swapOwnerCall(account, owners, oldKeySafe, newKeySafe),
    ...allowanceMoveCalls(oldKeySafe, newKeySafe, dailyLimit, token),
  ])
}

function allowanceMoveCalls(oldKeySafe: Address, newKeySafe: Address, dailyLimit: bigint, token: Address): AccountCall[] {
  return [
    asCall(allowanceModule.createRemoveDelegateMetaTransaction(oldKeySafe, true)),
    asCall(allowanceModule.createAddDelegateMetaTransaction(newKeySafe)),
    asCall(allowanceModule.createBaseSetAllowanceMetaTransaction(newKeySafe, token, dailyLimit, ALLOWANCE_RESET_MINUTES, lastUtcMidnightMin())),
  ]
}

// ── Time-locked eviction (ADR-019, PDR-021) ─────────────────────────────────

/** Owners after replacing the old Key Safe (the Kit and a security key stay). */
export function evictionNewOwners(owners: Address[], oldKeySafe: Address, newKeySafe: Address): Address[] {
  if (!owners.some((o) => o.toLowerCase() === oldKeySafe.toLowerCase())) throw new Error(`${oldKeySafe} is not an owner`)
  return owners.map((o) => (o.toLowerCase() === oldKeySafe.toLowerCase() ? newKeySafe : o))
}

/** EIP-712 payload each eviction guardian signs (the Kit guardian key, + Swissquote at level 1). */
export async function evictionTypedData(account: Address, module: Address, newOwners: Address[], newThreshold = 2n) {
  const { domain, types, messageValue } = await evictionModule(module).getRecoveryRequestEip712Data(
    NODE_URL,
    CHAIN_ID,
    account,
    newOwners,
    newThreshold,
  )
  return {
    domain: { ...domain, verifyingContract: domain.verifyingContract as Address },
    types,
    primaryType: EXECUTE_RECOVERY_PRIMARY_TYPE,
    message: messageValue,
  } as const
}

/** Confirm + start the delay in one call; anyone may send it (the relayer does). */
export const startEvictionCall = (
  account: Address,
  module: Address,
  newOwners: Address[],
  signatures: RecoverySignaturePair[],
  newThreshold = 2,
): MetaTransaction =>
  evictionModule(module).createMultiConfirmRecoveryMetaTransaction(account, newOwners, newThreshold, signatures, true)

/** Cancel a pending eviction: wrap with `accountExecCall` and 2 factors (the thief has only one). */
export const cancelEvictionCall = (module: Address): AccountCall => asCall(evictionModule(module).createCancelRecoveryMetaTransaction())

/** After the delay: anyone may finalize (the relayer does). Then run `handoverCall`. */
export const finalizeEvictionCall = (account: Address, module: Address): MetaTransaction =>
  evictionModule(module).createFinalizeRecoveryMetaTransaction(account)
