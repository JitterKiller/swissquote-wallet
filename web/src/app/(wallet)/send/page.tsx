import type { Metadata } from 'next'

import { SendView } from '@/components/views/SendView'

// Client-only page: rendered after hydration by AppShell (see ../layout.tsx).
export const instant = false

export const metadata: Metadata = { title: 'Send' }

export default function Page() {
  return <SendView />
}
