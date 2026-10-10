'use client'

import { useState } from 'react'

import { createPasskey } from '@/lib/passkey'
import { saveWallet, serializePublicKey, type StoredWallet } from '@/lib/storage'
import { predictAddress } from '@/lib/wallet'

import { Button, Card, errorMessage } from './ui'

const PROMISES = [
  ['No seed phrase', 'Your key lives in your device’s secure chip, unlocked by Face ID or Touch ID.'],
  ['Your keys, your crypto', 'Swissquote can never move your funds on its own.'],
  ['No network fees', 'Gas is covered for you. You never need to buy ETH.'],
] as const

export default function Onboarding({
  onCreated,
  onRecover,
}: {
  onCreated: (wallet: StoredWallet) => void
  onRecover: () => void
}) {
  const [name, setName] = useState('Alice')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const passkey = await createPasskey(name.trim() || 'Swissquote client')
      const wallet: StoredWallet = {
        name: name.trim() || 'Swissquote client',
        credentialId: passkey.credentialId,
        publicKey: serializePublicKey(passkey.publicKey),
        address: predictAddress(passkey.publicKey),
        createdAt: Date.now(),
      }
      saveWallet(wallet)
      onCreated(wallet)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mt-6 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Your keys. Your crypto. One tap from Swissquote.
        </h1>
        <p className="text-muted">A self-custody wallet with the security of a Swiss bank.</p>
      </div>

      <Card className="space-y-4">
        {PROMISES.map(([title, text]) => (
          <div key={title} className="flex gap-3">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
            <div>
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted">{text}</p>
            </div>
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="name">
          Name for this passkey
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent"
        />
        <Button className="w-full" onClick={create} disabled={busy}>
          {busy ? 'Waiting for passkey…' : 'Create wallet with passkey'}
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted">
          Your biometric data never leaves your device. Swissquote only receives your public key.
        </p>
      </Card>

      <Button variant="secondary" onClick={onRecover}>
        Lost your device? Recover your wallet
      </Button>
    </>
  )
}
