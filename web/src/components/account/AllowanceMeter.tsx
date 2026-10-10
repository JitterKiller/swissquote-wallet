'use client'

import { FactorSquare } from '@/components/ui/factor'
import type { AccountState } from '@/lib/account'
import { formatUsdc } from '@/lib/format'
import { useNow } from '@/lib/hooks'

const CELLS = 10

/** Next refill: the module's reset when it is ahead, otherwise the next 00:00 UTC (reset base 0, 1440 min). */
export function nextReset(resetsAt: number | null, now: number) {
  if (resetsAt && resetsAt > now) return resetsAt
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
}

export function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

/**
 * Today's Face ID budget (the Key Safe's allowance on the Account, PDR-020) as a row of square
 * cells that empties through the day and refills at 00:00 UTC. The world's signature on the
 * Overview; reused small in Send, where it previews the payment being typed: the cells a
 * Face ID payment will use are outlined, a Kit payment uses none.
 */
export function AllowanceMeter({
  allowance,
  tone = 'hero',
  size = 'lg',
  spend = null,
}: {
  allowance: NonNullable<AccountState['allowance']>
  tone?: 'hero' | 'light'
  size?: 'lg' | 'sm'
  spend?: { amount: bigint; route: 'limit' | 'kit' } | null
}) {
  const now = useNow(60_000)
  const { amount, remaining } = allowance
  const cellsFor = (value: bigint) => (amount > 0n ? Math.round(Number((value * BigInt(CELLS * 100)) / amount) / 100) : 0)
  const preview = spend?.route === 'limit'
  // What is left once the payment being typed lands (Face ID route only).
  const left = preview ? (remaining > spend.amount ? remaining - spend.amount : 0n) : remaining
  const lit = cellsFor(remaining)
  const after = cellsFor(left)
  const resetIn = formatDuration(nextReset(allowance.resetsAt, now) - now)
  const muted = tone === 'hero' ? 'text-hero-muted' : 'text-muted'
  const off = tone === 'hero' ? 'bg-hero-2' : 'bg-surface-2 ring-1 ring-inset ring-border'
  const pending = tone === 'hero' ? 'bg-hero-2 ring-1 ring-inset ring-accent' : 'bg-accent-soft ring-1 ring-inset ring-accent'

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className={`text-sm ${muted}`}>{size === 'lg' ? 'Face ID can still spend today' : 'Face ID today'}</p>
        <p className={`whitespace-nowrap text-xs ${muted}`}>
          Resets in <span className="font-mono tabular-nums">{resetIn}</span>
        </p>
      </div>
      <div className={`mt-2 grid grid-cols-10 ${size === 'lg' ? 'gap-1.5' : 'gap-1'}`} aria-hidden>
        {Array.from({ length: CELLS }, (_, i) => (
          <span
            key={i}
            // Cells drain from the right, one after the other, when a payment lands.
            style={{ transitionDelay: `${(CELLS - 1 - i) * 30}ms` }}
            className={`${size === 'lg' ? 'h-6' : 'h-3'} rounded-[3px] transition-[background-color,box-shadow] duration-300 ${
              i < after ? 'bg-accent' : i < lit ? pending : off
            }`}
          />
        ))}
      </div>
      <p className={`mt-2 ${size === 'lg' ? 'text-base' : 'text-sm'}`}>
        <span className="font-mono font-semibold tabular-nums">{formatUsdc(left)}</span>
        <span className={muted}> of </span>
        <span className="font-mono tabular-nums">{formatUsdc(amount)}</span>
        <span className={muted}>{preview ? ' USDC left after this payment' : ' USDC left'}</span>
        {remaining === 0n && !spend && <span className={muted}>. Larger payments need your Kit.</span>}
      </p>
      {spend?.route === 'kit' && (
        <p className="mt-2 flex gap-2 text-sm">
          <FactorSquare factor="kit" tone={tone} className="mt-[5px]" />
          <span>This payment needs your Kit. It leaves today’s Face ID budget untouched.</span>
        </p>
      )}
    </div>
  )
}
