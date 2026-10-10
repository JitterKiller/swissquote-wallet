'use client'

import { useState } from 'react'

import { RECOVERY_DELAY_LABEL } from '@/lib/config'
import { recoveryModule, type PendingRecovery, type RecoveryStatus } from '@/lib/recovery'
import { toPublicKey, type StoredWallet } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

import { Button, Card, errorMessage, formatCountdown, shortAddress, useNow } from './ui'

export function SecurityCard({
  status,
  onSetup,
}: {
  status: RecoveryStatus | null
  onSetup: () => void
}) {
  const protectedWallet = !!status && status.guardians.length > 0
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Recovery</p>
        <span className={`text-xs font-medium ${protectedWallet ? 'text-success' : 'text-danger'}`}>
          {status === null ? 'checking…' : protectedWallet ? 'Protected' : 'Not set up'}
        </span>
      </div>
      {protectedWallet ? (
        <p className="text-sm text-muted">
          {status.threshold} of {status.guardians.length} approvals: your Recovery Kit + Swissquote
          (after identity check). Delay: {RECOVERY_DELAY_LABEL}, cancellable from this device.
        </p>
      ) : (
        status !== null && (
          <>
            <p className="text-sm text-muted">If you lose this device, you lose access to your wallet.</p>
            <Button variant="secondary" className="w-full" onClick={onSetup}>
              Set up recovery
            </Button>
          </>
        )
      )}
    </Card>
  )
}

/** Shown on the CURRENT device when someone requested a recovery. */
export function RecoveryAlert({
  wallet,
  pending,
  onCancelled,
}: {
  wallet: StoredWallet
  pending: PendingRecovery
  onCancelled: () => void
}) {
  const now = useNow()
  const [step, setStep] = useState<SendStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const remaining = Math.max(0, pending.executeAfter - Math.floor(now / 1000))

  async function cancel() {
    setError(null)
    try {
      await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: [recoveryModule.createCancelRecoveryMetaTransaction()],
        onStep: setStep,
      })
      onCancelled()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  return (
    <Card className="space-y-3 border-danger">
      <p className="font-medium text-danger">Recovery requested for your wallet</p>
      <p className="text-sm">
        Someone asked to move your wallet to a new device (
        <span className="font-mono">{shortAddress(pending.newOwners[0] ?? '')}</span>). It becomes effective
        in <span className="font-semibold tabular-nums">{formatCountdown(remaining)}</span>.
      </p>
      <p className="text-xs text-muted">Swissquote alerted you by push, email, SMS and e-banking (mock).</p>
      <Button className="w-full !bg-danger" disabled={step !== null} onClick={cancel}>
        {step ? SEND_STEP_LABEL[step] : 'This wasn’t me: cancel recovery'}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  )
}

/** Shown on the OLD device once the wallet was recovered elsewhere. */
export function RevokedNotice({ onForget }: { onForget: () => void }) {
  return (
    <Card className="space-y-3 border-danger">
      <p className="font-medium text-danger">This device no longer controls this wallet</p>
      <p className="text-sm text-muted">
        The wallet was recovered to a new device. This passkey was removed from the wallet and can no
        longer sign anything, even if this phone was stolen.
      </p>
      <Button variant="secondary" className="w-full" onClick={onForget}>
        Remove this wallet from this device
      </Button>
    </Card>
  )
}
