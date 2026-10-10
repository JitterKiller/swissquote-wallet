'use client'

import { useState } from 'react'
import { isAddress, parseUnits } from 'viem'

import { EXPLORER_URL, USDC_DECIMALS } from '@/lib/config'
import { toPublicKey, type Activity, type StoredWallet } from '@/lib/storage'
import { sendCalls, usdcTransfer, type SendStep } from '@/lib/wallet'

import { Button, Card, errorMessage } from './ui'

const STEP_LABEL: Record<SendStep, string> = {
  preparing: 'Preparing transaction…',
  sponsoring: 'Requesting gas sponsorship…',
  signing: 'Confirm with your passkey…',
  submitting: 'Submitting…',
  confirming: 'Waiting for confirmation…',
}

export default function SendForm({
  wallet,
  balance,
  onSent,
}: {
  wallet: StoredWallet
  balance: bigint | null
  onSent: (entry: Activity) => void
}) {
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<SendStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastTx, setLastTx] = useState<string | null>(null)

  const validationError = validate(to, amount, balance)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (validationError) return
    setError(null)
    setLastTx(null)
    try {
      const { txHash } = await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: [usdcTransfer(to as `0x${string}`, amount)],
        onStep: setStep,
      })
      setLastTx(txHash)
      onSent({ kind: 'send', to, amount, txHash, at: Date.now() })
      setAmount('')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  const busy = step !== null

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="to">
          Recipient address
        </label>
        <input
          id="to"
          placeholder="0x…"
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm outline-none focus:border-accent"
        />
        <label className="block text-sm font-medium" htmlFor="amount">
          Amount (USDC)
        </label>
        <input
          id="amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent"
        />
        <div className="flex justify-between text-xs text-muted">
          <span>Network fee</span>
          <span className="font-medium text-success">Free · sponsored by Swissquote</span>
        </div>
        <Button type="submit" className="w-full" disabled={busy || !!validationError}>
          {busy ? STEP_LABEL[step] : 'Send with passkey'}
        </Button>
        {validationError && (to || amount) && <p className="text-xs text-muted">{validationError}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        {lastTx && (
          <p className="text-sm text-success">
            Sent ✓{' '}
            <a href={`${EXPLORER_URL}/tx/${lastTx}`} target="_blank" rel="noreferrer" className="underline">
              View on explorer
            </a>
          </p>
        )}
      </form>
    </Card>
  )
}

function validate(to: string, amount: string, balance: bigint | null): string | null {
  if (!isAddress(to)) return 'Enter a valid 0x address.'
  let value: bigint
  try {
    value = parseUnits(amount || '0', USDC_DECIMALS)
  } catch {
    return 'Enter a valid amount.'
  }
  if (value <= 0n) return 'Enter an amount greater than 0.'
  if (balance !== null && value > balance) return 'Insufficient USDC balance.'
  return null
}
