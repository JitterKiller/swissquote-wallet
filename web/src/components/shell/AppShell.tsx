'use client'

import {
  ArrowDownLeft,
  ArrowUpRight,
  AtSign,
  Clock,
  Ellipsis,
  House,
  Landmark,
  Repeat,
  ShieldCheck,
  type LucideIcon,
  Sprout,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

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
/** A phone tab bar holds five: four destinations, then More for the rest of NAV. */
const MOBILE_TABS = ['/', '/send', '/receive', '/activity']

const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: House },
  { href: '/send', label: 'Send', icon: ArrowUpRight },
  { href: '/receive', label: 'Receive', icon: ArrowDownLeft },
  { href: '/earn', label: 'Earn', icon: Sprout },
  { href: '/swap', label: 'Swap', icon: Repeat },
  { href: '/handle', label: 'Handle', icon: AtSign },
  { href: '/swissquote', label: 'Swissquote', icon: Landmark },
  { href: '/activity', label: 'Activity', icon: Clock },
  { href: '/security', label: 'Security', icon: ShieldCheck },
]

/** Authenticated layout: sidebar on desktop, top bar + tab bar on mobile. */
export function AppShell({ children }: { children: ReactNode }) {
  const { ready, wallet, chain, forget } = useWallet()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (ready && !wallet) router.replace(loadLocalEviction() ? '/lost' : loadLocalRecovery() ? '/recover' : '/start')
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

      <MobileTabBar pathname={pathname} />
    </div>
  )
}

const TABS = NAV.filter((item) => MOBILE_TABS.includes(item.href))
const MORE = NAV.filter((item) => !item.soon && !MOBILE_TABS.includes(item.href))

function MobileTabBar({ pathname }: { pathname: string }) {
  // Open on the page it was opened from: navigating anywhere closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === pathname
  const first = useRef<HTMLAnchorElement>(null)
  const moreActive = MORE.some((item) => isActive(pathname, item.href))

  useEffect(() => {
    if (!open) return
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenOn(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Pressed state on touch-down, at once (PressFeedback makes :active work on iOS).
  const tab = (active: boolean) =>
    `flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[11px] transition-transform duration-100 ease-out active:scale-[0.94] ${
      active ? 'font-semibold text-foreground' : 'text-muted'
    }`

  return (
    <>
      {/* Always mounted: open and close are CSS transitions, so a tap mid-way reverses from
          where the menu is, and it leaves along the path it came in. */}
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        className={`fixed inset-0 z-20 bg-black/25 transition-opacity duration-200 ease-[var(--ease-out)] lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpenOn(null)}
      />
      <nav
        data-tab-bar
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Main"
      >
        {/* Grows out of the More tab (bottom right) and shrinks back into it. */}
        <ul
          id="more-menu"
          inert={!open}
          className={`absolute bottom-full right-3 mb-2 w-56 origin-bottom-right overflow-hidden rounded-2xl border border-border bg-surface py-1 transition-[opacity,transform,visibility] duration-200 ease-[var(--ease-out)] ${
            open ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible translate-y-1 scale-95 opacity-0'
          }`}
        >
          {MORE.map((item, i) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  ref={i === 0 ? first : undefined}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-12 items-center gap-3 px-4 text-sm transition-colors duration-100 hover:bg-surface-2 active:bg-surface-2 ${
                    active ? 'font-semibold text-foreground' : 'text-foreground'
                  }`}
                >
                  <Icon className={`h-[18px] w-[18px] ${active ? 'text-accent-ink' : ''}`} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="grid grid-cols-5">
          {TABS.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={tab(active)} aria-current={active ? 'page' : undefined}>
                <Icon className={`h-5 w-5 ${active ? 'text-accent-ink' : ''}`} />
                {item.label}
              </Link>
            )
          })}
          <button
            type="button"
            className={tab(open || moreActive)}
            aria-expanded={open}
            aria-controls="more-menu"
            onClick={() => setOpenOn(open ? null : pathname)}
          >
            <Ellipsis className={`h-5 w-5 ${open || moreActive ? 'text-accent-ink' : ''}`} />
            More
          </button>
        </div>
      </nav>
    </>
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
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-[color,background-color,transform] duration-100 active:scale-[0.98] ${
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
