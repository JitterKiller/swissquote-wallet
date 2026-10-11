import type { Metadata } from 'next'

import { SwapView } from '@/components/views/SwapView'

export const metadata: Metadata = { title: 'Swap' }

export default function Page() {
  return <SwapView />
}
