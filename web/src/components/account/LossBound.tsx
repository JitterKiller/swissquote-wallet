import { DaySquares } from '@/components/account/DaySquares'
import { Badge } from '@/components/ui/feedback'
import { EVICTION_DAYS, EVICTION_DELAY_IS_DEMO, EVICTION_DELAY_SECONDS, type Level } from '@/lib/config'
import { formatUsdc } from '@/lib/format'

/** The most a thief with the unlocked phone can take: today's limit, then one more after each daily reset until the lock-out. */
export const lossBound = (limit: bigint, level: Level) => limit * BigInt(EVICTION_DAYS[level] + 1)

/**
 * The worst case if the phone is stolen, as an amount on the Apricot Field (PDR-014, PDR-018), with
 * DaySquares. Shared by the protect flow (compact: figure and squares on one row) and the Security
 * page (#26, `roomy`: as tall as the owners plate beside it, the squares in the middle).
 */
export function LossBound({
  limit,
  level,
  roomy = false,
  withKey = false,
}: {
  limit: bigint | null
  level: Level
  roomy?: boolean
  /** With a security key (#17), the Kit and the key lock a stolen phone out at once: about one day of the limit. */
  withKey?: boolean
}) {
  const days = withKey ? 0 : EVICTION_DAYS[level]
  const figure = limit !== null ? formatUsdc(withKey ? limit : lossBound(limit, level)) : '–'
  const explanation = withKey ? (
    <p className={`text-sm text-foreground/75 ${roomy ? '' : 'mt-2'}`}>
      If you act before the next daily reset: from a new device, your Kit and your security key lock the phone out at once. Each reset adds{' '}
      <span className="font-mono tabular-nums">{limit !== null ? formatUsdc(limit) : '–'}</span> more.
    </p>
  ) : (
    <p className={`text-sm text-foreground/75 ${roomy ? '' : 'mt-2'}`}>
      <span className="font-mono tabular-nums">{limit !== null ? formatUsdc(limit) : '–'}</span> today, then again after each of the{' '}
      {days} daily resets until your Kit locks them out{level === 1 ? ' with a Swissquote identity check.' : '.'}
      {EVICTION_DELAY_IS_DEMO && (
        <span className="ml-2 inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
          <Badge tone="warning">Demo</Badge>
          {Math.round(EVICTION_DELAY_SECONDS[level] / 60)} min on testnet
        </span>
      )}
    </p>
  )

  if (roomy) {
    return (
      <section className="flex flex-col justify-between gap-6 rounded-2xl bg-accent-soft p-5 sm:p-6" aria-label="Worst case if your phone is stolen">
        <div>
          <p className="text-sm text-foreground/75">If your phone is stolen, a thief can take at most</p>
          <p className="mt-1 font-mono text-5xl font-semibold tabular-nums tracking-[-0.04em] sm:text-6xl">
            {figure} <span className="font-sans text-xl font-normal tracking-normal">USDC</span>
          </p>
        </div>
        <DaySquares days={days} today size="lg" />
        {explanation}
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-accent-soft p-4" aria-label="Worst case if your phone is stolen">
      <p className="text-sm text-foreground/75">If your phone is stolen, a thief can take at most</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
          {figure} <span className="font-sans text-lg">USDC</span>
        </p>
        <DaySquares days={days} today />
      </div>
      {explanation}
    </section>
  )
}
