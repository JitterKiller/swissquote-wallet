import type { Metadata } from 'next'

import { SwissquoteView } from '@/components/views/SwissquoteView'

// Client-only page: rendered after hydration by AppShell (see ../layout.tsx).
export const instant = false

export const metadata: Metadata = { title: 'Swissquote account' }

export default function Page() {
  return <SwissquoteView />
}
