'use client'

import { ShieldAlert, ShieldX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/feedback'
import { errorMessage, formatCountdown, shortAddress } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { recoveryModule, type PendingRecovery } from '@/lib/recovery'
import { toPublicKey } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

import { Logo } from './Logo'

/** Shown on every page of the CURRENT device while a recovery is pending. */
export function RecoveryAlert({ pending }: { pending: PendingRecovery }) {
  const { wallet, refresh } = useLoadedWallet()
  const now = useNow()
  const [step, setStep] = useState<SendStep | null>(null)
  const remaining = Math.max(0, pending.executeAfter - Math.floor(now / 1000))

  async function cancel() {
    try {
      await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: [recoveryModule.createCancelRecoveryMetaTransaction()],
        onStep: setStep,
      })
      toast.success('Recovery cancelled. Your wallet stays on this device.')
      refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  return (
    <div role="alert" className="overflow-hidden rounded-2xl border border-danger/30 bg-danger-soft">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Recovery requested for your wallet</p>
          <p className="mt-0.5 text-sm text-muted">
            Someone asked to move your wallet to a new device ({shortAddress(pending.newOwners[0] ?? '')}). It
            becomes effective in{' '}
            <span className="font-semibold tabular-nums text-foreground">{formatCountdown(remaining)}</span>.
            Swissquote alerted you by push, email, SMS and e-banking (mock).
          </p>
        </div>
        <Button variant="danger" onClick={cancel} disabled={step !== null} className="shrink-0">
          {step ? (
            <>
              <Spinner /> {SEND_STEP_LABEL[step]}
            </>
          ) : (
            'This wasn’t me: cancel recovery'
          )}
        </Button>
      </div>
    </div>
  )
}

/** The wallet was recovered to another device: this passkey no longer signs. */
export function RevokedScreen({ onForget }: { onForget: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-card">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger">
            <ShieldX className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">This device no longer controls this wallet</h1>
          <p className="mt-2 text-sm text-muted">
            The wallet was recovered to a new device. This passkey was removed from the wallet and can no longer
            sign anything, even if this device was stolen.
          </p>
          <Button variant="secondary" className="mt-6 w-full" onClick={onForget}>
            Remove this wallet from this device
          </Button>
        </div>
      </div>
    </div>
  )
}
