'use client'

import { FileKey, FingerprintPattern, ScanFace, ShieldX, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { privateKeyToAccount } from 'viem/accounts'

import { useWallet } from '@/components/providers/WalletProvider'
import { Button } from '@/components/ui/button'
import { Alert, Badge, Spinner } from '@/components/ui/feedback'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Stepper } from '@/components/ui/stepper'
import type { KitSigner } from '@/lib/account'
import { api } from '@/lib/api'
import { NODE_URL, RECOVERY_DELAY_SECONDS } from '@/lib/config'
import { errorMessage, formatCountdown, shortAddress } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { cleanName } from '@/lib/inputs'
import { createPasskey } from '@/lib/passkey'
import {
  getRecoveryStatus,
  isPasskeyOwner,
  ownerAddressForPasskey,
  recoveryModule,
  recoveryTypedData,
  type PendingRecovery,
} from '@/lib/recovery'
import { KitPassphraseError, decryptKit, parseKitFile } from '@/lib/recoveryKit'
import {
  clearLocalRecovery,
  loadLocalRecovery,
  saveLocalRecovery,
  serializePublicKey,
  toPublicKey,
  type LocalRecovery,
} from '@/lib/storage'

type Step = 'kit' | 'passkey' | 'identity' | 'pending'
/** The Kit's guardian key for this wallet: v1 file, or v3 file + passphrase (ADR-018). */
type OpenedKit = { wallet: `0x${string}`; account?: `0x${string}`; guardian: KitSigner }
const STEPS: Step[] = ['kit', 'passkey', 'identity', 'pending']
const STEP_LABELS = ['Kit', 'Passkey', 'Identity', 'Delay']

/**
 * Recovery on a NEW device: Recovery Kit + new passkey + identity check
 * (Swissquote Guardian) → on-chain delay → finalize → the new passkey owns
 * the same wallet (same address, same funds).
 */
