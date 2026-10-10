import type { MetaTransaction } from 'abstractionkit'
import { BaseError, decodeFunctionData, erc20Abi, formatUnits, getAddress, parseAbi, parseUnits, type Address } from 'viem'

import { api } from './api'
import { ALLOWANCE_MODULE_ADDRESS, USDC_ADDRESS, USDC_DECIMALS } from './config'
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

/** Human-readable summary of a call: what leaves the wallet, to whom. */
export function describeCall(call: MetaTransaction): string {
  try {
    if (getAddress(call.to) === getAddress(USDC_ADDRESS)) {
      const { functionName, args } = decodeFunctionData({ abi: erc20Abi, data: call.data as `0x${string}` })
      if (functionName === 'transfer') return `Send ${formatUnits(args[1], USDC_DECIMALS)} USDC to ${args[0]}`
      if (functionName === 'approve') return `Allow ${args[0]} to spend ${formatUnits(args[1], USDC_DECIMALS)} USDC`
    }
    if (getAddress(call.to) === getAddress(ALLOWANCE_MODULE_ADDRESS)) {
      const { args } = decodeFunctionData({ abi: allowanceAbi, data: call.data as `0x${string}` })
      return `Send ${formatUnits(args[3], USDC_DECIMALS)} USDC to ${args[2]} from today's limit`
    }
  } catch {
    // fall through
  }
  return `Call ${call.to}${call.value ? ` with ${formatUnits(call.value, 18)} ETH` : ''}`
}

export type Simulation = { ok: boolean; reason?: string; summary: string[] }

/**
 * Runs each call with `eth_call` from the sender. Checks the effect (balance, allowance), not
 * the signature or the 4337 validation.
 */
export async function simulateCalls(from: Address, calls: MetaTransaction[]): Promise<Simulation> {
  const summary = calls.map(describeCall)
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
