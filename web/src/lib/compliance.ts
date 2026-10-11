import type { MetaTransaction } from 'abstractionkit'
import { BaseError, decodeFunctionData, erc20Abi, formatUnits, getAddress, parseAbi, parseUnits, type Address } from 'viem'

import { api } from './api'
import { ALLOWANCE_MODULE_ADDRESS, USDC_ADDRESS, USDC_DECIMALS } from './config'
import { APPROVED_DAPPS } from './dapps'
import { formatUsdc, shortAddress } from './format'
import { publicClient } from './wallet'

/**
 * Client-side compliance checks before Face ID (PDR-023, ADR-022): friction, never a veto.
 * Screening runs on the server; simulation, look-alike and high-value checks run here.
 */

export type Screening = { address: string; status: 'clear' | 'sanctioned'; source: string; list?: string }

export const screenRecipient = (address: string) => api<Screening>('/api/compliance/screen', { address })

export const HIGH_VALUE_USDC = parseUnits('5000', USDC_DECIMALS)

/** ≥ 50% of the balance or ≥ 5,000 USDC: the user types the amount to confirm. */
export const needsHighValueConfirmation = (amount: bigint, balance: bigint | null) =>
  amount >= HIGH_VALUE_USDC || (balance !== null && balance > 0n && amount * 2n >= balance)

/**
 * Address poisoning: same first 4 and last 4 hex characters as a past counterparty, but a
 * different address. Returns the counterparty it imitates.
 */
export function isLookAlike(address: string, known: string[]): string | null {
  const a = address.toLowerCase()
  const fingerprint = (x: string) => `${x.slice(2, 6)}…${x.slice(-4)}`
  return known.find((k) => k.toLowerCase() !== a && fingerprint(k.toLowerCase()) === fingerprint(a)) ?? null
}

const allowanceAbi = parseAbi([
  'function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)',
])

const approvedDapp = (address: string) =>
  APPROVED_DAPPS.find((d) => d.contracts.some((c) => c.toLowerCase() === address.toLowerCase())) ?? null

/** "Aave v3 (0x07eA…814b)" for an approved dApp's contract, the short address otherwise. */
const dappLabel = (address: string) => {
  const dapp = approvedDapp(address)
  return dapp ? `${dapp.name} (${shortAddress(address)})` : shortAddress(address)
}

/** Human-readable summary of a call: what leaves the wallet, to whom. */
export function describeCall(call: MetaTransaction): string {
  try {
    if (getAddress(call.to) === getAddress(USDC_ADDRESS)) {
      const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: call.data as `0x${string}` })
      if (functionName === 'transfer') return `Send ${formatUsdc(args[1])} USDC to ${args[0]}`
      if (functionName === 'approve') return `Allow ${dappLabel(args[0])} to spend ${formatUsdc(args[1])} USDC`
    }
    if (getAddress(call.to) === getAddress(ALLOWANCE_MODULE_ADDRESS)) {
      const { args } = decodeFunctionData({ abi: allowanceAbi, data: call.data as `0x${string}` })
      return `Send ${formatUsdc(args[3])} USDC to ${args[2]} from today's limit`
    }
  } catch {
    // fall through
  }
  if (approvedDapp(call.to)) return `Call ${dappLabel(call.to)}`
  return `Call ${call.to}${call.value ? ` with ${formatUnits(call.value, 18)} ETH` : ''}`
}

export type Simulation = { ok: boolean; reason?: string; summary: string[] }

/**
 * Runs each call with `eth_call` from the sender. Checks the effect (balance, allowance), not
 * the signature or the 4337 validation.
 */
export async function simulateCalls(from: Address, calls: MetaTransaction[]): Promise<Simulation> {
  const summary = calls.map(describeCall)
  try {
    // eth_simulateV1: the steps run in order on one state, so a deposit's approval is seen by its supply (#25).
    const { results } = await publicClient.simulateCalls({
      account: from,
      calls: calls.map((call) => ({ to: call.to as Address, data: call.data as `0x${string}`, value: BigInt(call.value ?? 0) })),
    })
    const failed = results.find((result) => result.status !== 'success')
    if (!failed) return { ok: true, summary }
    const reason = failed.error instanceof BaseError ? failed.error.shortMessage : (failed.error?.message ?? 'The transaction would fail')
    return { ok: false, reason, summary }
  } catch {
    // A node without eth_simulateV1: one eth_call per step.
  }
  for (const call of calls) {
    try {
      await publicClient.call({ account: from, to: call.to as Address, data: call.data as `0x${string}`, value: call.value })
    } catch (error) {
      const reason = error instanceof BaseError ? error.shortMessage : 'The transaction would fail'
      return { ok: false, reason, summary }
    }
  }
  return { ok: true, summary }
}
