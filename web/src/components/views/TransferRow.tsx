import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import { ExplorerLink } from '@/components/ui/address'
import { Skeleton } from '@/components/ui/feedback'
import type { Transfer } from '@/lib/activity'
import { formatTime, formatUsdc, shortAddress } from '@/lib/format'

export function TransferRow({ transfer }: { transfer: Transfer }) {
  const incoming = transfer.direction === 'in'
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
          incoming ? 'bg-success-soft text-success' : 'bg-surface-2 text-foreground'
        }`}
      >
        {incoming ? <ArrowDownLeft className="h-[18px] w-[18px]" /> : <ArrowUpRight className="h-[18px] w-[18px]" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{incoming ? 'Received USDC' : 'Sent USDC'}</p>
        <p className="truncate text-xs text-muted">
          {incoming ? 'From' : 'To'} <span className="font-mono">{shortAddress(transfer.counterparty)}</span> ·{' '}
          {formatTime(transfer.timestamp)}
        </p>
      </div>
      <p className={`text-sm font-semibold tabular-nums ${incoming ? 'text-success' : ''}`}>
        {incoming ? '+' : '−'}
        {formatUsdc(transfer.amount)}
      </p>
      <ExplorerLink path={`tx/${transfer.txHash}`} label="View transaction" />
    </li>
  )
}

export function TransferRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-4 w-16" />
        </li>
      ))}
    </ul>
  )
}
