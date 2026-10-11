import type { Metadata } from 'next'

import { HandleView } from '@/components/views/HandleView'

// Client-only page: rendered after hydration by AppShell (see ../layout.tsx).
export const instant = false

export const metadata: Metadata = { title: 'Handle' }

export default function Page() {
  return <HandleView />
}
