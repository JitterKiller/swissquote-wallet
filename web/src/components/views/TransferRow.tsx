import { ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react'

import { ExplorerLink } from '@/components/ui/address'
import { ApprovalSquares } from '@/components/ui/factor'
import { Skeleton } from '@/components/ui/feedback'
import type { Transfer } from '@/lib/activity'
import { ASSETS, formatAsset } from '@/lib/assets'
import { formatTime, formatUsdc, shortAddress } from '@/lib/format'

const VIA_LABEL: Record<NonNullable<Transfer['via']>, string> = {
  'face-id': 'Approved with Face ID alone',
  'face-id+kit': 'Approved with Face ID and your Recovery Kit',
  'face-id+key': 'Approved with Face ID and your security key',
}

/** Key for the factor squares on outgoing rows; shown once a list has some. */
export function ApprovalLegend({ transfers }: { transfers: Transfer[] }) {
  if (!transfers.some((t) => t.via)) return null
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <ApprovalSquares kit={false} size="sm" /> Face ID alone
      </span>
      <span className="inline-flex items-center gap-1.5">
        <ApprovalSquares kit size="sm" /> Face ID + Kit
      </span>
      {transfers.some((t) => t.via === 'face-id+key') && (
        <span className="inline-flex items-center gap-1.5">
          <ApprovalSquares kit second="key" size="sm" /> Face ID + key
        </span>
      )}
    </p>
  )
}

export function TransferRow({ transfer }: { transfer: Transfer }) {
  const incoming = transfer.direction === 'in'
  // A swap (ADR-032): the other asset instead of the pool's address, which means nothing to the owner.
  const other = transfer.swap ? ASSETS[transfer.swap.asset] : null
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          incoming && !other ? 'bg-success-soft text-success' : 'bg-surface-2 text-foreground'
        }`}
      >
        {other ? (
          <Repeat className="h-[18px] w-[18px]" />
        ) : incoming ? (
          <ArrowDownLeft className="h-[18px] w-[18px]" />
        ) : (
          <ArrowUpRight className="h-[18px] w-[18px]" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {other ? `Swapped ${incoming ? 'from' : 'to'} ${other.symbol}` : incoming ? 'Received USDC' : 'Sent USDC'}
          {transfer.via && (
            <span title={VIA_LABEL[transfer.via]} className="inline-flex">
              <ApprovalSquares kit={transfer.via !== 'face-id'} second={transfer.via === 'face-id+key' ? 'key' : 'kit'} size="sm" />
              <span className="sr-only">{VIA_LABEL[transfer.via]}</span>
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted">
          {other && transfer.swap ? (
            <>
              {incoming ? 'Gave' : 'Got'} <span className="font-mono">{formatAsset(transfer.swap.amount, other)}</span> {other.symbol}
              <span className="max-sm:hidden"> · Uniswap v3</span>
            </>
          ) : (
            <>
              {incoming ? 'From' : 'To'} <span className="font-mono">{shortAddress(transfer.counterparty)}</span>
            </>
          )}{' '}
          · {formatTime(transfer.timestamp)}
        </p>
      </div>
      <p className={`font-mono text-sm font-semibold tabular-nums ${incoming ? 'text-success' : ''}`}>
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
          <Skeleton className="h-9 w-9" />
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
