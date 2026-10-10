'use client'

import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock,
  Landmark,
  Lock,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge, EmptyState, Skeleton } from '@/components/ui/feedback'
import { PageHeader } from '@/components/ui/page'
import { RECOVERY_DELAY_LABEL } from '@/lib/config'
import { formatUsdc, greeting } from '@/lib/format'

import { TransferRow, TransferRowsSkeleton } from './TransferRow'

export function OverviewView() {
  const { wallet } = useLoadedWallet()
  return (
    <div className="space-y-6">
      <PageHeader title={`${greeting()}, ${wallet.name}`} description="Your self-custody wallet at a glance." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <BalanceCard />
          <AssetsCard />
        </div>
        <div className="space-y-6">
          <SecurityStatusCard />
          <RecentActivityCard />
        </div>
      </div>
    </div>
  )
}

function BalanceCard() {
  const { wallet, chain } = useLoadedWallet()
  return (
    <section className="relative overflow-hidden rounded-3xl bg-hero p-6 text-hero-fg shadow-card sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-hero-muted">
          <Lock className="h-3.5 w-3.5" /> Self-custody · only you can move these funds
        </span>
        <span className="hidden sm:inline-flex">
          <AddressPill address={wallet.address} tone="hero" />
        </span>
      </div>
      <div className="relative mt-8">
        <p className="text-sm text-hero-muted">Total balance</p>
        {chain.balance === null ? (
          <Skeleton className="mt-2 h-12 w-48 bg-white/10" />
        ) : (
          <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">${formatUsdc(chain.balance)}</p>
        )}
        <p className="mt-2 text-sm text-hero-muted">
          {chain.balance === null ? '—' : `${formatUsdc(chain.balance)} USDC`} · Base Sepolia
        </p>
      </div>
      <div className="relative mt-8 grid max-w-md grid-cols-4 gap-2">
        <QuickAction href="/send" icon={ArrowUpRight} label="Send" primary />
        <QuickAction href="/receive" icon={ArrowDownLeft} label="Receive" />
        <QuickAction icon={Repeat} label="Swap" />
        <QuickAction icon={Landmark} label="Top up" />
      </div>
    </section>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href?: string
  icon: LucideIcon
  label: string
  primary?: boolean
}) {
  const circle = `grid h-12 w-12 place-items-center rounded-full transition ${
    primary ? 'bg-accent text-accent-fg group-hover:bg-accent-hover' : 'bg-white/10 text-hero-fg group-hover:bg-white/15'
  }`
  if (!href) {
    return (
      <span className="flex cursor-not-allowed flex-col items-center gap-2 opacity-50" title="Coming soon">
        <span className={circle}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs">{label}</span>
      </span>
    )
  }
  return (
    <Link href={href} className="group flex flex-col items-center gap-2">
      <span className={circle}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs">{label}</span>
    </Link>
  )
}

function AssetsCard() {
  const { chain } = useLoadedWallet()
  return (
    <Card>
      <CardHeader title="Assets" description="Held in your smart account on Base Sepolia." />
      <CardBody className="pt-3">
        <ul className="divide-y divide-border">
          <li className="flex items-center gap-3 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#2775ca] text-sm font-bold text-white">$</span>
            <div className="flex-1">
              <p className="text-sm font-medium">USD Coin</p>
              <p className="text-xs text-muted">USDC</p>
            </div>
            <div className="text-right">
              {chain.balance === null ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <>
                  <p className="text-sm font-semibold tabular-nums">{formatUsdc(chain.balance)} USDC</p>
                  <p className="text-xs text-muted tabular-nums">${formatUsdc(chain.balance)}</p>
                </>
              )}
            </div>
          </li>
          <li className="flex items-center gap-3 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-muted">
              Ξ
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">Ether</p>
              <p className="text-xs text-muted">Not needed: network fees are covered</p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-muted">0.00 ETH</p>
          </li>
        </ul>
      </CardBody>
    </Card>
  )
}

function SecurityStatusCard() {
  const { chain } = useLoadedWallet()
  const status = chain.recovery
  const protectedWallet = !!status && status.guardians.length > 0

  if (status === null) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardBody>
      </Card>
    )
  }

  if (!protectedWallet) {
    return (
      <Card className="border-warning/40">
        <CardHeader
          icon={<ShieldAlert className="h-[18px] w-[18px] text-warning" />}
          title="Recovery not set up"
          description="If you lose this device, you lose access to your wallet."
        />
        <CardBody>
          <ButtonLink href="/welcome/protect" className="w-full">
            Set up recovery
          </ButtonLink>
        </CardBody>
      </Card>
    )
  }

  const facts = [
    'Passkey on this device',
    `Recovery Kit + Swissquote (${status.threshold} of ${status.guardians.length})`,
    `${RECOVERY_DELAY_LABEL} delay, cancellable by you`,
  ]
  return (
    <Card>
      <CardHeader
        icon={<ShieldCheck className="h-[18px] w-[18px] text-success" />}
        title="Wallet protected"
        description="Recovery is set up. Swissquote can never act alone."
        action={<Badge tone="success">Protected</Badge>}
      />
      <CardBody className="space-y-2.5 pt-4">
        {facts.map((fact) => (
          <p key={fact} className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-success" /> {fact}
          </p>
        ))}
        <Link href="/security" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-ink">
          Manage security <ChevronRight className="h-4 w-4" />
        </Link>
      </CardBody>
    </Card>
  )
}

function RecentActivityCard() {
  const { transfers } = useLoadedWallet()
  return (
    <Card>
      <CardHeader
        title="Recent activity"
        action={
          <Link href="/activity" className="text-sm font-medium text-accent-ink">
            View all
          </Link>
        }
      />
      <CardBody className="pt-2">
        {transfers === null ? (
          <TransferRowsSkeleton />
        ) : transfers.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-5 w-5" />}
            title="No transactions yet"
            description="Receive USDC to get started."
            action={
              <ButtonLink href="/receive" variant="secondary" size="sm">
                Receive USDC
              </ButtonLink>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {transfers.slice(0, 5).map((t) => (
              <TransferRow key={t.id} transfer={t} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
