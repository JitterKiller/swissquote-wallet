import type { Metadata } from 'next'

import { ReceiveView } from '@/components/views/ReceiveView'

// Client-only page: rendered after hydration by AppShell (see ../layout.tsx).
export const instant = false

export const metadata: Metadata = { title: 'Receive' }

export default function Page() {
  return <ReceiveView />
}
