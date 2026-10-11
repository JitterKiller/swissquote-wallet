'use client'

import { useState } from 'react'

import { DaySquares } from '@/components/account/DaySquares'
import { Badge } from '@/components/ui/feedback'
import { EVICTION_DAYS } from '@/lib/config'

const PRESETS = [100, 250, 500, 1000]

/**
 * The loss bound as a toy: the same arithmetic as the protect flow (AccountSetupStep): what is left
 * today plus one daily limit per reset until the Kit locks a stolen phone out.
 */
export function LimitSimulator() {
  const [limit, setLimit] = useState(500)
  const [linked, setLinked] = useState(false)
  const days = EVICTION_DAYS[linked ? 1 : 0]
  const worst = limit * (days + 1)
  const usdc = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const chip = (selected: boolean) =>
    `h-9 rounded-lg border px-3.5 font-mono text-sm tabular-nums transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
      selected ? 'border-transparent bg-accent font-semibold text-accent-fg' : 'border-border bg-surface text-foreground hover:bg-surface-2'
    }`

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
      <div>
        <h2 className="text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl">Choose what a thief could take.</h2>
        <p className="mt-4 max-w-lg text-lg text-muted">
          Face ID alone pays up to a daily limit you set. Above it, your Recovery Kit has to approve too. So the worst case of a
          stolen phone is a number you know before it happens.
        </p>
        <fieldset className="mt-8">
          <legend className="text-sm font-medium">Daily limit</legend>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Daily limit in USDC">
            {PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={limit === value}
                onClick={() => setLimit(value)}
                className={chip(limit === value)}
              >
                {value.toLocaleString('en-US')}
                <span className={`ml-1.5 font-sans text-[11px] ${limit === value ? 'text-accent-fg' : 'text-muted'}`}>USDC</span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Swissquote account</legend>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Swissquote account">
            {[
              { value: false, label: 'Not linked' },
              { value: true, label: 'Linked client' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={linked === option.value}
                onClick={() => setLinked(option.value)}
                className={chip(linked === option.value).replace('font-mono ', '')}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <section className="rounded-2xl bg-accent-soft p-5 sm:p-7" aria-label="Worst case if your phone is stolen">
        <div className="flex items-start justify-between gap-4">
          <p className="text-foreground/75">If your phone is stolen, a thief can take at most</p>
          <Badge tone="warning">Demo</Badge>
        </div>
        <p className="mt-2 font-mono text-5xl font-semibold tabular-nums tracking-[-0.035em] sm:text-6xl" aria-live="polite">
          {usdc(worst)} <span className="font-sans text-xl tracking-normal">USDC</span>
        </p>
        <div className="mt-6">
          <DaySquares days={days} today />
        </div>
        <p className="mt-5 text-sm text-foreground/75">
          <span className="font-mono tabular-nums">{usdc(limit)}</span> today, then again after each of the {days}{' '}
          daily resets, until your Kit locks the phone out{linked ? ' with a Swissquote identity check' : ''}. Everything above that
          is refused by your Account.
        </p>
      </section>
    </div>
  )
}
