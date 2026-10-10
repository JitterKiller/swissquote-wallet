'use client'

import { useState } from 'react'

import { clearAll, loadWallet, type StoredWallet } from '@/lib/storage'

import Dashboard from './Dashboard'
import Onboarding from './Onboarding'
import { Shell } from './ui'

export default function WalletApp() {
  const [wallet, setWallet] = useState<StoredWallet | null>(() => loadWallet())

  return (
    <Shell>
      {wallet ? (
        <Dashboard
          wallet={wallet}
          onForget={() => {
            clearAll()
            setWallet(null)
          }}
        />
      ) : (
        <Onboarding onCreated={setWallet} />
      )}
    </Shell>
  )
}
