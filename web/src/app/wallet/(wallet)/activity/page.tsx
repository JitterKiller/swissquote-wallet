import type { Metadata } from 'next'

import { ActivityView } from '@/components/views/ActivityView'

// Client-only page: rendered after hydration by AppShell (see ../layout.tsx).
export const instant = false

export const metadata: Metadata = { title: 'Activity' }

export default function Page() {
  return <ActivityView />
}
