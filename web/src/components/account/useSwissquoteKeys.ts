'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'

import type { AccountState } from '@/lib/account'
import { api } from '@/lib/api'
import type { Level } from '@/lib/config'
import { evictionLevel } from '@/lib/eviction'

export type SwissquoteKeys = { status: 'loading' } | { status: 'error' } | { status: 'ok'; guardian: Address; treasury: Address }

/** Swissquote's own addresses (guardian key, treasury): the level comes from them, and they must not be owners. */
export function useSwissquoteKeys() {
  const [keys, setKeys] = useState<SwissquoteKeys>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    api<{ guardian: Address; relayer: Address }>('/api/guardian')
      .then(({ guardian, relayer }) => !cancelled && setKeys({ status: 'ok', guardian, treasury: relayer }))
      .catch(() => !cancelled && setKeys({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])
  const retry = () => {
    setKeys({ status: 'loading' })
    setAttempt((a) => a + 1)
  }
  return { keys, retry }
}

/**
 * The level the chain enforces: 1 when Swissquote's guardian guards the lock-out, as the eviction API
 * reads it. Until Swissquote's key is known, a second guardian means level 1.
 */
export function chainLevel(state: Pick<AccountState, 'guardians'>, keys: SwissquoteKeys): Level {
  if (keys.status === 'ok') return evictionLevel(state, keys.guardian)
  return state.guardians.length > 1 ? 1 : 0
}
