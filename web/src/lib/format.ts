import { formatUnits } from 'viem'

import { USDC_DECIMALS } from './config'

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * 20000000n → "20.00" (2 decimals, grouped thousands). Rounded down: a balance of 0.999498 reads
 * 0.99, never more than there is (ADR-032).
 */
export function formatUsdc(amount: bigint) {
  return formatDecimal(amount, USDC_DECIMALS, { places: 2, round: 'down' })
}

/** 3500000000n → "3,500" (decimals only when needed): limits and bounds. */
export function formatUsdcShort(amount: bigint) {
  return Number(formatUnits(amount, USDC_DECIMALS)).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * A token amount as text, computed on the integer (no float): at most `places` decimals, trailing
 * zeros trimmed down to `min`. `round: 'down'` never shows more than the amount, which minimums
 * and Max need ("at least 0.49", not "0.50" for 0.4965). 499512n, 6 → "0.499512".
 */
export function formatDecimal(
  amount: bigint,
  decimals: number,
  { places = decimals, round = 'nearest', group = true, min = 2 }: { places?: number; round?: 'nearest' | 'down'; group?: boolean; min?: number } = {},
): string {
  if (amount < 0n) return `-${formatDecimal(-amount, decimals, { places, round, group, min })}`
  const unit = 10n ** BigInt(Math.max(decimals - places, 0))
  const value = ((round === 'nearest' ? amount + unit / 2n : amount) / unit) * unit
  const [whole, fraction = ''] = formatUnits(value, decimals).split('.')
  const digits = fraction.slice(0, places).replace(/0+$/, '').padEnd(min, '0')
  const head = group ? BigInt(whole).toLocaleString('en-US') : whole
  return digits ? `${head}.${digits}` : head
}

/** What is signed and moved, to the last unit: 499512n → "0.499512", 500000n → "0.50". */
export const formatUsdcExact = (amount: bigint) => formatDecimal(amount, USDC_DECIMALS, { round: 'down' })

export function formatCountdown(seconds: number) {
  if (seconds <= 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** A delay in seconds: "6 d 23 h", "5 h 12 min", or "2:47" under an hour. */
export function formatDelay(seconds: number) {
  if (seconds <= 0) return '0:00'
  const d = Math.floor(seconds / 86_400)
  const h = Math.floor((seconds % 86_400) / 3_600)
  const m = Math.floor((seconds % 3_600) / 60)
  if (d) return `${d} d${h ? ` ${h} h` : ''}`
  if (h) return `${h} h${m ? ` ${m} min` : ''}`
  return formatCountdown(seconds)
}

export function formatTime(timestampMs: number) {
  return new Date(timestampMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** "Today", "Yesterday" or "12 Oct 2026". */
export function formatDay(timestampMs: number) {
  const day = new Date(timestampMs)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (day.toDateString() === today.toDateString()) return 'Today'
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Every message and code down an error's cause chain: SDK errors wrap the node's or bundler's own answer. */
export function errorChain(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; current != null && depth < 5; depth++) {
    if (!(current instanceof Error)) {
      parts.push(String(current))
      break
    }
    const { code, errno } = current as Error & { code?: unknown; errno?: unknown }
    parts.push(current.message, ...[code, errno].filter((v) => v != null).map(String))
    current = current.cause
  }
  return parts.join(' · ')
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    const text = `${error.name} ${error.message} ${String(error.cause ?? '')}`
    if (/NotAllowedError|not allowed|AbortError/i.test(text)) return 'Passkey prompt was cancelled.'
    const chain = errorChain(error)
    // The paymaster's own refusal (ADR-023) is a sentence the owner can act on: show it, not the RPC wrapper.
    // Only the dApp refusal's first sentence: the app has no "pay the fee yourself" path (PDR-003).
    const refusal = /(Monthly sponsored quota reached[^·]*|Swissquote only sponsors approved dApps[^.]*\.)/.exec(chain)?.[0]?.trim()
    if (refusal) return refusal
    // The bundler simulates every operation first: an onchain revert surfaces as EXECUTION_REVERTED (-32521).
    if (/EXECUTION_REVERTED|-32521/.test(chain)) return 'The network refused this transaction: it would fail onchain.'
    if (/rpc call failed/i.test(error.message) && error.cause instanceof Error && error.cause.message) return error.cause.message
    return error.message
  }
  return String(error)
}
