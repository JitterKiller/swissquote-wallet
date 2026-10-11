'use client'

import { useSyncExternalStore } from 'react'

import { KIT_TEST_INTERVAL_DAYS } from '@/lib/config'
import { KIT_TESTED_EVENT, loadKitTestedAt, saveKitTestedAt } from '@/lib/storage'

const DAY = 86_400_000
const INTERVAL = KIT_TEST_INTERVAL_DAYS * DAY

function subscribe(onChange: () => void) {
  window.addEventListener(KIT_TESTED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(KIT_TESTED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/**
 * When this device last opened the Recovery Kit file with its passphrase (#9, PDR-016): at setup, in the
 * "Test your Kit" panel, or in "Phone lost or stolen?". Null before any test here. Every reader follows a
 * new test at once (the Overview reminder and the Security row live on different pages).
 */
export function useKitTestedAt() {
  return useSyncExternalStore(subscribe, () => loadKitTestedAt() ?? null, () => null)
}

/** Whole days since the last test, or null when this device never tested the Kit. */
export const daysSinceKitTest = (testedAt: number | null, now: number) => (testedAt === null ? null : Math.max(0, Math.floor((now - testedAt) / DAY)))

/** A test is due every 90 days, and right away on a device that never tested the Kit. */
export const kitTestDue = (testedAt: number | null, now: number) => testedAt === null || now - testedAt >= INTERVAL

/** When the next test falls due. */
export const nextKitTest = (testedAt: number) => testedAt + INTERVAL

/** Whole days until the next test (at least 1 while it isn't due); a clock read before the test counts from the test. */
export const daysUntilKitTest = (testedAt: number, now: number) => Math.max(1, Math.ceil((nextKitTest(testedAt) - Math.max(now, testedAt)) / DAY))

/** "Tested today", "Tested yesterday", "Tested 94 days ago", or "Not tested on this phone". */
export function kitTestedLabel(testedAt: number | null, now: number) {
  const days = daysSinceKitTest(testedAt, now)
  if (days === null) return 'Not tested on this phone'
  if (days === 0) return 'Tested today'
  if (days === 1) return 'Tested yesterday'
  return `Tested ${days} days ago`
}

/** Demo: moves the last test 90 days back, so the reminder shows live (labelled Demo where it is offered). */
export function skipKitTestInterval(testedAt: number | null) {
  saveKitTestedAt((testedAt ?? Date.now()) - INTERVAL)
}
