import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { formatUsdc } from '@/lib/format'

/**
 * The worst case now and after a change of rule, on the Apricot Field (DESIGN.md, Worst Case Change):
 * the current figure muted, an arrow and the new one large, then a sentence in words. Shared by the
 * daily limit change (#13) and the level 1 upgrade (#21). `after` null shows the current figure only.
 * The sentence is live and can describe a field (`id`).
 */
export function WorstCaseChange({
  before,
  after,
  label,
  id,
  children,
}: {
  before: bigint | null
  after: bigint | null
  /** Names the change for screen readers: "the new limit", "level 1". */
  label: string
  id?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl bg-accent-soft p-4 sm:p-5" aria-label={`Worst case if your phone is stolen, now and with ${label}`}>
      <p className="text-sm text-foreground/75">If your phone is stolen, a thief can take at most</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono tabular-nums">
        <span className="text-2xl text-foreground/60">
          <span className="sr-only">Now </span>
          {before !== null ? formatUsdc(before) : '–'}
        </span>
        {after !== null && (
          <>
            <ArrowRight className="h-5 w-5 shrink-0 self-center text-foreground/60" aria-hidden />
            <span className="text-4xl font-semibold tracking-tight">
              <span className="sr-only">with {label} </span>
              {formatUsdc(after)}
            </span>
          </>
        )}
        <span className="font-sans text-lg">USDC</span>
      </p>
      <p id={id} aria-live="polite" className="mt-2 text-sm text-foreground/75">
        {after !== null && before !== null && (
          <span className="sr-only">
            Worst case {formatUsdc(before)} to {formatUsdc(after)} USDC.{' '}
          </span>
        )}
        {children}
      </p>
    </section>
  )
}
