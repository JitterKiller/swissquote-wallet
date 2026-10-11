'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatUnits } from 'viem'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/feedback'
import { balanceHistory, balanceSeries, BALANCE_RANGES, niceMax, type BalancePoint, type BalanceRange } from '@/lib/balanceHistory'
import { USDC_DECIMALS } from '@/lib/config'
import { formatDay, formatTime, formatUsdc, shortAddress } from '@/lib/format'

const HEIGHT = 200
const PAD = { top: 14, right: 14, bottom: 26, left: 52 }
const usdc = (amount: bigint) => Number(formatUnits(amount, USDC_DECIMALS))

const RANGE_CAPTION: Record<BalanceRange, string> = {
  '24h': 'in the last 24 hours',
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
  all: 'since your first transfer',
}

/** Balance over time, rebuilt from the Account's on-chain transfers (never sample data). */
export function BalanceHistoryCard() {
  const { chain, transfers } = useLoadedWallet()
  const [range, setRange] = useState<BalanceRange>('all')
  // Re-read the clock with each poll so "now" moves with the data, not with every render.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(id)
  }, [])

  const series = useMemo(() => {
    if (transfers === null || chain.balance === null) return null
    return balanceSeries(balanceHistory(transfers, chain.balance), chain.balance, range, now)
  }, [transfers, chain.balance, range, now])

  return (
    <Card>
      {/* The range control wraps under the title when the card is too narrow for both. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0 grow basis-64">
          <h2 className="font-semibold tracking-tight">Balance over time</h2>
          <p className="mt-0.5 text-sm text-muted">
            {series && series.points.every((pt) => !pt.transfer) && series.change === 0n && (transfers?.length ?? 0) === 0 ? (
              'No transfers yet'
            ) : series ? (
              <>
                <span className="whitespace-nowrap font-mono text-base font-medium tabular-nums text-foreground">
                  {series.change < 0n ? '−' : '+'}
                  {formatUsdc(series.change < 0n ? -series.change : series.change)} USDC
                </span>{' '}
                {RANGE_CAPTION[range]}
              </>
            ) : (
              'Reading your transfers from Base Sepolia…'
            )}
          </p>
        </div>
        <RangeControl value={range} onChange={setRange} />
      </div>
      <div className="px-2 pb-3 pt-4 sm:px-3">
        {series ? <BalanceChart series={series} /> : <Skeleton className="mx-3 h-[200px]" />}
      </div>
    </Card>
  )
}

function RangeControl({ value, onChange }: { value: BalanceRange; onChange: (range: BalanceRange) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Time range">
      {BALANCE_RANGES.map((r) => {
        const selected = r.id === value
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(r.id)}
            className={`h-8 rounded-lg border px-2.5 font-mono text-xs tabular-nums transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
              selected ? 'border-transparent bg-accent font-semibold text-accent-fg' : 'border-border bg-surface text-muted hover:bg-surface-2 hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
}

function pointLabel(point: BalancePoint, index: number, count: number) {
  if (point.transfer) {
    const { direction, amount, counterparty } = point.transfer
    return `${direction === 'in' ? '+' : '−'}${formatUsdc(amount)} ${direction === 'in' ? 'from' : 'to'} ${shortAddress(counterparty)}`
  }
  return index === count - 1 ? 'Now' : 'Start of range'
}

function when(t: number) {
  return `${formatDay(t)}, ${formatTime(t)}`
}

function BalanceChart({ series }: { series: ReturnType<typeof balanceSeries> }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { points, from, to } = series
  const values = points.map((p) => usdc(p.balance))
  const max = niceMax(Math.max(...values) * 1.15)
  const empty = values.every((v) => v === 0) && points.every((p) => !p.transfer)
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (t: number) => PAD.left + ((t - from) / Math.max(1, to - from)) * plotW
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH
  const baseline = y(0)

  // Step after: the balance holds until the next transfer moves it.
  let line = ''
  points.forEach((p, i) => {
    const px = x(p.t)
    const py = y(values[i])
    line += i === 0 ? `M${px},${py}` : `H${px}V${py}`
  })
  const area = `${line}V${baseline}H${x(points[0].t)}Z`

  const span = to - from
  const ticksX = [0, 1 / 3, 2 / 3, 1].map((f) => from + f * span)
  const tickLabel = (t: number) =>
    span <= 2 * 86_400_000 ? formatTime(t) : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  // Without any balance there is nothing to measure: keep only the baseline.
  const ticksY = empty ? [0] : [0, max / 2, max]

  const nearest = (px: number) => {
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px)) best = i
    })
    return best
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setActive(nearest(e.clientX - rect.left))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const step = e.key === 'ArrowLeft' ? -1 : 1
      setActive((i) => Math.min(points.length - 1, Math.max(0, (i ?? points.length - 1) + step)))
    } else if (e.key === 'Escape') setActive(null)
  }

  const shown = active !== null && active < points.length ? active : null
  const last = points.length - 1
  const summary = `Balance from ${formatUsdc(points[0].balance)} to ${formatUsdc(points[last].balance)} USDC, ${points.length - 2} transfers in this range. Use the arrow keys to read each one.`

  return (
    <div
      ref={box}
      className="relative h-[200px] touch-pan-y rounded-lg outline-offset-2"
      tabIndex={0}
      aria-label={summary}
      onPointerMove={onMove}
      onPointerLeave={() => setActive(null)}
      onFocus={() => setActive((i) => i ?? last)}
      onBlur={() => setActive(null)}
      onKeyDown={onKey}
    >
      {width > 0 && (
        <svg width={width} height={HEIGHT} aria-hidden className="block overflow-visible">
          {ticksY.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.left - 10} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted font-mono text-[11px] tabular-nums">
                {v.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </text>
            </g>
          ))}
          {ticksX.map((t, i) => (
            <text
              key={i}
              x={x(t)}
              y={HEIGHT - 6}
              textAnchor={i === 0 ? 'start' : i === ticksX.length - 1 ? 'end' : 'middle'}
              className="fill-muted font-mono text-[11px] tabular-nums"
            >
              {tickLabel(t)}
            </text>
          ))}
          {!empty && <path d={area} fill="var(--accent)" fillOpacity={0.1} />}
          {/* Ember Ink on white, Pressed Orange on the dark surface: both clear 3:1 (dataviz validator). */}
          <path d={line} fill="none" className="stroke-accent-ink dark:stroke-accent-hover" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {shown !== null && (
            <line x1={x(points[shown].t)} x2={x(points[shown].t)} y1={PAD.top} y2={baseline} stroke="var(--muted)" strokeWidth={1} />
          )}
          <circle
            cx={x(points[shown ?? last].t)}
            cy={y(values[shown ?? last])}
            r={4}
            className="fill-accent-ink dark:fill-accent-hover"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        </svg>
      )}

      {empty && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-sm text-muted">
          Your balance over time appears after your first transfer.
        </p>
      )}

      {shown !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-xs"
          style={{
            left: Math.min(Math.max(x(points[shown].t), 96), width - 96),
            top: Math.max(0, y(values[shown]) - 64),
          }}
        >
          <p className="font-mono text-sm font-semibold tabular-nums">{formatUsdc(points[shown].balance)} USDC</p>
          <p className="mt-0.5 text-muted">
            {pointLabel(points[shown], shown, points.length)} · {when(points[shown].t)}
          </p>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {shown !== null ? `${formatUsdc(points[shown].balance)} USDC, ${pointLabel(points[shown], shown, points.length)}, ${when(points[shown].t)}` : ''}
      </p>
      <table className="sr-only">
        <caption>Balance after each transfer</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Transfer</th>
            <th scope="col">Balance</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={`${p.t}-${i}`}>
              <td>{when(p.t)}</td>
              <td>{pointLabel(p, i, points.length)}</td>
              <td>{formatUsdc(p.balance)} USDC</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
