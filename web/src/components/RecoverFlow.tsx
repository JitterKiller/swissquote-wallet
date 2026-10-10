'use client'

import { useEffect, useEffectEvent, useState } from 'react'
import { privateKeyToAccount } from 'viem/accounts'

import { api } from '@/lib/api'
import { createPasskey } from '@/lib/passkey'
import {
  getRecoveryStatus,
  isPasskeyOwner,
  ownerAddressForPasskey,
  recoveryModule,
  recoveryTypedData,
  type PendingRecovery,
} from '@/lib/recovery'
import { NODE_URL } from '@/lib/config'
import { parseRecoveryKit, type RecoveryKit } from '@/lib/recoveryKit'
import {
  clearLocalRecovery,
  loadLocalRecovery,
  saveLocalRecovery,
  saveWallet,
  serializePublicKey,
  toPublicKey,
  type LocalRecovery,
  type StoredWallet,
} from '@/lib/storage'

import { Badge, Button, Card, errorMessage, formatCountdown, shortAddress, useNow } from './ui'

type Step = 'kit' | 'passkey' | 'identity' | 'pending'

const STEPS: { id: Step; label: string }[] = [
  { id: 'kit', label: 'Recovery Kit' },
  { id: 'passkey', label: 'New passkey' },
  { id: 'identity', label: 'Identity' },
  { id: 'pending', label: 'Delay' },
]

/**
 * Recovery on a NEW device: Recovery Kit + new passkey + identity check
 * (Swissquote Guardian) → on-chain delay → finalize → the new passkey owns
 * the same wallet (same address, same funds).
 */
export default function RecoverFlow({
  onRecovered,
  onExit,
}: {
  onRecovered: (wallet: StoredWallet) => void
  onExit: () => void
}) {
  const [local, setLocal] = useState<LocalRecovery | null>(() => loadLocalRecovery())
  const [step, setStep] = useState<Step>(() => (loadLocalRecovery()?.requestTx ? 'pending' : 'kit'))
  const [kit, setKit] = useState<RecoveryKit | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  function updateLocal(next: LocalRecovery | null) {
    if (next) saveLocalRecovery(next)
    else clearLocalRecovery()
    setLocal(next)
  }

  function finish(recovery: LocalRecovery) {
    const wallet: StoredWallet = {
      name: recovery.name,
      credentialId: recovery.credentialId,
      publicKey: recovery.publicKey,
      address: recovery.wallet,
      createdAt: Date.now(),
    }
    saveWallet(wallet)
    clearLocalRecovery()
    onRecovered(wallet)
  }

  const current = STEPS.findIndex((s) => s.id === step)

  return (
    <>
      <div className="mt-2 space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Recover your wallet</h1>
        <ol className="grid grid-cols-4 gap-1 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`rounded-lg px-2 py-1 text-center ${i <= current ? 'bg-accent text-accent-fg' : 'bg-surface text-muted'}`}
            >
              {i + 1}. {s.label}
            </li>
          ))}
        </ol>
      </div>

      {step === 'kit' && (
        <KitStep
          busy={busy}
          onSubmit={(text) =>
            run('Checking Recovery Kit…', async () => {
              const parsed = parseRecoveryKit(text)
              const isGuardian = await recoveryModule.isGuardian(NODE_URL, parsed.wallet, parsed.guardianAddress)
              if (!isGuardian) throw new Error('This Recovery Kit is not registered on that wallet.')
              setKit(parsed)
              const resumable = local && local.wallet.toLowerCase() === parsed.wallet.toLowerCase()
              setStep(resumable ? 'identity' : 'passkey')
            })
          }
        />
      )}

      {step === 'passkey' && kit && (
        <PasskeyStep
          wallet={kit.wallet}
          busy={busy}
          onCreate={(name) =>
            run('Waiting for passkey…', async () => {
              const passkey = await createPasskey(name)
              updateLocal({
                wallet: kit.wallet,
                name,
                credentialId: passkey.credentialId,
                publicKey: serializePublicKey(passkey.publicKey),
                newOwner: ownerAddressForPasskey(passkey.publicKey),
              })
              setStep('identity')
            })
          }
        />
      )}

      {step === 'identity' && kit && local && (
        <IdentityStep
          busy={busy}
          onVerify={() =>
            run('Verifying your identity…', async () => {
              const kyc = await api<{ sessionId: string; status: string }>('/api/kyc', {
                wallet: local.wallet,
                outcome: 'match',
              })
              setBusy('Signing with your Recovery Kit…')
              const typedData = await recoveryTypedData(local.wallet, local.newOwner)
              const kitSignature = await privateKeyToAccount(kit.guardianKey).signTypedData(typedData)
              setBusy('Swissquote is approving the recovery…')
              const { txHash } = await api<{ txHash: string }>('/api/recovery', {
                wallet: local.wallet,
                newPublicKey: local.publicKey,
                kitGuardian: kit.guardianAddress,
                kitSignature,
                kycSessionId: kyc.sessionId,
              })
              updateLocal({ ...local, requestTx: txHash })
              setStep('pending')
            })
          }
          onSimulateAttacker={() =>
            run('Verifying your identity…', async () => {
              await api('/api/kyc', { wallet: local.wallet, outcome: 'mismatch' })
              throw new Error(
                'Identity verification failed: the face does not match the KYC record. Swissquote will not approve this recovery and the wallet owner has been alerted. Without both approvals, nobody can take over the wallet.',
              )
            })
          }
        />
      )}

      {step === 'pending' && local && (
        <PendingStep
          recovery={local}
          busy={busy}
          onFinalize={() =>
            run('Finalizing…', async () => {
              await api('/api/recovery/finalize', { wallet: local.wallet })
              finish(local)
            })
          }
          onCompleted={() => finish(local)}
          onStartOver={() => {
            updateLocal(null)
            setKit(null)
            setStep('kit')
          }}
        />
      )}

      {error && (
        <Card className="border-danger">
          <p className="text-sm text-danger">{error}</p>
        </Card>
      )}

      <button onClick={onExit} className="text-xs text-muted hover:underline">
        Back
      </button>
    </>
  )
}

