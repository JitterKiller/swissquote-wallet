'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Address } from 'viem'

import { Skeleton } from '@/components/ui/feedback'
import { APPROVED_DAPPS, readDappPosition, type Dapp } from '@/lib/dapps'
import { formatUsdc } from '@/lib/format'

type Position = { dapp: Dapp; supplied: bigint; apy: number }

/** Positions in the approved dApps (PDR-025), refreshed every 30 s and whenever `refreshKey` changes. */
export function useEarnPositions(account: Address | null, refreshKey = 0) {
  const [state, setState] = useState<{ account: Address; positions: Position[] } | null>(null)
  useEffect(() => {
    if (!account) return
    let cancelled = false
    const load = () =>
      Promise.all(APPROVED_DAPPS.map(async (dapp) => ({ dapp, ...(await readDappPosition(dapp, account)) })))
        .then((positions) => !cancelled && setState({ account, positions }))
        .catch(() => {
          // RPC hiccup: keep the last values.
        })
    load()
    const id = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [account, refreshKey])
  return state && state.account === account ? state.positions : null
}

export const percent = (apy: number) => `${(apy * 100).toFixed(2)}%`

/** Earn summary on the Overview: what is lent to approved dApps, at what variable rate. */
export function EarnCard({ account }: { account: Address }) {
  const positions = useEarnPositions(account)
  const total = positions?.reduce((sum, p) => sum + p.supplied, 0n) ?? null
  const best = positions?.reduce((max, p) => Math.max(max, p.apy), 0) ?? 0

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Earn</h2>
        <Link href="/wallet/earn" className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink hover:underline">
          Open Earn <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      {positions === null ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : total === 0n ? (
        <p className="mt-1 text-sm text-muted">
          Lend idle USDC to an approved dApp from your Account. Aave and Compound pay up to{' '}
          <span className="font-mono tabular-nums">{percent(best)}</span> a year today, variable.
        </p>
      ) : (
        <>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight">
            {formatUsdc(total!)} <span className="font-sans text-base font-normal text-muted">USDC lent</span>
          </p>
          <ul className="mt-2 border-t border-border">
            {positions.map((p) => (
              <li key={p.dapp.id} className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-sm">
                <span>{p.dapp.name}</span>
                <span className="text-muted">
                  <span className="font-mono tabular-nums text-foreground">{formatUsdc(p.supplied)}</span> ·{' '}
                  <span className="font-mono tabular-nums">{percent(p.apy)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-xs text-muted">Testnet rates. Each move needs Face ID and your Kit.</p>
    </section>
  )
}
