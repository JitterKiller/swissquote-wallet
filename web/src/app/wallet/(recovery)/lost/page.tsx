import type { Metadata } from 'next'

import { EvictionView } from '@/components/views/EvictionView'

export const metadata: Metadata = { title: 'Phone lost or stolen?' }

export default function Page() {
  return <EvictionView />
}
