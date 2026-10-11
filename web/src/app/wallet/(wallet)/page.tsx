import type { Metadata } from 'next'

import { OverviewView } from '@/components/views/OverviewView'

// Client-only page: rendered after hydration by AppShell (see ../layout.tsx).
export const instant = false

export const metadata: Metadata = { title: 'Overview' }

export default function Page() {
  return <OverviewView />
}