export function RecoverView() {
  const { ready, wallet, setWallet } = useWallet()
  const router = useRouter()
  const [local, setLocal] = useState<LocalRecovery | null>(() =>
    typeof window === 'undefined' ? null : loadLocalRecovery(),
  )
  const [step, setStep] = useState<Step>(() =>
    typeof window !== 'undefined' && loadLocalRecovery()?.requestTx ? 'pending' : 'kit',
  )
  const [kit, setKit] = useState<OpenedKit | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ title: string; message: string } | null>(null)

  // A wallet already lives on this device and nothing is in progress: go to it.
  useEffect(() => {
    if (ready && wallet && !local) router.replace('/')
  }, [ready, wallet, local, router])

  if (!ready) return null

  async function run(label: string, task: () => Promise<void>, failureTitle = 'Something went wrong') {
    setBusy(label)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError({ title: failureTitle, message: errorMessage(e) })
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
    setWallet({
      name: recovery.name,
      credentialId: recovery.credentialId,
      publicKey: recovery.publicKey,
      address: recovery.wallet,
      createdAt: Date.now(),
      account: recovery.account,
    })
    clearLocalRecovery()
    router.replace('/')
  }

  return (
    <div className="space-y-8">
      <Stepper steps={STEP_LABELS} current={STEPS.indexOf(step)} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Recover your wallet</h1>
        <p className="mt-2 text-muted">
          Lost your device? Your Recovery Kit and a Swissquote identity check move your wallet to this device. Same
          address, same funds.
        </p>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <Badge tone="warning">Prototype</Badge>
          <span>
            This page still runs the earlier recovery, which your old device can cancel. For a lost or stolen phone, use{' '}
            <Link href="/lost" className="font-medium text-accent-ink underline underline-offset-4">
              Phone lost or stolen
            </Link>
            : your Kit locks it out, and a thief can&apos;t cancel it.
          </span>
        </p>
      </div>

      {step === 'kit' && (
        <KitStep
          busy={busy}
          onSubmit={(text, passphrase) =>
            run('Checking your Recovery Kit…', async () => {
              const opened = await openKit(text, passphrase)
              const isGuardian = await recoveryModule.isGuardian(NODE_URL, opened.wallet, opened.guardian.address)
              if (!isGuardian) throw new Error('This Recovery Kit is not registered on that wallet.')
              setKit(opened)
              const resumable = local && local.wallet.toLowerCase() === opened.wallet.toLowerCase()
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
            run('Waiting for your passkey…', async () => {
              const passkey = await createPasskey(name)
              updateLocal({
                wallet: kit.wallet,
                name,
                credentialId: passkey.credentialId,
                publicKey: serializePublicKey(passkey.publicKey),
                newOwner: ownerAddressForPasskey(passkey.publicKey),
                account: kit.account,
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
              const kyc = await api<{ sessionId: string }>('/api/kyc', { wallet: local.wallet, outcome: 'match' })
              setBusy('Signing with your Recovery Kit…')
              const typedData = await recoveryTypedData(local.wallet, local.newOwner)
              const kitSignature = await kit.guardian.signTypedData(typedData)
              setBusy('Swissquote is approving the recovery…')
              const { txHash } = await api<{ txHash: string }>('/api/recovery', {
                wallet: local.wallet,
                newPublicKey: local.publicKey,
                kitGuardian: kit.guardian.address,
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
            }, 'Recovery refused by Swissquote')
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
        <Alert tone="danger" title={error.title}>
          {error.message}
        </Alert>
      )}

      <p className="text-center text-sm">
        <Link href="/welcome" className="text-muted hover:text-foreground">
          Back
        </Link>
      </p>
    </div>
  )
}

function StepCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">{icon}</span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

async function openKit(text: string, passphrase: string): Promise<OpenedKit> {
  const parsed = parseKitFile(text)
  if (parsed.version === 1) {
    return { wallet: parsed.kit.wallet, guardian: privateKeyToAccount(parsed.kit.guardianKey) }
  }
  try {
    const { guardian } = await decryptKit(parsed.kit, passphrase)
    return { wallet: parsed.kit.keySafe, account: parsed.kit.account, guardian }
  } catch (e) {
    if (e instanceof KitPassphraseError) throw new Error('Wrong Kit passphrase. Check it and try again.')
    throw e
  }
}

/** v3 Kits are encrypted: their content tells whether to ask for the passphrase. */
function kitVersion(text: string) {
  try {
    return (JSON.parse(text) as { version?: number }).version ?? null
  } catch {
    return null
  }
}

function KitStep({ busy, onSubmit }: { busy: string | null; onSubmit: (text: string, passphrase: string) => void }) {
  const [text, setText] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const encrypted = kitVersion(text) === 3
  return (
    <StepCard
      icon={<FileKey className="h-5 w-5" />}
      title="Your Recovery Kit"
      description="The file you saved when you protected your wallet."
    >
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-sm transition hover:border-accent">
        <Upload className="h-5 w-5 text-muted" />
        <span className="font-medium">Upload Recovery Kit file</span>
        <span className="text-xs text-muted">swissquote-recovery-kit-….json</span>
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) setText(await file.text())
          }}
        />
      </label>
      <Field label="Or paste its content" htmlFor="kit">
        <Textarea
          id="kit"
          aria-label="Recovery Kit"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"type": "swissquote-wallet-recovery-kit", …}'
          className="h-24 font-mono text-xs"
          spellCheck={false}
        />
      </Field>
      {encrypted && (
        <Field label="Kit passphrase" htmlFor="kit-passphrase">
          <Input
            id="kit-passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
          />
        </Field>
      )}
      <Button
        size="lg"
        className="w-full"
        disabled={!text.trim() || (encrypted && !passphrase) || !!busy}
        onClick={() => onSubmit(text, passphrase)}
      >
        {busy ? (
          <>
            <Spinner /> {busy}
          </>
        ) : (
          'Continue'
        )}
      </Button>
    </StepCard>
  )
}

function PasskeyStep({ wallet, busy, onCreate }: { wallet: string; busy: string | null; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <StepCard
      icon={<FingerprintPattern className="h-5 w-5" />}
      title="Create a new passkey on this device"
      description={
        <>
          It will become the new key of wallet <span className="font-mono">{shortAddress(wallet)}</span>.
        </>
      }
    >
      <Field label="Your name" htmlFor="recover-name">
        <Input id="recover-name" aria-label="Name" placeholder="e.g. Alice" value={name} onChange={(e) => setName(cleanName(e.target.value))} autoComplete="given-name" />
      </Field>
      <Button size="lg" className="w-full" disabled={!!busy || !name.trim()} onClick={() => onCreate(name.trim())}>
        {busy ? <Spinner /> : <FingerprintPattern className="h-5 w-5" />}
        {busy ?? 'Create new passkey'}
      </Button>
    </StepCard>
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
    <StepCard
      icon={<ScanFace className="h-5 w-5" />}
      title="Verify your identity with Swissquote"
      description="Swissquote approves a recovery only after checking it is really you. An email or SMS is never enough."
    >
      <div className="space-y-2 rounded-xl bg-surface-2 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">Video identification</span>
          <Badge tone="accent">MOCK</Badge>
        </div>
        <p className="text-muted">
          Liveness check against your KYC record (FINMA Circular 2016/7) and your e-banking login. Simulated in this
          prototype.
        </p>
      </div>
      <Button size="lg" className="w-full" disabled={!!busy} onClick={onVerify}>
        {busy ? (
          <>
            <Spinner /> {busy}
          </>
        ) : (
          'Start video identification'
        )}
      </Button>
      <Button variant="secondary" className="w-full" disabled={!!busy} onClick={onSimulateAttacker}>
        <ShieldX className="h-4 w-4" /> Demo: simulate an attacker
      </Button>
    </StepCard>
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
      Promise.all([getRecoveryStatus(recovery.wallet), isPasskeyOwner(recovery.wallet, toPublicKey(recovery))])
        .then(([status, owner]) => {
          if (cancelled) return
          if (owner) return complete()
          const ours = status.pending?.newOwners[0]?.toLowerCase() === recovery.newOwner.toLowerCase()
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
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-sm text-muted shadow-card">
        <Spinner /> Checking recovery status…
      </div>
    )
  }

  if (state.kind === 'cancelled') {
    return (
      <StepCard
        icon={<ShieldX className="h-5 w-5" />}
        title="Recovery cancelled"
        description="This recovery was cancelled from the device that currently controls the wallet."
      >
        <Button variant="secondary" className="w-full" onClick={onStartOver}>
          Start over
        </Button>
      </StepCard>
    )
  }

  // Small margin: the chain's block time can lag the local clock by a few seconds.
  const total = RECOVERY_DELAY_SECONDS + 5
  const remaining = Math.max(0, state.pending.executeAfter + 5 - Math.floor(now / 1000))
  const progress = Math.min(1, Math.max(0, 1 - remaining / total))
  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-6 text-center shadow-card">
      <p className="font-semibold">Recovery in progress</p>
      <p className="text-5xl font-semibold tracking-tight tabular-nums">{formatCountdown(remaining)}</p>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent transition-[width] duration-1000" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="text-sm text-muted">
        Recovery Kit and Swissquote approved. Your current device was alerted on every channel and can still cancel
        during this delay. Then this device becomes the owner of{' '}
        <span className="font-mono">{shortAddress(recovery.wallet)}</span>.
      </p>
      <Button size="lg" className="w-full" disabled={remaining > 0 || !!busy} onClick={onFinalize}>
        {busy ? (
          <>
            <Spinner /> {busy}
          </>
        ) : remaining > 0 ? (
          'Waiting for the delay…'
        ) : (
          'Finalize recovery'
        )}
      </Button>
    </div>
  )
}
