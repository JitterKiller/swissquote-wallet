'use client'

import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  House,
  Repeat,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

import { useWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { Skeleton } from '@/components/ui/feedback'
import { loadLocalRecovery } from '@/lib/storage'

import { Logo } from './Logo'
import { RecoveryAlert, RevokedScreen } from './SecurityBanners'

type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean }

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: House },
  { href: '/send', label: 'Send', icon: ArrowUpRight },
  { href: '/receive', label: 'Receive', icon: ArrowDownLeft },
  { href: '/swap', label: 'Swap', icon: Repeat, soon: true },
  { href: '/activity', label: 'Activity', icon: Clock },
  { href: '/security', label: 'Security', icon: ShieldCheck },
]

/** Authenticated layout: sidebar on desktop, top bar + tab bar on mobile. */
export function AppShell({ children }: { children: ReactNode }) {
  const { ready, wallet, chain, forget } = useWallet()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (ready && !wallet) router.replace(loadLocalRecovery() ? '/recover' : '/welcome')
  }, [ready, wallet, router])

  if (!ready || !wallet) return <ShellSkeleton />

  if (chain.isOwner === false) {
    return (
      <RevokedScreen
        onForget={() => {
          forget()
          router.replace('/welcome')
        }}
      />
    )
  }

  const initials = wallet.name.trim().slice(0, 2).toUpperCase() || 'SQ'

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-surface px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 space-y-1" aria-label="Main">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-success" />
            Base Sepolia · Testnet
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{wallet.name}</p>
              <p className="text-xs text-muted">Self-custody wallet</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <AddressPill address={wallet.address} />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        {chain.recovery?.pending && (
          <div className="mb-6">
            <RecoveryAlert pending={chain.recovery.pending} />
          </div>
        )}
        {children}
      </main>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Main"
      >
        {NAV.filter((item) => !item.soon).map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? 'text-accent' : 'text-muted'}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  if (item.soon) {
    return (
      <span className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted/70">
        <Icon className="h-[18px] w-[18px]" />
        {item.label}
        <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
          Soon
        </span>
      </span>
    )
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
        active ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-surface-2 hover:text-foreground'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
      {item.label}
    </Link>
  )
}

function ShellSkeleton() {
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-surface px-4 py-5 lg:block">
        <div className="px-2">
          <Logo />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </main>
    </div>
  )
}
