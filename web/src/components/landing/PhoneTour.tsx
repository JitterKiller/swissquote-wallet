'use client'

import { BadgeCheck, Check, FingerprintPattern } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'

import { LogoMark } from '@/components/shell/Logo'
import { ApprovalSquares, FactorSquare } from '@/components/ui/factor'
import { Badge } from '@/components/ui/feedback'

const CHAPTERS = [
  { label: 'Create', text: 'Face ID makes the key' },
  { label: 'Protect', text: 'A Recovery Kit and a daily limit' },
  { label: 'Pay', text: 'An @handle, with a verified name' },
  { label: 'Lock out', text: 'A stolen phone, refused' },
] as const

// A chapter lasts four candles of the onboarding chart (one every 1.6s): `.animate-tour` in globals.css.

/** How high the phone floats above the baseline, and over how much scroll it lands. */
const LIFT = 72
const LAND = 260
/** On load the phone drops in from this much higher, fading in, to its floating position. */
const ENTRY = 48

const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  )
}

/**
 * The landing's signature: a SQure phone standing on the candle chart's baseline, two chapter
 * ticks on each side. The active tick fills over four candles, then the next chapter slides in;
 * hovering, focusing or leaving the screen pauses it, a click jumps. Reduced motion: no
 * auto-advance, the ticks still switch screens. The screens are demonstration content.
 */
