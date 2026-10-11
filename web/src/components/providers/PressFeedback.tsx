'use client'

import { useEffect } from 'react'

/**
 * iOS Safari only applies :active while a touch listener exists on the page, so without this the
 * pressed states (scale, dim) never show on an iPhone. Passive: it never delays scrolling.
 */
export function PressFeedback() {
  useEffect(() => {
    const noop = () => {}
    document.addEventListener('touchstart', noop, { passive: true })
    return () => document.removeEventListener('touchstart', noop)
  }, [])
  return null
}
