'use client'

import { Clock } from 'lucide-react'
import { useState } from 'react'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardBody } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { PageHeader } from '@/components/ui/page'
import type { Transfer } from '@/lib/activity'
import { formatDay } from '@/lib/format'

import { TransferRow, TransferRowsSkeleton } from './TransferRow'

type Filter = 'all' | 'in' | 'out'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'Received' },
  { id: 'out', label: 'Sent' },
]

export function ActivityView() {
  const { transfers } = useLoadedWallet()
  const [filter, setFilter] = useState<Filter>('all')
  const visible = transfers?.filter((t) => filter === 'all' || t.direction === filter) ?? null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="USDC transfers, read directly from the blockchain."
        actions={
          <div className="inline-flex rounded-xl border border-border bg-surface p-1" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  filter === f.id ? 'bg-surface-2 font-medium' : 'text-muted hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />
      <Card>
        <CardBody>
          {visible === null ? (
            <TransferRowsSkeleton rows={5} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Clock className="h-5 w-5" />}
              title={filter === 'all' ? 'No transactions yet' : 'Nothing here yet'}
              description="Transfers appear here a few seconds after they are confirmed on-chain."
              action={
                <ButtonLink href="/receive" variant="secondary" size="sm">
                  Receive USDC
                </ButtonLink>
              }
            />
          ) : (
            <div className="space-y-6">
              {groupByDay(visible).map(([day, items]) => (
                <section key={day}>
                  <h2 className="text-xs font-medium uppercase tracking-wide text-muted">{day}</h2>
                  <ul className="mt-1 divide-y divide-border">
                    {items.map((t) => (
                      <TransferRow key={t.id} transfer={t} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function groupByDay(transfers: Transfer[]) {
  const groups = new Map<string, Transfer[]>()
  for (const t of transfers) {
    const day = formatDay(t.timestamp)
    groups.set(day, [...(groups.get(day) ?? []), t])
  }
  return [...groups.entries()]
}
