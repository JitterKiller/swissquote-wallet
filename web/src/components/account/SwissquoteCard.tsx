'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { useSwissquoteLink } from '@/components/swissquote/useSwissquoteLink'
import { Badge, Skeleton } from '@/components/ui/feedback'
import { EVICTION_DAYS } from '@/lib/config'
import { formatUsdc } from '@/lib/format'
import type { StoredWallet } from '@/lib/storage'
import { getAccountOverview } from '@/lib/swissquoteAccount'

/**
 * The client's Swissquote account next to the wallet (PDR-024). MOCK balance; the moves
 * themselves live on /swissquote. Unlinked: what linking adds (level 1, PDR-015).
 */
export function SwissquoteCard({ wallet }: { wallet: StoredWallet }) {
  const link = useSwissquoteLink(wallet)
  const clientId = link.linked?.clientId ?? null
  const [overview, setOverview] = useState<{ clientId: string; balance: bigint } | null>(null)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    getAccountOverview(clientId)
      .then((data) => !cancelled && setOverview({ clientId, balance: BigInt(data.balance) }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [clientId])

  const balance = overview && overview.clientId === clientId ? overview.balance : null

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Swissquote account</h2>
        <Badge tone="warning">MOCK</Badge>
      </div>
      {!link.checked ? (
        <Skeleton className="mt-3 h-4 w-2/3" />
      ) : link.linked ? (
        <>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight">
            {balance === null ? '…' : formatUsdc(balance)}{' '}
            <span className="font-sans text-base font-normal text-muted">USDC</span>
          </p>
          <p className="mt-1 text-sm text-muted">{link.linked.maskedName} · linked to this wallet</p>
          <Link href="/wallet/swissquote" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
            Move money <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Link your Swissquote account: one-tap transfers, an @handle and all network fees covered. Then, with your Kit, a stolen phone can be
            locked out after {EVICTION_DAYS[1]} days instead of {EVICTION_DAYS[0]}.
          </p>
          <Link href="/wallet/swissquote" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
            Link with Face ID <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </>
      )}
    </section>
  )
}
