'use client'

import { ArrowUpRight, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { ButtonLink } from '@/components/ui/button'
import { FactorSquare, type Factor as FactorCode } from '@/components/ui/factor'
import { Skeleton } from '@/components/ui/feedback'
import { EVICTION_DAYS, EVICTION_DELAY_IS_DEMO, EXPLORER_URL } from '@/lib/config'
import { formatUsdc } from '@/lib/format'

/**
 * Who can move the money (PDR-013, PDR-014), read on-chain: the phone and the Kit hold the
 * majority, Swissquote is at most a guardian. Factor codes: phone = orange fill, Kit = ink fill.
 */
export function CustodyCard() {
  const { wallet, chain } = useLoadedWallet()
  const state = chain.account

  if (!wallet.account) {
    return (
      <section className="rounded-2xl border border-border p-5">
        <h2 className="font-semibold">Not protected yet</h2>
        <p className="mt-1 text-sm text-muted">
          {'If you lose this phone, you lose this wallet. Protect it with a Recovery Kit and a daily limit.'}
        </p>
        <ButtonLink href="/wallet/welcome/protect" className="mt-4 w-full">
          Protect your wallet
        </ButtonLink>
      </section>
    )
  }

  if (!state) {
    return (
      <section className="space-y-3 rounded-2xl border border-border p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </section>
    )
  }

  const level = wallet.level ?? (state.guardians.length > 1 ? 1 : 0)
  const days = EVICTION_DAYS[level]
  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Wallet protected</h2>
        <span className="token text-muted">
          {state.threshold} of {state.owners.length} · yours
        </span>
      </div>
      <ul className="mt-3 border-t border-border">
        <Factor code="phone" name="This phone">
          Face ID, up to{' '}
          <span className="font-mono tabular-nums">{state.allowance ? formatUsdc(state.allowance.amount) : '…'}</span> USDC a
          day
        </Factor>
        <Factor code="kit" name="Recovery Kit">
          With the phone for anything above. Locks out a lost phone after {days} days
          {EVICTION_DELAY_IS_DEMO ? ' (3 min in this demo)' : ''}
        </Factor>
        {level === 1 && (
          <Factor code={null} name="Swissquote">
            Guardian: checks your identity before a lock-out. Never an owner
          </Factor>
        )}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/wallet/security" className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
          Who can do what <ChevronRight className="h-4 w-4" />
        </Link>
        <a
          href={`${EXPLORER_URL}/address/${wallet.account}#readProxyContract`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
        >
          Check the owners on Basescan <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </section>
  )
}

function Factor({ code, name, children }: { code: FactorCode | null; name: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[10px_1fr] items-baseline gap-x-3 border-b border-border py-2.5 text-sm">
      {code ? <FactorSquare factor={code} /> : <span aria-hidden />}
      <span>
        <span className="font-medium">{name}</span>
        <span className="block text-muted">{children}</span>
      </span>
    </li>
  )
}
