'use client'

import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '@/lib/format'
import { getMyWallet, linkWallet, type RegisteredWallet } from '@/lib/registry'
import { clearSession, getSession, mockSignIn, type SwissquoteSession } from '@/lib/session'
import type { StoredWallet } from '@/lib/storage'

/**
 * Swissquote sign-in (MOCK session) and wallet link (registry, one Face ID). Shared by /handle and
 * /swissquote. Client-only pages: localStorage is available on the first render.
 */
export function useSwissquoteLink(wallet: StoredWallet) {
  const [session, setSession] = useState<SwissquoteSession | null>(() => getSession())
  const [linked, setLinked] = useState<RegisteredWallet | null>(null)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = useCallback(
    async (current: SwissquoteSession | null) => {
      const entry = current ? await getMyWallet(current.clientId).catch(() => null) : null
      return entry && entry.keySafe.toLowerCase() === wallet.address.toLowerCase() ? entry : null
    },
    [wallet.address],
  )

  useEffect(() => {
    let cancelled = false
    // Re-read the session each time: Next keeps a page alive while it is hidden (Activity, Cache
    // Components) and re-runs its effects when it shows again, possibly after a sign-in elsewhere.
    const current = getSession()
    lookup(current).then((entry) => {
      if (cancelled) return
      setSession(current)
      setLinked(entry)
      setChecked(true)
    })
    return () => {
      cancelled = true
    }
  }, [lookup, session])

  return {
    session,
    linked,
    checked,
    busy,
    error,
    signIn: (name: string) => setSession(mockSignIn(name)),
    signOut: () => {
      clearSession()
      setSession(null)
    },
    link: async () => {
      if (!session) return
      setBusy(true)
      setError(null)
      try {
        setLinked(await linkWallet({ clientId: session.clientId, displayName: session.displayName, wallet }))
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    },
  }
}

export type SwissquoteLink = ReturnType<typeof useSwissquoteLink>
