'use client'

import { ArrowRight } from 'lucide-react'
import { useState } from 'react'

import { FactorSquare, type Factor } from '@/components/ui/factor'
import { Plate } from '@/components/ui/plate'

type Holder = 'phone' | 'kit' | 'swissquote'

const SCENARIOS: { label: string; needs: Holder[]; answer: string }[] = [
  { label: 'Pay up to your daily limit', needs: ['phone'], answer: 'Face ID alone, in a second.' },
  { label: 'Pay more than your limit', needs: ['phone', 'kit'], answer: 'Face ID and your Recovery Kit, together.' },
  {
    label: 'Move to a new phone',
    needs: ['kit'],
    answer: 'Your Kit alone, after 7 days (for a linked client, your Kit and a Swissquote identity check, after 3). Only the old phone and your Kit together could stop it.',
  },
  {
    label: 'A thief has your unlocked phone',
    needs: ['phone'],
    answer: 'At most your daily limit each day, until your Kit locks the phone out. Anything more is refused by your Account.',
  },
  {
    label: 'Swissquote, on its own',
    needs: [],
    answer: 'Nothing. Swissquote is not an owner of your Account: it cannot move, freeze or recover your money.',
  },
]

const HOLDERS: { id: Holder; factor: Factor | null; name: string; role: string }[] = [
  { id: 'phone', factor: 'phone', name: 'This phone', role: 'Face ID, up to your daily limit' },
  { id: 'kit', factor: 'kit', name: 'Recovery Kit', role: 'Your file and its passphrase' },
  { id: 'swissquote', factor: null, name: 'Swissquote', role: 'Never an owner' },
]

/** Who can move the money, scenario by scenario: the custody rule (PDR-013, PDR-014) as a toy. */
export function CustodyExplorer() {
  const [index, setIndex] = useState(0)
  const scenario = SCENARIOS[index]

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
      <div>
        <h2 className="text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl">Who can move your money?</h2>
        <p className="mt-4 max-w-lg text-lg text-muted">
          Your Account belongs to two of your own factors, and needs both for anything that matters. Pick a situation.
        </p>
        <div className="mt-8 border-t border-border" role="radiogroup" aria-label="Situation">
          {SCENARIOS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              role="radio"
              aria-checked={i === index}
              onClick={() => setIndex(i)}
              className={`flex w-full items-center justify-between gap-4 border-b border-border py-3.5 text-left transition-colors duration-150 ${
                i === index ? 'font-semibold text-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              {s.label}
              {/* An arrow, not a square: squares are the Factor Code (DESIGN.md). */}
              <ArrowRight className={`h-4 w-4 shrink-0 transition-opacity duration-150 ${i === index ? 'opacity-100' : 'opacity-0'}`} aria-hidden />
            </button>
          ))}
        </div>
      </div>

      <div className="lg:pt-2">
        <Plate title="Your Account · who can move it">
          <dl>
            {HOLDERS.map((holder) => {
              const on = scenario.needs.includes(holder.id)
              return (
                <div
                  key={holder.id}
                  className="flex items-center gap-4 border-t border-hero-2 py-4 first:border-t-0 first:pt-0"
                >
                  {/* Only the square dims when a holder is not needed: the text keeps its contrast. */}
                  <span className={`transition-opacity duration-200 ${on ? '' : 'opacity-30'}`}>
                    {/* Swissquote is not a factor: an empty slot keeps the names aligned, never a square. */}
                    {holder.factor ? <FactorSquare factor={holder.factor} tone="hero" /> : <span className="block h-2.5 w-2.5" aria-hidden />}
                  </span>
                  <dt className="flex-1">
                    <span className={`block font-medium transition-colors duration-200 ${on ? 'text-hero-fg' : 'text-hero-muted'}`}>{holder.name}</span>
                    <span className="block text-sm text-hero-muted">{holder.role}</span>
                  </dt>
                  <dd className="token text-hero-muted">{on ? 'Needed' : holder.id === 'swissquote' ? 'Not an owner' : '—'}</dd>
                </div>
              )
            })}
          </dl>
          <p className="mt-4 border-t border-hero-2 pt-4 text-hero-fg" aria-live="polite">
            {scenario.answer}
          </p>
        </Plate>
      </div>
    </div>
  )
}
