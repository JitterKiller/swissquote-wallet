'use client'

import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

import { CustodyExplorer } from '@/components/landing/CustodyExplorer'
import { LimitSimulator } from '@/components/landing/LimitSimulator'
import { PhoneTour } from '@/components/landing/PhoneTour'
import { TheftReplay } from '@/components/landing/TheftReplay'
import { useWallet } from '@/components/providers/WalletProvider'
import { Logo } from '@/components/shell/Logo'
import { ButtonLink } from '@/components/ui/button'
import { CandleField } from '@/components/ui/candle-field'
import { Badge } from '@/components/ui/feedback'
import { useBlockNumber } from '@/components/ui/live'
import {
  ACCOUNT_RECOVERY_MODULE,
  ALLOWANCE_MODULE_ADDRESS,
  EVICTION_DELAY_IS_DEMO,
  EXPLORER_URL,
  SAFE_PROXY_FACTORY_141,
  USDC_ADDRESS,
} from '@/lib/config'
import { shortAddress } from '@/lib/format'

/**
 * Landing for new visitors (/start, surface brief web-src-components-views-landingview-tsx): a SQure
 * phone standing on the live candle chart walks through create, protect, pay and lock-out; then
 * the proof, as toys and live chain facts. One action throughout: create a wallet.
 */
