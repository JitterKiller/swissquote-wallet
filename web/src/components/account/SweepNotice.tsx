'use client'

import { useState } from 'react'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/feedback'
import { errorMessage, formatUsdc } from '@/lib/format'
import { sweepToAccountCalls } from '@/lib/spend'
import { toPublicKey } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

/** USDC that reached the phone's Key Safe (before the Account existed): one Face ID moves it in. */
export function SweepNotice() {
  const { wallet, chain, refresh } = useLoadedWallet()
  const [step, setStep] = useState<SendStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const amount = chain.keySafeBalance

  if (!wallet.account || !amount || amount === 0n) return null

  async function move() {
    if (!wallet.account || !amount) return
    setError(null)
    try {
      await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: sweepToAccountCalls(wallet.account, amount),
        onStep: setStep,
      })
      refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft p-4">
      <p className="text-sm">
        <span className="font-mono font-semibold tabular-nums">{formatUsdc(amount)}</span> USDC are on this phone, outside your
        Account.
        {error && <span className="block text-danger">{error}</span>}
      </p>
      <Button size="sm" onClick={move} disabled={step !== null}>
        {step ? (
          <>
            <Spinner /> {SEND_STEP_LABEL[step]}
          </>
        ) : (
          'Move into my Account'
        )}
      </Button>
    </section>
  )
}
