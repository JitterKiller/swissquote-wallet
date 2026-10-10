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

export function formatCountdown(seconds: number) {
  if (seconds <= 0) return '0:00'
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
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

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    const text = `${error.name} ${error.message} ${String(error.cause ?? '')}`
    if (/NotAllowedError|not allowed|AbortError/i.test(text)) return 'Passkey prompt was cancelled.'
    return error.message
  }
  return String(error)
}
