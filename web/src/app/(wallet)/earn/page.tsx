import type { Metadata } from 'next'

import { EarnView } from '@/components/views/EarnView'

export const metadata: Metadata = { title: 'Earn' }

export default function Page() {
  return <EarnView />
}
