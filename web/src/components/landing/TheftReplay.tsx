'use client'

import { RotateCcw, ShieldX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { FactorSquare } from '@/components/ui/factor'
import { Badge } from '@/components/ui/feedback'
import { Plate } from '@/components/ui/plate'

import { useReducedMotion } from './PhoneTour'

const DAYS = 7
const THIEF_DAY = 2

/**
 * A stolen phone, replayed: the seven-day lock-out shown as seven seconds. It starts when it
 * scrolls into view, once; Replay runs it again. Reduced motion shows the outcome at once.
 */
export function TheftReplay() {
  const reduced = useReducedMotion()
  const [day, setDay] = useState(0)
  const [run, setRun] = useState(0)
  const [seen, setSeen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const shown = reduced ? DAYS : day

  useEffect(() => {
    const el = root.current
    if (!el || seen) return
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setSeen(true), { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  useEffect(() => {
    if (!seen || reduced) return
    const id = setInterval(() => setDay((d) => (d < DAYS ? d + 1 : d)), 1000)
    return () => clearInterval(id)
  }, [seen, reduced, run])

  const events = [
    { at: 0, when: 'Day 0', text: 'On your new phone, your Kit starts the lock-out.' },
    { at: THIEF_DAY, when: `Day ${THIEF_DAY}`, text: 'The thief tries to cancel it with the stolen phone.', refused: true },
    { at: DAYS, when: `Day ${DAYS}`, text: 'The stolen phone is locked out. Same Account, same funds, on your new phone.' },
  ]

  return (
    <div ref={root} className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
      <div>
        <h2 className="text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl">Lose your phone. Not your money.</h2>
        <p className="mt-4 max-w-lg text-lg text-muted">
          On a new phone, your Recovery Kit starts a lock-out. The thief can spend no more than your daily limit each day meanwhile,
          and cannot cancel it: that would take the old phone and your Kit together.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              setDay(0)
              setSeen(true)
              setRun((r) => r + 1)
            }}
          >
            <RotateCcw className="h-4 w-4" /> Replay
          </Button>
          <Badge tone="warning">Demo · 7 days shown as 7 seconds</Badge>
        </div>
      </div>

      <Plate title="Lock-out · stolen phone">
        <p className="font-mono text-6xl font-semibold tabular-nums tracking-[-0.035em]">
          {DAYS - shown}
          <span className="ml-2 font-sans text-lg tracking-normal text-hero-muted">{DAYS - shown === 1 ? 'day' : 'days'} left</span>
        </p>
        <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden>
          {Array.from({ length: DAYS }, (_, i) => (
            <span key={i} className={`h-6 rounded-[3px] transition-colors duration-300 ${i < shown ? 'bg-accent' : 'bg-hero-2'}`} />
          ))}
        </div>
        <ol className="mt-5" aria-live="polite">
          {events.map((event) => {
            const visible = shown >= event.at
            return (
              <li
                key={event.when}
                className={`border-t border-hero-2 py-3 text-sm transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
                aria-hidden={!visible}
              >
                <span className="token mr-3 text-hero-muted">{event.when}</span>
                {event.text}
                {event.refused && (
                  <span className="mt-2 flex items-center gap-2">
                    <span className="flex gap-1" aria-hidden>
                      <FactorSquare factor="phone" tone="hero" size="sm" />
                      <span className="h-2 w-2 ring-1 ring-inset ring-hero-muted" />
                    </span>
                    <ShieldX className="h-4 w-4 text-danger" aria-hidden />
                    <span className="font-semibold">Refused by your Account</span>
                    <span className="font-mono text-xs text-hero-muted">GS020 · 1 of 2 factors</span>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </Plate>
    </div>
  )
}