export function LandingView() {
  const { ready, wallet } = useWallet()
  const primary = ready && wallet ? { href: '/', label: 'Open your wallet' } : { href: '/welcome', label: 'Create your wallet' }

  return (
    <div className="bg-background text-foreground">
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-hero text-hero-fg">
        {/* The onboarding's candle chart, at page scale, under the phone and its chapters. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[56%]">
          <CandleField />
        </div>

        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-6 lg:px-10">
          <Logo tone="hero" compact />
          <nav aria-label="Landing" className="flex items-center gap-6 text-sm">
            <a href="#how" className="text-hero-muted transition-colors hover:text-hero-fg max-sm:hidden">
              How it works
            </a>
            <a href="#security" className="text-hero-muted transition-colors hover:text-hero-fg max-sm:hidden">
              Security
            </a>
            <ButtonLink href={primary.href} size="sm">
              {primary.label}
            </ButtonLink>
          </nav>
        </header>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-12 text-center sm:pt-16">
          <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.035em] sm:text-7xl lg:text-[80px]">
            Your keys. Swiss security.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-hero-muted">
            A self-custody wallet with no seed phrase and no ETH to buy, one tap from your Swissquote account. Swissquote never holds
            your funds.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <ButtonLink href={primary.href} size="lg">
              {primary.label}
            </ButtonLink>
            <Link href="/lost" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              Phone lost or stolen?
            </Link>
          </div>
        </div>

        <PhoneTour />
      </section>

      <ProofStrip />

      <section id="how" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-20 sm:px-6 lg:px-10 lg:py-28">
        <LimitSimulator />
      </section>

      <section id="security" className="scroll-mt-6 border-y border-border bg-surface-2">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 lg:px-10 lg:py-28">
          <CustodyExplorer />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-6 lg:px-10 lg:py-28">
        <TheftReplay />
      </section>

      <Features />
      <Verify />

      <section className="relative overflow-hidden bg-hero text-hero-fg">
        <div className="relative mx-auto flex max-w-7xl flex-col items-center px-5 pt-28 text-center sm:px-6 lg:px-10 lg:pt-36">
          <h2 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.035em] sm:text-7xl">One Face ID. No seed phrase.</h2>
          <p className="mt-5 max-w-lg text-lg text-hero-muted">Face ID makes your key. Your Recovery Kit and a daily limit protect it.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <ButtonLink href={primary.href} size="lg">
              {primary.label}
            </ButtonLink>
            <Link href="/lost" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
              Phone lost or stolen?
            </Link>
          </div>
        </div>
        <div aria-hidden className="relative mt-16 h-56 sm:h-72">
          <CandleField />
        </div>
        <footer className="relative border-t border-hero-2">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-6 text-xs text-hero-muted sm:px-6 lg:px-10">
            <Logo tone="hero" />
            <p>A prototype on Base Sepolia testnet. Swissquote-side features are mocked. Not financial advice.</p>
          </div>
        </footer>
      </section>
    </div>
  )
}

/** Facts the visitor can check, the block number live from Base Sepolia. */
function ProofStrip() {
  const { block, live } = useBlockNumber()
  const facts = [
    { label: 'Network fee', value: '0.00', note: 'Sponsored: 10 a month free, all for clients' },
    {
      label: 'Base Sepolia block',
      value: block === null ? '…' : block.toLocaleString('en-US'),
      note: (
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 ${live ? 'bg-success' : 'bg-muted'}`} aria-hidden />
          {live ? 'Live' : 'Connecting'}
        </span>
      ),
    },
    { label: 'Seed phrase', value: 'None', note: 'Face ID and a Recovery Kit instead', words: true },
    { label: 'Owners of your Account', value: '2 of 2', note: 'Your phone and your Kit. Never Swissquote' },
  ]
  return (
    <section aria-label="Live facts" className="border-b border-border">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 lg:grid-cols-4">
        {facts.map((fact, i) => (
          <div
            key={fact.label}
            className={`px-5 py-6 sm:px-6 lg:px-10 ${i % 2 === 1 ? 'border-l border-border' : ''} ${i >= 2 ? 'max-lg:border-t max-lg:border-border lg:border-l' : ''}`}
          >
            <dt className="text-xs text-muted">{fact.label}</dt>
            <dd className={`mt-1 text-2xl sm:text-3xl ${'words' in fact ? 'font-semibold tracking-[-0.035em]' : 'font-mono tabular-nums tracking-[-0.02em]'}`}>
              {fact.value}
            </dd>
            <dd className="mt-1 text-xs text-muted">{fact.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

const FEATURES: { title: string; text: string; fact?: string; mock?: boolean }[] = [
  { title: 'Pay by @handle', text: 'The payer sees your verified name before Face ID. Exact handles only: nobody can search for you.', fact: '@lea' },
  {
    title: 'One tap to and from Swissquote',
    text: 'Move money between your Swissquote account and your wallet. The travel rule is filled in for you.',
    mock: true,
  },
  {
    title: 'Checks before you sign',
    text: 'Sanctions screening, a readable simulation, look-alike addresses and large amounts, all before Face ID.',
  },
  { title: 'Earn on approved protocols', text: 'Lend on Aave v3 or Compound III. The risks come first, and every move needs your Kit.', fact: '2 of 2' },
  {
    title: 'Network fees sponsored',
    text: 'Swissquote pays the gas: 10 operations a month on the free wallet, all of them for linked clients, and every security step always. You never buy ETH.',
    fact: '0.00 ETH',
  },
]

function Features() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-6 lg:px-10 lg:py-28">
        <h2 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl">
          A bank&apos;s features. Without the custody.
        </h2>
        <ul className="mt-12 border-t border-border">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="grid gap-x-10 gap-y-1 border-b border-border py-6 sm:grid-cols-[16rem_minmax(0,1fr)_auto] sm:items-baseline">
              <h3 className="flex items-center gap-2 text-lg font-semibold tracking-[-0.02em]">
                {feature.title}
                {feature.mock && <Badge tone="warning">MOCK</Badge>}
              </h3>
              <p className="max-w-xl text-muted">{feature.text}</p>
              {feature.fact && <p className="font-mono text-sm tabular-nums text-foreground sm:text-right">{feature.fact}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const CONTRACTS = [
  { name: 'Safe proxy factory', role: 'Deploys your Account, a Safe smart account (v1.4.1)', address: SAFE_PROXY_FACTORY_141 },
  { name: 'Allowance Module', role: 'Lets Face ID spend up to your daily limit, and no more', address: ALLOWANCE_MODULE_ADDRESS },
  {
    name: 'Recovery module',
    role: EVICTION_DELAY_IS_DEMO
      ? 'Runs the lock-out of a lost or stolen phone. Testnet demo: a 3-minute delay (7 days, or 3 for clients, in production)'
      : 'Runs the lock-out of a lost or stolen phone',
    address: ACCOUNT_RECOVERY_MODULE[0],
  },
  { name: 'USDC', role: 'Circle test USDC, the money in your wallet', address: USDC_ADDRESS },
]

function Verify() {
  return (
    <section className="border-t border-border bg-surface-2">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:px-10 lg:py-28">
        <div>
          <h2 className="text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl">Don&apos;t trust us. Check.</h2>
          <p className="mt-4 max-w-md text-lg text-muted">
            Who can move your money is decided by audited contracts on Base Sepolia, not by a promise. Open them on Basescan.
          </p>
        </div>
        <ul className="border-t border-border">
          {CONTRACTS.map((contract) => (
            <li key={contract.name} className="border-b border-border">
              <a
                href={`${EXPLORER_URL}/address/${contract.address}`}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-6 py-4 transition-colors"
              >
                <span>
                  <span className="block font-medium">{contract.name}</span>
                  <span className="block text-sm text-muted">{contract.role}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 whitespace-nowrap font-mono text-xs text-muted group-hover:text-foreground">
                  {shortAddress(contract.address)}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
