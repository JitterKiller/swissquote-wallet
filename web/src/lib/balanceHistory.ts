import type { Transfer } from './activity'

/**
 * The balance over time, rebuilt from the USDC Transfer logs the wallet already reads (ADR-015).
 * USDC tracks the dollar, so the curve moves only with money in and out, never with a market.
 */

export type BalancePoint = { t: number; balance: bigint; transfer?: Transfer }
export type BalanceRange = '24h' | '7d' | '30d' | 'all'

const DAY = 86_400_000
export const BALANCE_RANGES: { id: BalanceRange; label: string; ms: number | null }[] = [
  { id: '24h', label: '24H', ms: DAY },
  { id: '7d', label: '7D', ms: 7 * DAY },
  { id: '30d', label: '30D', ms: 30 * DAY },
  { id: 'all', label: 'All', ms: null },
]

/**
 * Balance after every transfer, oldest first. It walks back from the live balance, so the curve
 * always ends on the figure the balance card shows, even when the logs are a poll behind.
 */
export function balanceHistory(transfers: Transfer[], current: bigint) {
  const sorted = [...transfers].sort((a, b) => (a.blockNumber === b.blockNumber ? 0 : a.blockNumber < b.blockNumber ? -1 : 1))
  const points: BalancePoint[] = []
  let after = current
  for (let i = sorted.length - 1; i >= 0; i--) {
    const transfer = sorted[i]
    points.push({ t: transfer.timestamp, balance: after < 0n ? 0n : after, transfer })
    after = transfer.direction === 'in' ? after - transfer.amount : after + transfer.amount
  }
  points.reverse()
  return { opening: after < 0n ? 0n : after, points }
}

/**
 * The points to draw for a range: the balance at its start, every transfer inside it, and now.
 * "All" starts just before the first transfer the wallet has seen.
 */
export function balanceSeries(history: ReturnType<typeof balanceHistory>, current: bigint, range: BalanceRange, now: number) {
  const { opening, points } = history
  const ms = BALANCE_RANGES.find((r) => r.id === range)!.ms
  const first = points[0]?.t
  const from = ms !== null ? now - ms : first !== undefined ? first - Math.max((now - first) * 0.05, 60_000) : now - DAY
  const before = points.filter((p) => p.t <= from)
  const atStart = before.length ? before[before.length - 1].balance : opening
  return {
    from,
    to: now,
    points: [{ t: from, balance: atStart }, ...points.filter((p) => p.t > from), { t: now, balance: current }] as BalancePoint[],
    change: current - atStart,
  }
}

/** A round axis maximum above the largest value: 1, 2 or 5 times a power of ten. */
export function niceMax(value: number) {
  if (value <= 0) return 100
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power
  return 10 * power
}
