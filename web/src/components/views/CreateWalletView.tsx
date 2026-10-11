'use client'

import { FingerprintPattern, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useWallet } from '@/components/providers/WalletProvider'
import { Button, ButtonLink } from '@/components/ui/button'
import { Alert, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Stepper } from '@/components/ui/stepper'
import { currentBlock } from '@/lib/activity'
import { errorMessage } from '@/lib/format'
import { cleanName } from '@/lib/inputs'
import { createPasskey } from '@/lib/passkey'
import { serializePublicKey } from '@/lib/storage'
import { predictAddress } from '@/lib/wallet'

export const ONBOARDING_STEPS = ['Create', 'Protect', 'Done']

export function CreateWalletView() {
  const { ready, wallet, setWallet } = useWallet()
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already have a wallet on this device: go to it (unless we are mid-creation).
  useEffect(() => {
    if (ready && wallet && !busy) router.replace('/')
  }, [ready, wallet, busy, router])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const label = name.trim()
      const [passkey, block] = await Promise.all([createPasskey(label), currentBlock().catch(() => null)])
      setWallet({
        name: label,
        credentialId: passkey.credentialId,
        publicKey: serializePublicKey(passkey.publicKey),
        address: predictAddress(passkey.publicKey),
        createdAt: Date.now(),
        createdBlock: block === null ? undefined : String(block - 10n),
      })
      router.push('/welcome/protect')
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <Stepper steps={ONBOARDING_STEPS} current={0} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create your wallet</h1>
        <p className="mt-2 text-muted">Takes ten seconds. No seed phrase, nothing to write down.</p>
      </div>

      <form onSubmit={create} className="space-y-4">
        <Field label="Your name" htmlFor="name" hint="Shown in your wallet and as the name of your passkey.">
          <Input
            id="name"
            placeholder="e.g. Alice"
            value={name}
            onChange={(e) => setName(cleanName(e.target.value))}
            autoComplete="given-name"
            required
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !name.trim()}>
          {busy ? <Spinner /> : <FingerprintPattern className="h-5 w-5" />}
          {busy ? 'Waiting for your passkey…' : 'Create wallet with passkey'}
        </Button>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>

      <div className="flex gap-3 rounded-xl bg-surface-2 p-4 text-sm text-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Your key is created inside this device’s secure chip and never leaves it, and neither does your face or
          fingerprint. Swissquote only receives the public half of the key, which cannot move your funds.
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <ButtonLink href="/lost" variant="secondary" className="w-full">
        Phone lost or stolen?
      </ButtonLink>
    </div>
  )
}
