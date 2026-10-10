import type { Metadata } from 'next'

import { ProtectWalletView } from '@/components/views/ProtectWalletView'

export const metadata: Metadata = { title: 'Protect your wallet' }

export default function Page() {
  return <ProtectWalletView />
}
