'use client'

import { ArrowDownLeft, ArrowUpRight, ChevronRight, Repeat, Sprout } from 'lucide-react'
import Link from 'next/link'

import { AllowanceMeter } from '@/components/account/AllowanceMeter'
import { otherBalancesLine, useAssetBalances } from '@/components/account/AssetBalances'
import { CustodyCard } from '@/components/account/CustodyCard'
import { EarnCard } from '@/components/account/EarnCard'
import { SwissquoteCard } from '@/components/account/SwissquoteCard'
import { SweepNotice } from '@/components/account/SweepNotice'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { ButtonLink } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { useBlockNumber } from '@/components/ui/live'
import { PageHeader } from '@/components/ui/page'
import { formatUsdc, greeting } from '@/lib/format'

import { BalanceHistoryCard } from './BalanceHistoryCard'
import { ApprovalLegend, TransferRow, TransferRowsSkeleton } from './TransferRow'

/**
 * Overview (issue #11, surface brief web-src-components-views-overviewview-tsx): the Account's
 * balance and today's Face ID budget first, then who holds the keys, activity, Earn and the
 * Swissquote account. One DOM: two columns on desktop, the brief's reading order on mobile.
 */
export function OverviewView() {
  const { wallet } = useLoadedWallet()
  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting()}, ${wallet.name}`} />
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <div className="contents lg:block lg:space-y-6">
          <div className="order-1">
            <AccountPlate />
          </div>
          <div className="order-2 empty:hidden">
            <SweepNotice />
          </div>
          <div className="order-2">
            <BalanceHistoryCard />
          </div>
          <div className="order-4">
            <ActivitySection />
          </div>
        </div>
        <div className="contents lg:block lg:space-y-6">
          <div className="order-3">
            <CustodyCard />
          </div>
          {wallet.account && (
            <div className="order-5">
              <EarnCard account={wallet.account} />
            </div>
          )}
          <div className="order-6">
            <SwissquoteCard wallet={wallet} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** The Account as an ink plate: it is live onchain (DESIGN.md, Ink Plate Rule). */
function AccountPlate() {
  const { wallet, chain } = useLoadedWallet()
  const { live } = useBlockNumber()
  const address = wallet.account ?? wallet.address
  const allowance = chain.account?.allowance ?? null
  // EURC and ETH from swaps (ADR-032), under the USDC balance when the Account holds some.
  const others = otherBalancesLine(useAssetBalances(wallet.account ?? null))

  return (
    <section className="rounded-2xl border border-hero-2 bg-hero p-5 text-hero-fg sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="token flex items-center gap-2 text-hero-muted">
          <span className={`h-1.5 w-1.5 ${live ? 'bg-success' : 'bg-hero-muted'}`} aria-hidden />
          {wallet.account ? 'Account · live onchain' : 'Wallet · this phone'}
        </p>
        {/* On phones the top bar already carries the address. */}
        <span className="hidden sm:inline-flex">
          <AddressPill address={address} tone="hero" />
        </span>
      </div>

      <p className="mt-6 text-sm text-hero-muted">Balance</p>
      {chain.balance === null ? (
        <Skeleton className="mt-2 h-12 w-56 bg-hero-2" />
      ) : (
        <p className="mt-1 font-mono text-5xl font-semibold tabular-nums tracking-[-0.04em] sm:text-6xl">
          {formatUsdc(chain.balance)} <span className="font-sans text-xl font-normal tracking-normal text-hero-muted">USDC</span>
        </p>
      )}
      {others && (
        <p className="mt-1 text-sm text-hero-muted">
          + <span className="font-mono tabular-nums">{others}</span>
        </p>
      )}
      {chain.balance === 0n && (
        <p className="mt-2 text-sm text-hero-muted">
          Add USDC: share your address from{' '}
          <Link href="/wallet/receive" className="text-hero-fg underline underline-offset-4">
            Receive
          </Link>{' '}
          or move money from your{' '}
          <Link href="/wallet/swissquote" className="text-hero-fg underline underline-offset-4">
            Swissquote account
          </Link>
          .
        </p>
      )}

      {allowance ? (
        <div className="mt-6">
          <AllowanceMeter
            allowance={allowance}
            action={
              <Link
                href="/wallet/security?change=limit"
                className="-my-3 inline-flex min-h-11 items-center px-1 font-medium text-hero-fg underline-offset-4 hover:underline"
              >
                Change
              </Link>
            }
          />
        </div>
      ) : wallet.account ? (
        <Skeleton className="mt-6 h-16 w-full bg-hero-2" />
      ) : null}

      <div className="mt-6 grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
        <ButtonLink href="/wallet/send" size="action">
          <ArrowUpRight className="h-5 w-5" /> Send
        </ButtonLink>
        <ButtonLink href="/wallet/receive" size="action" variant="hero">
          <ArrowDownLeft className="h-5 w-5" /> Receive
        </ButtonLink>
        <ButtonLink href="/wallet/swap" size="action" variant="hero">
          <Repeat className="h-5 w-5" /> Swap
        </ButtonLink>
        <ButtonLink href="/wallet/earn" size="action" variant="hero">
          <Sprout className="h-5 w-5" /> Earn
        </ButtonLink>
      </div>
    </section>
  )
}

function ActivitySection() {
  const { transfers } = useLoadedWallet()
  return (
    <section className="rounded-2xl border border-border">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
        <h2 className="font-semibold">Activity</h2>
        <Link href="/wallet/activity" className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="px-5 pb-2 pt-1">
        {transfers === null ? (
          <TransferRowsSkeleton />
        ) : transfers.length === 0 ? (
          <p className="py-6 text-sm text-muted">
            No transfers yet. Payments in and out of your Account will show here, read from the chain.
          </p>
        ) : (
          <>
            <ApprovalLegend transfers={transfers.slice(0, 5)} />
            <ul className="divide-y divide-border">
              {transfers.slice(0, 5).map((t) => (
                <TransferRow key={t.id} transfer={t} />
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
