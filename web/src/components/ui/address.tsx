'use client'

import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { EXPLORER_URL } from '@/lib/config'
import { shortAddress } from '@/lib/format'

export function useCopy() {
  const [copied, setCopied] = useState(false)
  async function copy(text: string, label = 'Copied to clipboard') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(label)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not access the clipboard')
    }
  }
  return { copied, copy }
}

export function CopyButton({ value, label = 'Copy', className = '' }: { value: string; label?: string; className?: string }) {
  const { copied, copy } = useCopy()
  return (
    <button
      type="button"
      onClick={() => copy(value, 'Address copied')}
      className={`inline-flex items-center gap-1 rounded-md p-1 text-muted transition hover:text-foreground ${className}`}
      aria-label={label}
      title={label}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

export function ExplorerLink({ path, label = 'View on explorer', className = '' }: { path: string; label?: string; className?: string }) {
  return (
    <a
      href={`${EXPLORER_URL}/${path}`}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 text-muted transition hover:text-foreground ${className}`}
      aria-label={label}
      title={label}
    >
      <ExternalLink className="h-4 w-4" />
    </a>
  )
}

/** Short address + copy + explorer link. */
export function AddressPill({ address, tone = 'default' }: { address: string; tone?: 'default' | 'hero' }) {
  const styles =
    tone === 'hero'
      ? 'bg-hero-2 text-hero-fg [&_button]:text-hero-muted [&_a]:text-hero-muted [&_button:hover]:text-hero-fg [&_a:hover]:text-hero-fg'
      : 'bg-surface-2 text-foreground'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md py-1 pl-2.5 pr-1 font-mono text-xs ${styles}`}>
      {shortAddress(address)}
      <CopyButton value={address} label="Copy address" />
      <ExplorerLink path={`address/${address}`} />
    </span>
  )
}
