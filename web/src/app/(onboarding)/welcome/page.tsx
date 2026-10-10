import type { Metadata } from 'next'

import { CreateWalletView } from '@/components/views/CreateWalletView'

export const metadata: Metadata = { title: 'Create your wallet' }

export default function Page() {
  return <CreateWalletView />
}
