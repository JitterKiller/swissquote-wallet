'use client'

import { BadgeCheck, ClipboardPaste, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getAddress, isAddress } from 'viem'

import { Field, Input } from '@/components/ui/field'
import { Spinner } from '@/components/ui/feedback'
import { looksLikeHandle, normalizeHandle, resolveHandle } from '@/lib/handles'
import { cleanRecipient } from '@/lib/inputs'
import { getSession } from '@/lib/session'

/**
 * Recipient input for the send flow (PDR-010, issue #20; integrated by #12).
 * Accepts a 0x address or an `@handle`. A handle is resolved for the signed-in client and shows
 * the masked verified name before anything is signed; an unknown 0x address shows a warning.
 */
export type Recipient = {
  address: `0x${string}`
  handle?: string
  maskedName?: string
  verified: boolean
}

export function RecipientField({
  value,
  onChange,
  onRecipient,
}: {
  value: string
  onChange: (raw: string) => void
  /** The resolved recipient, or null while the input is invalid or resolving. */
  onRecipient: (recipient: Recipient | null) => void
}) {
  const raw = value.trim()
  const session = getSession()
  // Synchronous cases are derived during render; only a handle needs an async lookup.
  const local: { recipient: Recipient | null; error: string | null } | 'lookup' = !raw
    ? { recipient: null, error: null }
    : isAddress(raw)
      ? { recipient: { address: getAddress(raw), verified: false }, error: null }
      : !looksLikeHandle(raw)
        ? { recipient: null, error: 'Enter a 0x address or an @handle.' }
        : !session
          ? { recipient: null, error: 'Sign in with Swissquote to pay an @handle.' }
          : 'lookup'

  const [lookup, setLookup] = useState<{ key: string; recipient: Recipient | null; error: string | null } | null>(null)
  const resolving = local === 'lookup' && lookup?.key !== raw
  const current = local === 'lookup' ? (resolving ? { recipient: null, error: null } : lookup!) : local
  const { recipient, error } = current

  useEffect(() => {
    if (local !== 'lookup' || !session) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const resolved = await resolveHandle(session.clientId, raw)
        if (!cancelled) {
          setLookup({
            key: raw,
            recipient: { address: resolved.account, handle: resolved.handle, maskedName: resolved.maskedName, verified: true },
            error: null,
          })
        }
      } catch (e) {
        if (!cancelled) setLookup({ key: raw, recipient: null, error: e instanceof Error ? e.message : 'Lookup failed' })
      }
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Re-run only when the input or the signed-in client changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, local === 'lookup', session?.clientId])

  const published = recipient ? `${recipient.address}:${recipient.verified}` : ''
  useEffect(() => {
    onRecipient(recipient)
    // Notify the parent when the resolved recipient changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published])

  return (
    <Field label="Recipient" htmlFor="to" error={error} hint={!recipient && !error ? 'A 0x address on Base Sepolia, or an @handle.' : undefined}>
      <div className="relative">
        <Input
          id="to"
          placeholder="0x… or @handle"
          value={value}
          onChange={(e) => onChange(cleanRecipient(e.target.value))}
          className="pr-24 font-mono"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={async () => {
            try {
              onChange(cleanRecipient(await navigator.clipboard.readText()))
            } catch {}
          }}
          className="absolute right-1.5 top-1.5 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> Paste
        </button>
      </div>
      {resolving && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <Spinner className="h-3.5 w-3.5" /> Looking up @{normalizeHandle(value)}…
        </p>
      )}
      {recipient?.verified && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-sm">
          <BadgeCheck className="h-4 w-4 shrink-0 text-success" />
          <span>
            <span className="font-medium">{recipient.maskedName}</span>
            <span className="text-muted"> · verified Swissquote client · @{recipient.handle}</span>
          </span>
        </div>
      )}
      {recipient && !recipient.verified && (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm">
          <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />
          <span className="text-muted">Unverified recipient. Check every character of this address before sending.</span>
        </div>
      )}
    </Field>
  )
}
