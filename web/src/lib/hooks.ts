'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

/** Current time, re-rendered every `intervalMs` (for countdowns). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const noopSubscribe = () => () => {}

/** false during SSR and hydration, true afterwards (browser-only UI gate). */
export function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
}