export function PhoneTour() {
  const [active, setActive] = useState(0)
  const [cycle, setCycle] = useState(0)
  const [held, setHeld] = useState(false)
  const [offscreen, setOffscreen] = useState(false)
  const reduced = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const phone = useRef<HTMLDivElement>(null)

  // The phone floats up to LIFT px above the chart's baseline and lands on it over the first
  // LAND px of scroll: transform only, read once per frame, nothing under reduced motion.
  useEffect(() => {
    const box = stage.current
    const device = phone.current
    if (!box || !device) return
    if (reduced) {
      device.style.transform = ''
      return
    }
    let lift = 0
    let frame = 0
    const apply = () => {
      frame = 0
      const t = Math.min(1, Math.max(0, window.scrollY / LAND))
      // Smoothstep: the phone follows the scroll evenly and settles softly on the baseline.
      const landed = t * t * (3 - 2 * t)
      device.style.transform = `translate3d(0, ${(-lift * (1 - landed)).toFixed(1)}px, 0)`
    }
    const measure = () => {
      lift = Math.max(0, Math.min(LIFT, box.clientHeight - device.offsetHeight))
      apply()
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply)
    }
    // On load the phone drops in from ENTRY px higher while it fades in, to its floating position;
    // after that it follows the scroll 1:1.
    measure()
    device.style.transition = 'none'
    device.style.transform = `translate3d(0, ${-(lift + ENTRY)}px, 0)`
    void device.offsetHeight
    device.style.transition = 'transform 900ms var(--ease-out), opacity 600ms var(--ease-out)'
    device.style.opacity = '1'
    apply()
    const settle = window.setTimeout(() => (device.style.transition = ''), 950)
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    ro.observe(device)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(settle)
      ro.disconnect()
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [reduced])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const go = (index: number) => {
    setActive(index)
    setCycle((c) => c + 1)
  }
  const paused = held || offscreen

  return (
    <div
      ref={root}
      className="relative z-10 flex flex-1 flex-col"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      {/* The stage lets the pointer through to the chart; only the phone takes it. */}
      <div
        ref={stage}
        style={{ '--phone-h': 'clamp(360px, calc(100svh - 520px), 440px)' } as CSSProperties}
        className="pointer-events-none relative mt-6 flex min-h-[calc(var(--phone-h)+72px)] flex-1 items-end justify-center px-5"
      >
        <div ref={phone} className="will-change-transform motion-safe:opacity-0">
          <Phone active={active} />
        </div>
      </div>

      <div
        role="tablist"
        aria-label="How SQure works"
        className="relative mx-auto grid w-full max-w-7xl grid-cols-4 border-t border-hero-2 px-5 sm:px-6 lg:grid-cols-[1fr_1fr_300px_1fr_1fr] lg:px-10"
      >
        {CHAPTERS.map((chapter, i) => {
          const on = i === active
          return (
            <button
              key={chapter.label}
              type="button"
              role="tab"
              id={`tour-tab-${i}`}
              aria-selected={on}
              aria-controls="tour-screen"
              onClick={() => go(i)}
              className={`group relative py-4 pr-3 text-left transition-colors duration-150 ${i === 2 ? 'lg:col-start-4' : ''}`}
            >
              <span className="absolute inset-x-0 -top-px h-0.5 bg-hero-2" aria-hidden />
              {on && (
                <span
                  key={`${i}-${cycle}`}
                  aria-hidden
                  className={`absolute inset-x-0 -top-px h-0.5 origin-left bg-accent ${reduced ? '' : 'animate-tour'}`}
                  style={reduced ? undefined : { animationPlayState: paused ? 'paused' : 'running' }}
                  onAnimationEnd={() => !reduced && go((i + 1) % CHAPTERS.length)}
                />
              )}
              <span className={`token block ${on ? 'text-accent' : 'text-hero-muted group-hover:text-hero-fg'}`}>
                0{i + 1}
                <span className="max-sm:hidden"> · {chapter.label}</span>
              </span>
              <span className={`mt-1 block text-sm leading-snug max-sm:hidden ${on ? 'text-hero-fg' : 'text-hero-muted'}`}>
                {chapter.text}
              </span>
              <span className={`mt-1 block text-xs sm:hidden ${on ? 'text-hero-fg' : 'text-hero-muted'}`}>{chapter.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** A crisp device (DESIGN.md caps rectangles at 12px) whose screens slide on one track. */
function Phone({ active }: { active: number }) {
  return (
    <div className="pointer-events-auto relative h-[var(--phone-h)] w-[300px] shrink-0 overflow-hidden rounded-3xl border-8 border-hero-2 bg-surface text-foreground">
      <div className="flex items-center justify-between px-4 pt-3 text-[11px] font-semibold">
        <span className="tabular-nums">9:41</span>
        <span className="flex items-center gap-1.5">
          <LogoMark className="h-3.5 w-3.5" />
          SQure
        </span>
        <Badge tone="warning">Demo</Badge>
      </div>
      <div
        id="tour-screen"
        role="tabpanel"
        aria-labelledby={`tour-tab-${active}`}
        className="relative mt-3 h-[calc(100%-2.25rem)] overflow-hidden"
      >
        <div
          className="flex h-full transition-transform duration-500 ease-[var(--ease-out)]"
          style={{ transform: `translateX(-${active * 100}%)` }}
        >
          {[<CreateScreen key="create" />, <ProtectScreen key="protect" />, <PayScreen key="pay" />, <LockOutScreen key="lock" live={active === 3} />].map(
            (screen, i) => (
              <div key={i} className="h-full w-full shrink-0 px-4" aria-hidden={i !== active} inert={i !== active}>
                {screen}
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function ScreenTitle({ children, sub }: { children: string; sub?: string }) {
  return (
    <div>
      <p className="text-[22px] font-semibold leading-[1.05] tracking-[-0.035em]">{children}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function CreateScreen() {
  return (
    <div className="flex h-full flex-col">
      <ScreenTitle sub="One Face ID. No seed phrase to write down.">Create your wallet</ScreenTitle>
      <p className="mt-4 text-xs font-medium">Your name</p>
      <div className="mt-1.5 flex h-10 items-center rounded-xl border border-border px-3 text-sm">Adam</div>
      <div className="mt-3 flex h-10 items-center justify-center gap-2 rounded-control bg-accent text-sm font-semibold text-accent-fg">
        <FingerprintPattern className="h-4 w-4" /> Create wallet with passkey
      </div>
      <div className="mt-auto mb-4 rounded-2xl border border-border bg-surface-2 p-4 text-center">
        <FingerprintPattern className="mx-auto h-8 w-8 text-accent-ink" />
        <p className="mt-2 text-sm font-semibold">Use Face ID to create your key</p>
        <p className="mt-0.5 text-xs text-muted">It is made in this phone&apos;s secure chip and never leaves it.</p>
      </div>
    </div>
  )
}

function ProtectScreen() {
  return (
    <div className="flex h-full flex-col gap-3">
      <ScreenTitle>Choose your daily limit</ScreenTitle>
      <div className="flex h-12 items-center justify-between rounded-xl border-[1.5px] border-foreground px-3">
        <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">250</span>
        <span className="token text-muted">USDC / day</span>
      </div>
      <div className="rounded-2xl bg-accent-soft p-3">
        <p className="text-[11px] text-foreground/75">If your phone is stolen, a thief can take at most</p>
        <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
          2,000.00 <span className="font-sans text-xs">USDC</span>
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className={`h-3.5 flex-1 rounded-[3px] ${i === 0 ? 'bg-accent' : 'bg-accent/45'}`} />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-hero-2 bg-hero p-3 text-hero-fg">
        <p className="token text-hero-muted">Face ID will approve</p>
        <dl className="mt-2 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2 border-b border-hero-2 pb-1.5">
            <dt className="flex items-center gap-1.5 text-hero-muted">
              <ApprovalSquares kit tone="hero" size="sm" /> Owners
            </dt>
            <dd>Only you: this phone and your Kit</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-hero-muted">
              <FactorSquare factor="phone" tone="hero" size="sm" /> Face ID alone
            </dt>
            <dd className="tabular-nums">Up to 250 USDC a day</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

function PayScreen() {
  return (
    <div className="flex h-full flex-col gap-3">
      <ScreenTitle>Pay by @handle</ScreenTitle>
      <div className="rounded-xl border border-border px-3 py-2.5">
        <p className="font-mono text-sm">@lea</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-success">
          <BadgeCheck className="h-3.5 w-3.5" /> Léa M. · verified Swissquote client
        </p>
      </div>
      <div className="flex h-10 items-center justify-between rounded-xl border border-border px-3">
        <span className="font-mono text-sm tabular-nums">20.00</span>
        <span className="token text-muted">USDC</span>
      </div>
      <ul className="space-y-1.5 text-xs">
        {['Not on any sanctions list', 'Simulation: this payment would succeed', 'Network fee 0.00, covered by Swissquote'].map((line) => (
          <li key={line} className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 shrink-0 text-success" /> {line}
          </li>
        ))}
      </ul>
      <div className="mt-auto mb-4 flex h-10 items-center justify-center gap-2 rounded-control bg-accent text-sm font-semibold text-accent-fg">
        <FingerprintPattern className="h-4 w-4" /> Approve with biometrics
      </div>
    </div>
  )
}

function LockOutScreen({ live }: { live: boolean }) {
  const [left, setLeft] = useState(179)
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 179)), 1000)
    return () => clearInterval(id)
  }, [live])
  const lit = Math.round(((179 - left) / 179) * 10)
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-2xl border border-hero-2 bg-hero p-3.5 text-hero-fg">
        <p className="token flex items-center gap-1.5 text-hero-muted">
          <span className="h-1.5 w-1.5 bg-success" aria-hidden /> Lock-out · live onchain
        </p>
        <p className="mt-2 font-mono text-4xl font-semibold tabular-nums tracking-[-0.035em]">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </p>
        <p className="text-[11px] text-hero-muted">until the stolen phone is locked out</p>
        <div className="mt-3 grid grid-cols-10 gap-1" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`h-4 rounded-[3px] transition-colors duration-300 ${i < lit ? 'bg-accent' : 'bg-hero-2'}`} />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-danger/30 bg-danger-soft p-3">
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            <FactorSquare factor="phone" size="sm" />
            <span className="h-2 w-2 ring-1 ring-inset ring-foreground" />
          </span>
          <p className="text-sm font-semibold text-danger">Refused by your Account</p>
        </div>
        <p className="mt-1 font-mono text-[11px]">GS020 · 1 of 2 factors</p>
        <p className="mt-1 text-[11px] text-muted">The thief tried to cancel with the phone alone.</p>
      </div>
      <p className="mt-auto mb-4 text-center text-xs text-muted">Your Kit started it. Only the old phone and your Kit together could stop it.</p>
    </div>
  )
}
