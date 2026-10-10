'use client'

import dynamic from 'next/dynamic'

import { Shell } from './ui'

// The wallet relies on WebAuthn and localStorage: render it in the browser only.
const WalletApp = dynamic(() => import('./WalletApp'), {
  ssr: false,
  loading: () => <Shell />,
})

export default function ClientApp() {
  return <WalletApp />
}
