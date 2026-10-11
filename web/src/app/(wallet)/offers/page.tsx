import type { Metadata } from 'next'

import { OffersView } from '@/components/views/OffersView'

// Client-only page: rendered after hydration by AppShell (see ../layout.tsx).
export const instant = false

export const metadata: Metadata = { title: 'Offers' }

export default function Page() {
  return <OffersView />
}