function KitStep({ busy, onSubmit }: { busy: string | null; onSubmit: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <Card className="space-y-3">
      <p className="font-medium">Your Recovery Kit</p>
      <p className="text-sm text-muted">Upload the file you saved when you set up your wallet, or paste its content.</p>
      <input
        type="file"
        accept="application/json,.json"
        className="text-sm"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) setText(await file.text())
        }}
      />
      <textarea
        aria-label="Recovery Kit"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"type": "swissquote-wallet-recovery-kit", …}'
        className="h-28 w-full rounded-xl border border-border bg-background p-3 font-mono text-xs outline-none focus:border-accent"
      />
      <Button className="w-full" disabled={!text.trim() || !!busy} onClick={() => onSubmit(text)}>
        {busy ?? 'Continue'}
      </Button>
    </Card>
  )
}

function PasskeyStep({
  wallet,
  busy,
  onCreate,
}: {
  wallet: string
  busy: string | null
  onCreate: (name: string) => void
}) {
  const [name, setName] = useState('Alice')
  return (
    <Card className="space-y-3">
      <p className="font-medium">Create a new passkey on this device</p>
      <p className="text-sm text-muted">
        It will become the new key of wallet <span className="font-mono">{shortAddress(wallet)}</span>. Same
        address, same funds.
      </p>
      <input
        aria-label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent"
      />
      <Button className="w-full" disabled={!!busy} onClick={() => onCreate(name.trim() || 'Swissquote client')}>
        {busy ?? 'Create new passkey'}
      </Button>
    </Card>
  )
}

function IdentityStep({
  busy,
  onVerify,
  onSimulateAttacker,
}: {
  busy: string | null
  onVerify: () => void
  onSimulateAttacker: () => void
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium">Verify your identity with Swissquote</p>
        <Badge tone="mock">MOCK</Badge>
      </div>
      <p className="text-sm text-muted">
        Swissquote approves a recovery only after checking it is really you: video identification with a
        liveness check against your KYC record, and your e-banking login. An email or SMS is never enough.
      </p>
      <Button className="w-full" disabled={!!busy} onClick={onVerify}>
        {busy ?? 'Start video identification'}
      </Button>
      <Button variant="secondary" className="w-full" disabled={!!busy} onClick={onSimulateAttacker}>
        Demo: simulate an attacker
      </Button>
    </Card>
  )
}

function PendingStep({
  recovery,
  busy,
  onFinalize,
  onCompleted,
  onStartOver,
}: {
  recovery: LocalRecovery
  busy: string | null
  onFinalize: () => void
  onCompleted: () => void
  onStartOver: () => void
}) {
  const now = useNow()
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'pending'; pending: PendingRecovery } | { kind: 'cancelled' }
  >({ kind: 'loading' })
  const complete = useEffectEvent(onCompleted)

  // Poll the chain: pending (ours) → countdown; gone → completed or cancelled.
  useEffect(() => {
    let cancelled = false
    const check = () =>
      Promise.all([
        getRecoveryStatus(recovery.wallet),
        isPasskeyOwner(recovery.wallet, toPublicKey(recovery)),
      ])
        .then(([status, owner]) => {
          if (cancelled) return
          if (owner) return complete()
          const ours =
            status.pending?.newOwners[0]?.toLowerCase() === recovery.newOwner.toLowerCase()
          setState(ours && status.pending ? { kind: 'pending', pending: status.pending } : { kind: 'cancelled' })
        })
        .catch(() => {})
    check()
    const id = setInterval(check, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [recovery])

  if (state.kind === 'loading') {
    return (
      <Card>
        <p className="text-sm text-muted">Checking recovery status…</p>
      </Card>
    )
  }

  if (state.kind === 'cancelled') {
    return (
      <Card className="space-y-3">
        <p className="font-medium">Recovery cancelled</p>
        <p className="text-sm text-muted">
          This recovery was cancelled from the device that currently controls the wallet.
        </p>
        <Button variant="secondary" className="w-full" onClick={onStartOver}>
          Start over
        </Button>
      </Card>
    )
  }

  // Small margin: the chain's block time can lag the local clock by a few seconds.
  const remaining = Math.max(0, state.pending.executeAfter + 5 - Math.floor(now / 1000))
  return (
    <Card className="space-y-3">
      <p className="font-medium">Recovery in progress</p>
      <p className="text-4xl font-semibold tabular-nums">{formatCountdown(remaining)}</p>
      <p className="text-sm text-muted">
        Recovery Kit and Swissquote approved. Your current device has been alerted on all channels and can
        still cancel during this delay. Then this device becomes the owner of{' '}
        <span className="font-mono">{shortAddress(recovery.wallet)}</span>.
      </p>
      <Button className="w-full" disabled={remaining > 0 || !!busy} onClick={onFinalize}>
        {busy ?? (remaining > 0 ? 'Waiting for the delay…' : 'Finalize recovery')}
      </Button>
    </Card>
  )
}
