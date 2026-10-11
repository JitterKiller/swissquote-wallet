import type { Metadata } from 'next'

import { SecurityView } from '@/components/views/SecurityView'

// Client-only page: rendered after hydration by AppShell (see ../layout.tsx).
export const instant = false

export const metadata: Metadata = { title: 'Security' }

export default function Page() {
  return <SecurityView />
}
