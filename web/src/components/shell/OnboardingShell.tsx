import type { ReactNode } from 'react'

import { BlockField } from '@/components/ui/block-field'
import { LiveStrip, TokenBar } from '@/components/ui/live'

import { Logo } from './Logo'

/** Unauthenticated layout: ink panel with the live block field (desktop), content on the right. */
export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col bg-hero p-10 text-hero-fg lg:flex xl:p-12">
        <Logo tone="hero" />
        <div className="relative -mx-2 my-8 max-h-[340px] min-h-[200px] flex-1">
          <BlockField />
        </div>
        <h1 className="max-w-lg text-4xl font-semibold leading-[1.05] tracking-[-0.03em] xl:text-5xl">
          Your keys. Swiss security.
        </h1>
        <p className="mt-4 max-w-lg text-hero-muted">
          A self-custody wallet with the security of a Swiss bank. No seed phrase, no network fees, and Swissquote never
          holds your funds.
        </p>
        <LiveStrip className="mt-10" />
        <p className="mt-6 text-xs text-hero-muted">Prototype · Base Sepolia testnet · not financial advice</p>
      </aside>

      <main className="flex flex-col px-4 py-5 sm:px-8 lg:px-12 lg:py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 lg:hidden">
          <Logo />
          <TokenBar tokens={[]} />
        </div>
        <div className="mx-auto w-full max-w-md py-10 lg:max-w-[35rem] lg:pb-12 lg:pt-10">{children}</div>
      </main>
    </div>
  )
}
