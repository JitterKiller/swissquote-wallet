'use client'

import {
  ArrowDownLeft,
  ArrowUpRight,
  AtSign,
  Clock,
  House,
  Landmark,
  Repeat,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'

import { useWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { Badge, Skeleton } from '@/components/ui/feedback'
import { TokenBar } from '@/components/ui/live'
import { getPendingEviction, isEvicted } from '@/lib/eviction'
import { loadLocalEviction, loadLocalRecovery } from '@/lib/storage'

import { Logo } from './Logo'
import { EvictionAlert, RecoveryAlert, RevokedScreen } from './SecurityBanners'

type NavItem = { href: string; label: string; icon: LucideIcon; soon?: boolean }

// The phone's tab bar keeps the five daily jobs; the rest stays one tap away on the Overview.
const MOBILE_TABS = ['/', '/send', '/receive', '/activity', '/security']

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: House },
  { href: '/send', label: 'Send', icon: ArrowUpRight },
  { href: '/receive', label: 'Receive', icon: ArrowDownLeft },
  { href: '/handle', label: 'Handle', icon: AtSign },
  { href: '/swissquote', label: 'Swissquote', icon: Landmark },
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
    if (ready && !wallet) router.replace(loadLocalEviction() ? '/lost' : loadLocalRecovery() ? '/recover' : '/welcome')
  }, [ready, wallet, router])

  if (!ready || !wallet) return <ShellSkeleton />

  if (chain.isOwner === false) {
    return (
      <RevokedScreen
        account={wallet.account && isEvicted(chain.account, wallet.address) ? wallet.account : null}
        onForget={() => {
          forget()
          router.replace('/welcome')
        }}
      />
    )
  }

  const lockOut = wallet.account ? getPendingEviction(chain.account, wallet.address) : null
  const initials = wallet.name.trim().slice(0, 2).toUpperCase() || 'SQ'
  const levelLabel = !wallet.account ? 'Not protected yet' : wallet.level === 1 ? 'Swissquote client · level 1' : 'Free · level 0'

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
        <div className="mt-auto space-y-4">
          <TokenBar tokens={[]} className="px-2" />
          <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-xs font-semibold text-accent-ink">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{wallet.name}</p>
              <p className="truncate text-xs text-muted">{levelLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3 lg:hidden">
        <Logo compact />
        <AddressPill address={wallet.account ?? wallet.address} />
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        {lockOut && (
          <div className="mb-6">
            <EvictionAlert pending={lockOut} />
          </div>
        )}
        {chain.recovery?.pending && (
          <div className="mb-6">
            <RecoveryAlert pending={chain.recovery.pending} />
          </div>
        )}
        {children}
      </main>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main"
      >
        {NAV.filter((item) => MOBILE_TABS.includes(item.href)).map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? 'font-semibold text-foreground' : 'text-muted'}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-accent-ink' : ''}`} />
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
      <span className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted">
        <Icon className="h-[18px] w-[18px]" />
        {item.label}
        <Badge className="ml-auto">Soon</Badge>
      </span>
    )
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
        active ? 'bg-surface-2 font-medium text-foreground' : 'text-muted hover:bg-surface-2 hover:text-foreground'
      }`}
    >
      <Icon className={`h-[18px] w-[18px] ${active ? 'text-accent-ink' : ''}`} />
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
      <main className="mx-auto w-full max-w-6xl space-y-6 px-5 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </main>
    </div>
  )
}
