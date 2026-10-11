import type { Metadata } from 'next'

import { RecoverView } from '@/components/views/RecoverView'

export const metadata: Metadata = { title: 'Recover your wallet' }

export default function Page() {
  return <RecoverView />
}
