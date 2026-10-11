import { formatUnits } from 'viem'

import { USDC_DECIMALS } from './config'

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** 20000000n → "20.00" (2 decimals, grouped thousands). */
export function formatUsdc(amount: bigint) {
  return Number(formatUnits(amount, USDC_DECIMALS)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** 3500000000n → "3,500" (decimals only when needed): limits and bounds. */
export function formatUsdcShort(amount: bigint) {
  return Number(formatUnits(amount, USDC_DECIMALS)).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

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
    // The bundler simulates every operation first: an onchain revert surfaces as EXECUTION_REVERTED (-32521).
    if (/EXECUTION_REVERTED|-32521/.test(chain)) return 'The network refused this transaction: it would fail onchain.'
    if (/rpc call failed/i.test(error.message) && error.cause instanceof Error && error.cause.message) return error.cause.message
    return error.message
  }
  return String(error)
}
