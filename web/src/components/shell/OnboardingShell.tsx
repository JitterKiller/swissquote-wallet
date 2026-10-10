import { FingerprintPattern, Landmark, ShieldCheck, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

import { Logo } from './Logo'

const POINTS = [
  {
    icon: FingerprintPattern,
    title: 'No seed phrase',
    text: 'Your key lives in your device’s secure chip, unlocked by Face ID or Touch ID.',
  },
  {
    icon: ShieldCheck,
    title: 'Your keys, your crypto',
    text: 'Swissquote can never move your funds. Not even to recover them on its own.',
  },
  {
    icon: Sparkles,
    title: 'No network fees',
    text: 'Gas is covered for you. You never need to buy ETH.',
  },
  {
    icon: Landmark,
    title: 'One tap from Swissquote',
    text: 'Recover access with your Recovery Kit and a Swissquote identity check.',
  },
]

/** Unauthenticated layout: brand panel on the left (desktop), content on the right. */
export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-hero p-10 text-hero-fg lg:flex lg:flex-col xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-3xl"
        />
        <Logo tone="hero" />
        <div className="relative mt-auto max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Your keys. Your crypto. One tap from Swissquote.
          </h1>
          <p className="mt-4 text-hero-muted">A self-custody wallet with the security of a Swiss bank.</p>
          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/8 text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-hero-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-hero-muted">Prototype · Base Sepolia testnet · not financial advice</p>
      </aside>

      <main className="flex flex-col px-4 py-6 sm:px-8 lg:px-12 lg:py-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  )
}
