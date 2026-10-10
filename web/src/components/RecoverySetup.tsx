'use client'

import { useState } from 'react'

import { api } from '@/lib/api'
import { RECOVERY_DELAY_LABEL } from '@/lib/config'
import { recoverySetupCalls } from '@/lib/recovery'
import { createRecoveryKit, downloadRecoveryKit } from '@/lib/recoveryKit'
import { toPublicKey, type StoredWallet } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

import { Button, Card, errorMessage } from './ui'

/**
 * Registers two guardians on the Safe in one gasless UserOp:
 *  - the Recovery Kit (key generated here, downloaded, never stored),
 *  - the Swissquote Guardian (signs only after identity verification).
 */
export default function RecoverySetup({
  wallet,
  onDone,
}: {
  wallet: StoredWallet
  onDone: () => void
}) {
  const [kit] = useState(() => createRecoveryKit(wallet.address))
  const [downloaded, setDownloaded] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [step, setStep] = useState<SendStep | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function activate() {
    setError(null)
    try {
      setStep('preparing')
      const { guardian } = await api<{ guardian: string }>('/api/guardian')
      await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: recoverySetupCalls(wallet.address, kit.guardianAddress, guardian),
        onStep: setStep,
      })
      onDone()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  return (
    <>
      <div className="mt-2 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Protect your wallet</h1>
        <p className="text-muted">
          If you lose this device, you can get your wallet back with two approvals:
        </p>
      </div>

      <Card className="space-y-4">
        <div className="flex gap-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
          <div>
            <p className="font-medium">Your Recovery Kit</p>
            <p className="text-sm text-muted">
              A file you keep offline: printed, or in a password manager. Not on this device.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
          <div>
            <p className="font-medium">Swissquote</p>
            <p className="text-sm text-muted">
              Approves only after verifying your identity (video identification).
            </p>
          </div>
        </div>
        <p className="rounded-xl bg-background p-3 text-sm text-muted">
          Every recovery waits {RECOVERY_DELAY_LABEL}, during which you can cancel it from this
          device. Swissquote alone can never take control of your wallet.
        </p>
      </Card>

      <Card className="space-y-3">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            downloadRecoveryKit(kit)
            setDownloaded(true)
          }}
        >
          {downloaded ? 'Recovery Kit downloaded ✓' : 'Download Recovery Kit'}
        </Button>
        <label className={`flex gap-2 text-sm ${downloaded ? '' : 'opacity-50'}`}>
          <input
            type="checkbox"
            disabled={!downloaded}
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I stored my Recovery Kit somewhere safe, not on this device.
        </label>
        <Button
          className="w-full"
          disabled={!downloaded || !confirmed || step !== null}
          onClick={activate}
        >
          {step ? SEND_STEP_LABEL[step] : 'Activate protection'}
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>

      <button onClick={onDone} className="text-xs text-muted hover:underline">
        Skip for now
      </button>
    </>
  )
}
