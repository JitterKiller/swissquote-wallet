'use client'

import { useState } from 'react'

import { clearAll, loadLocalRecovery, loadWallet, type StoredWallet } from '@/lib/storage'

import Dashboard from './Dashboard'
import Onboarding from './Onboarding'
import RecoverFlow from './RecoverFlow'
import RecoverySetup from './RecoverySetup'
import { Shell } from './ui'

type Screen = 'onboarding' | 'setup' | 'recover' | 'dashboard'

export default function WalletApp() {
  const [wallet, setWallet] = useState<StoredWallet | null>(() => loadWallet())
  const [screen, setScreen] = useState<Screen>(() =>
    loadWallet() ? 'dashboard' : loadLocalRecovery() ? 'recover' : 'onboarding',
  )

  return (
    <Shell>
      {screen === 'dashboard' && wallet && (
        <Dashboard
          wallet={wallet}
          onSetupRecovery={() => setScreen('setup')}
          onForget={() => {
            clearAll()
            setWallet(null)
            setScreen('onboarding')
          }}
        />
      )}
      {screen === 'setup' && wallet && (
        <RecoverySetup wallet={wallet} onDone={() => setScreen('dashboard')} />
      )}
      {screen === 'recover' && (
        <RecoverFlow
          onExit={() => setScreen('onboarding')}
          onRecovered={(recovered) => {
            setWallet(recovered)
            setScreen('dashboard')
          }}
        />
      )}
      {screen === 'onboarding' && (
        <Onboarding
          onCreated={(created) => {
            setWallet(created)
            setScreen('setup')
          }}
          onRecover={() => setScreen('recover')}
        />
      )}
    </Shell>
  )
}
