'use client'

import { useEffect, useState } from 'react'

import { currentBlock } from '@/lib/activity'

/** Latest Base Sepolia block, polled every few seconds. `live` turns false after a missed poll. */
export function useBlockNumber(intervalMs = 8_000) {
  const [state, setState] = useState<{ block: bigint | null; live: boolean }>({ block: null, live: false })
  useEffect(() => {
    let cancelled = false
    const poll = () =>
      currentBlock()
        .then((block) => !cancelled && setState({ block, live: true }))
        .catch(() => !cancelled && setState((s) => ({ ...s, live: false })))
    poll()
    const id = setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])
  return state
}

/** Mono status tokens: network facts the visitor can verify, never decoration. */
export function TokenBar({ tokens, className = '' }: { tokens: string[]; className?: string }) {
  const { block, live } = useBlockNumber()
  return (
    <div className={`token flex flex-wrap items-center gap-x-3 gap-y-1 text-muted ${className}`}>
      {tokens.map((token) => (
        <span key={token} className="after:ml-3 after:content-['·']">
          {token}
        </span>
      ))}
      <span>Base Sepolia</span>
      {block !== null && <span className="tabular-nums">Block {block.toLocaleString('en-US')}</span>}
      <span className={`inline-flex items-center gap-1.5 ${live ? 'text-success' : ''}`}>
        <span className={`h-1.5 w-1.5 ${live ? 'bg-success' : 'bg-muted'}`} aria-hidden />
        {live ? 'Live' : 'Connecting'}
      </span>
    </div>
  )
}

/** The ink panel's live strip: three verifiable facts in large mono figures. */
export function LiveStrip({ className = '' }: { className?: string }) {
  const { block, live } = useBlockNumber()
  return (
    <dl className={`grid grid-cols-3 gap-4 border-t border-hero-2 pt-4 ${className}`}>
      <div>
        <dt className="text-xs text-hero-muted">Network fee</dt>
        <dd className="mt-1 font-mono text-xl tabular-nums">0.00</dd>
      </div>
      <div>
        <dt className="text-xs text-hero-muted">Base Sepolia block</dt>
        <dd className="mt-1 font-mono text-xl tabular-nums">{block === null ? '…' : block.toLocaleString('en-US')}</dd>
      </div>
      <div>
        <dt className="text-xs text-hero-muted">Status</dt>
        <dd className="mt-1 flex items-center gap-2 font-mono text-xl">
          <span className={`h-2.5 w-2.5 ${live ? 'bg-success' : 'bg-hero-muted'}`} aria-hidden />
          {live ? 'Live' : 'Connecting'}
        </dd>
      </div>
    </dl>
  )
}
