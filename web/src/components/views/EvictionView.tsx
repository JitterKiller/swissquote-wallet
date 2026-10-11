'use client'

import { ExternalLink, FileKey, FingerprintPattern, KeyRound, ScanFace, ShieldX, Smartphone, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import type { Address } from 'viem'

import { DaySquares } from '@/components/account/DaySquares'
import { useWallet } from '@/components/providers/WalletProvider'
import { Button, ButtonLink } from '@/components/ui/button'
import { ApprovalSquares, FactorSquare } from '@/components/ui/factor'
import { Alert, Badge, Spinner } from '@/components/ui/feedback'
import { Field, Input, Textarea } from '@/components/ui/field'
import { useBlockNumber } from '@/components/ui/live'
import { Plate, PlateRow } from '@/components/ui/plate'
import { Stepper } from '@/components/ui/stepper'
import { accountTxDigest, kitSignature, readAccount, replaceKeySafeCall } from '@/lib/account'
import { api } from '@/lib/api'
import { EVICTION_DAYS, EVICTION_DELAY_IS_DEMO, EVICTION_DELAY_SECONDS, EXPLORER_URL, type Level } from '@/lib/config'
import { evictionLevel, finalizeEviction, handoverCalls, startEviction } from '@/lib/eviction'
import { errorChain, errorMessage, formatDelay, formatUsdc, shortAddress } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { cleanName } from '@/lib/inputs'
import { createPasskey } from '@/lib/passkey'
import { KitPassphraseError, decryptKit, parseKitFile, unlockKit, type KitAccounts } from '@/lib/recoveryKit'
import { findSecurityKey, signWithSecurityKey } from '@/lib/securityKey'
import {
  clearLocalEviction,
  loadLocalEviction,
  saveLocalEviction,
  saveLocalKit,
  serializePublicKey,
  toPublicKey,
  type LocalEviction,
} from '@/lib/storage'
import { SEND_STEP_LABEL, predictAddress, publicClient, sendCalls } from '@/lib/wallet'

type Step = 'kit' | 'passkey' | 'start' | 'pending' | 'takeover' | 'done'
const STEPS: Step[] = ['kit', 'passkey', 'start', 'pending', 'takeover']
const STEP_LABELS = ['Kit', 'Face ID', 'Lock out', 'Delay', 'Take over']

/** What the Kit step reads on-chain before a passkey exists (memory only). */
type Target = { account: Address; oldKeySafe: Address; level: Level; dailyLimit: bigint; keyProxy?: Address }
type Failure = { title: string; message: string; legacy?: boolean }
type Done = { oldKeySafe: Address; dailyLimit: bigint; startTx?: string; finalizeTx?: string; handoverTx?: string; lockOutNowTx?: string }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Right after the finalize, some RPC nodes have not seen its block yet: wait until ours lists this device as an owner. */
async function untilOwner(account: Address, keySafe: Address, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    const state = await readAccount(account).catch(() => null)
    if (state?.owners.some((o) => same(o, keySafe))) return
    await pause(2_000)
  }
}

/** The bundler simulates on its own node, which can lag a block behind: retry its "would revert" a few times. */
async function retryLagging<T>(task: () => Promise<T>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task()
    } catch (error) {
      if (attempt >= 4 || !/EXECUTION_REVERTED|-32521/.test(errorChain(error))) throw error
      await pause(3_000 * attempt)
    }
  }
}

/** A Kit or wallet from before the Account: the legacy Key Safe recovery handles it (ADR-026, until #33). */
class LegacyWalletError extends Error {}

/**
 * "Phone lost or stolen?" on the NEW phone (issue #15, PDR-018, PDR-021, ADR-019). The Kit's guardian
 * key starts a time-locked eviction of the old phone's Key Safe; when the delay ends, this device takes
 * over the daily limit with Face ID + the Kit. Same Account, same funds. The opened Kit stays in memory;
 * the new passkey (public data) is saved before anything is sent, so a reload resumes the flow.
 */
export function EvictionView() {
  const { ready, wallet, setWallet } = useWallet()
  const router = useRouter()
  const [local, setLocal] = useState<LocalEviction | null>(() => (typeof window === 'undefined' ? null : loadLocalEviction()))
  const [step, setStep] = useState<Step>(() => (typeof window !== 'undefined' && loadLocalEviction()?.startTx ? 'pending' : 'kit'))
  const [kit, setKit] = useState<KitAccounts | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [kycSessionId, setKycSessionId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<Failure | null>(null)
  const [done, setDone] = useState<Done | null>(null)

  // A wallet already lives on this device and nothing is in progress: go to it.
  useEffect(() => {
    if (ready && wallet && !local && step !== 'done') router.replace('/')
  }, [ready, wallet, local, step, router])

  if (!ready) return null

  async function run(label: string, task: () => Promise<void>, failureTitle = 'Something went wrong') {
    setBusy(label)
    setError(null)
    try {
      await task()
    } catch (e) {
      if (e instanceof LegacyWalletError) setError({ title: 'Use the previous recovery', message: e.message, legacy: true })
      else setError({ title: failureTitle, message: errorMessage(e) })
    } finally {
      setBusy(null)
    }
  }

  function updateLocal(next: LocalEviction | null) {
    if (next) saveLocalEviction(next)
    else clearLocalEviction()
    setLocal(next)
  }

  /**
   * Kit + security key (#17, spike C4b, ADR-038): two of the Account's owners replace the old phone at once,
   * from the start step or while the time-locked lock-out runs (the same transaction cancels it).
   */
  function lockOutNow(eviction: LocalEviction, passphrase: string) {
    const keyProxy = eviction.keyProxy
    if (!keyProxy) return
    return run(
      kit ? 'Your Kit is signing…' : 'Opening your Kit…',
      async () => {
        const owner = kit?.owner ?? (await unlockKit(passphrase)).owner
        setBusy('Your Kit is signing…')
        const state = await readAccount(eviction.account, { keySafe: eviction.oldKeySafe })
        const dailyLimit = state.allowance?.amount ?? BigInt(eviction.dailyLimit ?? '0')
        const replace = replaceKeySafeCall({
          account: eviction.account,
          owners: state.owners,
          oldKeySafe: eviction.oldKeySafe,
          newKeySafe: eviction.newKeySafe,
          dailyLimit,
          cancelEviction: state.pendingEviction ? (state.evictionModule ?? undefined) : undefined,
        })
        const kitSig = await kitSignature(owner, eviction.account, replace, state.nonce)
        if (kitSig.kind !== 'ecdsa') throw new Error('The Kit did not sign')
        setBusy('Use your security key…')
        // The directory names the key's credential: trust it only for the key that is an owner now,
        // otherwise the authenticator offers its keys.
        const record = await findSecurityKey(eviction.account)
        const credentialId = record && same(record.proxy, keyProxy) ? record.credentialId : undefined
        const keySignature = await signWithSecurityKey(accountTxDigest(eviction.account, replace, state.nonce), credentialId)
        setBusy('Locking the old phone out…')
        const { txHash } = await api<{ txHash: string }>('/api/evict-now', {
          account: eviction.account,
          oldKeySafe: eviction.oldKeySafe,
          newKeySafe: eviction.newKeySafe,
          kitOwner: owner.address,
          kitSignature: kitSig.data,
          keyProxy,
          keySignature,
        })
        setDone({ oldKeySafe: eviction.oldKeySafe, dailyLimit, lockOutNowTx: txHash })
        setWallet({
          name: eviction.name,
          credentialId: eviction.credentialId,
          publicKey: eviction.publicKey,
          address: eviction.newKeySafe,
          createdAt: Date.now(),
          account: eviction.account,
          level: eviction.level,
          dailyLimit: dailyLimit.toString(),
        })
        updateLocal(null)
        setKit(null)
        setStep('done')
      },
      'Not locked out',
    )
  }

  async function openKit(text: string, passphrase: string) {
    const parsed = parseKitFile(text)
    if (parsed.version === 1) {
      throw new LegacyWalletError('This Recovery Kit is from before the Account. The previous recovery moves that wallet to this device.')
    }
    let opened: KitAccounts
    try {
      opened = await decryptKit(parsed.kit, passphrase)
    } catch (e) {
      if (e instanceof KitPassphraseError) throw new Error('Wrong Kit passphrase. Check it and try again.')
      throw e
    }
    const account = parsed.kit.account
    const [state, { guardian: swissquote }] = await Promise.all([readAccount(account), api<{ guardian: Address }>('/api/guardian')])
    if (!state.deployed || !state.evictionModule) {
      throw new LegacyWalletError('This wallet has no Account lock-out yet. The previous recovery moves it to this device.')
    }
    if (!state.guardians.some((g) => same(g, opened.guardian.address))) throw new Error('This Recovery Kit does not guard that Account.')
    const oldKeySafe = state.allowance?.delegate
    if (!oldKeySafe || !state.owners.some((o) => same(o, oldKeySafe))) throw new Error('This Account has no phone to lock out.')

    // The encrypted Kit stays on this device (ADR-018): the takeover and later Kit payments need it.
    saveLocalKit(parsed.kit)
    setKit(opened)
    const ours = local && same(local.account, account) ? local : null
    if (state.pendingEviction) {
      if (ours && state.pendingEviction.newOwners.some((o) => same(o, ours.newKeySafe))) return setStep('pending')
      const left = Math.max(0, state.pendingEviction.executeAfter - Math.floor(Date.now() / 1000))
      throw new Error(`A lock-out started from another device is already running for this Account. It takes effect in ${formatDelay(left)}.`)
    }
    if (ours && same(ours.oldKeySafe, oldKeySafe)) return setStep('start')
    // A security key (#17) is the owner that is neither the old phone nor the Kit, and a contract (its WebAuthn verifier).
    const candidate = state.owners.find((o) => !same(o, oldKeySafe) && !same(o, opened.owner.address))
    const keyProxy = candidate && ((await publicClient.getCode({ address: candidate }))?.length ?? 0) > 2 ? candidate : undefined
    setTarget({ account, oldKeySafe, level: evictionLevel(state, swissquote), dailyLimit: state.allowance?.amount ?? 0n, keyProxy })
    setStep('passkey')
  }

  return (
    <div className="space-y-8">
      {step !== 'done' && <Stepper steps={STEP_LABELS} current={STEPS.indexOf(step)} />}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {step === 'done' ? 'This device now holds your Account' : 'Phone lost or stolen?'}
        </h1>
        {(step === 'kit' || step === 'passkey') && (
          <p className="mt-2 text-muted">
            Your Recovery Kit locks the old phone out of your Account and moves it to this device. Same Account, same funds. A
            thief with the old phone cannot stop it.
          </p>
        )}
      </div>

      {step === 'kit' && <KitStep busy={busy} onSubmit={(text, passphrase) => run('Opening your Kit…', () => openKit(text, passphrase))} />}

      {step === 'passkey' && target && (
        <PasskeyStep
          account={target.account}
          busy={busy}
          onCreate={(name) =>
            run('Waiting for Face ID…', async () => {
              const passkey = await createPasskey(name)
              updateLocal({
                account: target.account,
                oldKeySafe: target.oldKeySafe,
                newKeySafe: predictAddress(passkey.publicKey),
                name,
                credentialId: passkey.credentialId,
                publicKey: serializePublicKey(passkey.publicKey),
                level: target.level,
                dailyLimit: target.dailyLimit.toString(),
                keyProxy: target.keyProxy,
              })
              setStep('start')
            })
          }
        />
      )}

      {step === 'start' && local && kit && (
        <StartStep
          eviction={local}
          verified={(local.level ?? 0) === 0 || !!kycSessionId}
          busy={busy}
          onVerify={() =>
            run('Verifying your identity…', async () => {
              const kyc = await api<{ sessionId: string }>('/api/kyc', { wallet: local.account, outcome: 'match' })
              setKycSessionId(kyc.sessionId)
            })
          }
          onSimulateAttacker={() =>
            run(
              'Verifying your identity…',
              async () => {
                await api('/api/kyc', { wallet: local.account, outcome: 'mismatch' })
                throw new Error(
                  'The face does not match the KYC record. Swissquote will not co-sign, and the owner has been alerted. Without both approvals, nobody can lock the phone out.',
                )
              },
              'Identity check failed',
            )
          }
          onLockOutNow={(passphrase) => lockOutNow(local, passphrase)}
          onStart={() =>
            run('Your Kit is signing…', async () => {
              const started = await startEviction({
                account: local.account,
                oldKeySafe: local.oldKeySafe,
                newKeySafe: local.newKeySafe,
                guardian: kit.guardian,
                kycSessionId: kycSessionId ?? undefined,
              })
              updateLocal({
                ...local,
                startTx: started.txHash,
                executeAfter: started.executeAfter,
                dailyLimit: (started.dailyLimit ?? BigInt(local.dailyLimit ?? '0')).toString(),
              })
              setStep('pending')
            })
          }
        />
      )}

      {step === 'pending' && local && (
        <PendingStep
          eviction={local}
          lockOutNow={
            local.keyProxy ? (
              <LockOutNow
                eviction={local}
                context="pending"
                kitOpen={!!kit}
                busy={busy}
                onLockOut={(passphrase) => lockOutNow(local, passphrase)}
              />
            ) : null
          }
          onReady={() => setStep('takeover')}
          onStartOver={() => {
            // Keep this device's new key; only the stopped lock-out is forgotten.
            updateLocal({ ...local, startTx: undefined, executeAfter: undefined })
            setKycSessionId(null)
            setStep(kit ? 'start' : 'kit')
          }}
        />
      )}

      {step === 'takeover' && local && (
        <TakeoverStep
          eviction={local}
          kitOpen={!!kit}
          busy={busy}
          onTakeOver={(passphrase) =>
            run('Opening your Kit…', async () => {
              const owner = kit?.owner ?? (await unlockKit(passphrase)).owner
              const state = await readAccount(local.account, { keySafe: local.oldKeySafe })
              let finalizeTx: string | undefined
              if (state.pendingEviction) {
                setBusy('Locking the old phone out…')
                finalizeTx = (await finalizeEviction(local.account)).txHash
              }
              const dailyLimit = BigInt(local.dailyLimit ?? (state.allowance?.amount ?? 0n).toString())
              let txHash: string
              try {
                setBusy('Waiting for the network…')
                await untilOwner(local.account, local.newKeySafe)
                const calls = await handoverCalls({
                  account: local.account,
                  oldKeySafe: local.oldKeySafe,
                  newKeySafe: local.newKeySafe,
                  dailyLimit,
                  kit: owner,
                })
                ;({ txHash } = await retryLagging(() =>
                  sendCalls({
                    address: local.newKeySafe,
                    credentialId: local.credentialId,
                    publicKey: toPublicKey(local),
                    calls,
                    onStep: (s) => setBusy(SEND_STEP_LABEL[s]),
                  }),
                ))
              } catch (e) {
                // Until the handover lands, the old phone is out of the owners but still holds today's Face ID limit.
                throw new Error(
                  `${errorMessage(e)} The old phone is no longer an owner, but it keeps today’s Face ID limit until this device takes over: try again now.`,
                )
              }
              setDone({ oldKeySafe: local.oldKeySafe, dailyLimit, startTx: local.startTx, finalizeTx, handoverTx: txHash })
              setWallet({
                name: local.name,
                credentialId: local.credentialId,
                publicKey: local.publicKey,
                address: local.newKeySafe,
                createdAt: Date.now(),
                account: local.account,
                level: local.level,
                dailyLimit: dailyLimit.toString(),
              })
              updateLocal(null)
              setKit(null)
              setStep('done')
            }, 'Not taken over yet')
          }
        />
      )}

      {step === 'done' && done && <DoneStep done={done} />}

      {error && (
        <Alert
          tone="danger"
          title={error.title}
          action={
            error.legacy ? (
              <ButtonLink href="/recover" variant="secondary" size="sm">
                Open the previous recovery
              </ButtonLink>
            ) : undefined
          }
        >
          {error.message}
        </Alert>
      )}

      {step === 'kit' && (
        <p className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-sm">
          <Link href="/welcome" className="text-muted hover:text-foreground">
            Back
          </Link>
          <Link href="/recover" className="text-muted hover:text-foreground">
            Wallet without an Account? Previous recovery
          </Link>
        </p>
      )}
    </div>
  )
}

function StepCard({ icon, title, description, children }: { icon: ReactNode; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-foreground">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function BusyLabel({ busy, children }: { busy: string | null; children: ReactNode }) {
  return busy ? (
    <>
      <Spinner /> {busy}
    </>
  ) : (
    children
  )
}

function KitStep({ busy, onSubmit }: { busy: string | null; onSubmit: (text: string, passphrase: string) => void }) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [passphrase, setPassphrase] = useState('')
  return (
    <StepCard icon={<FileKey className="h-5 w-5" />} title="Open your Recovery Kit" description="The file you saved when you protected your wallet, and its passphrase.">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-4 text-sm transition-colors hover:border-accent-ink focus-within:border-accent-ink focus-within:ring-4 focus-within:ring-accent-soft">
        <Upload className="h-5 w-5 shrink-0 text-muted" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{fileName ?? 'Choose your Kit file'}</span>
          <span className="block truncate text-xs text-muted">From Files, iCloud Drive or Google Drive</span>
        </span>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Recovery Kit file"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            setFileName(file.name)
            setText(await file.text())
          }}
        />
      </label>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:text-foreground">Paste its content instead</summary>
        <Textarea
          aria-label="Recovery Kit content"
          value={text}
          onChange={(e) => {
            setFileName(null)
            setText(e.target.value)
          }}
          placeholder='{"type": "swissquote-wallet-recovery-kit", …}'
          className="mt-2 h-24 font-mono text-xs"
          spellCheck={false}
        />
      </details>
      <Field label="Kit passphrase" htmlFor="lost-kit-passphrase">
        <Input id="lost-kit-passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" />
      </Field>
      <Button size="lg" className="w-full" disabled={!text.trim() || !passphrase || !!busy} onClick={() => onSubmit(text, passphrase)}>
        <BusyLabel busy={busy}>Open my Kit</BusyLabel>
      </Button>
    </StepCard>
  )
}

function PasskeyStep({ account, busy, onCreate }: { account: Address; busy: string | null; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <StepCard
      icon={<FingerprintPattern className="h-5 w-5" />}
      title="Face ID on this device"
      description={
        <>
          This device gets its own key for your Account <span className="font-mono">{shortAddress(account)}</span>. It never leaves
          its secure chip.
        </>
      }
    >
      <Field label="Your name" htmlFor="lost-name">
        <Input id="lost-name" placeholder="e.g. Alice" value={name} onChange={(e) => setName(cleanName(e.target.value))} autoComplete="given-name" />
      </Field>
      <Button size="lg" className="w-full" disabled={!!busy || !name.trim()} onClick={() => onCreate(name.trim())}>
        <BusyLabel busy={busy}>
          <FingerprintPattern className="h-5 w-5" /> Create my key with Face ID
        </BusyLabel>
      </Button>
    </StepCard>
  )
}

function StartStep({
  eviction,
  verified,
  busy,
  onVerify,
  onSimulateAttacker,
  onStart,
  onLockOutNow,
}: {
  eviction: LocalEviction
  verified: boolean
  busy: string | null
  onVerify: () => void
  onSimulateAttacker: () => void
  onStart: () => void
  onLockOutNow: (passphrase: string) => void
}) {
  const level = eviction.level ?? 0
  const days = EVICTION_DAYS[level]
  const limit = BigInt(eviction.dailyLimit ?? '0')
  const [todayLeft, setTodayLeft] = useState<bigint | null>(null)
  useEffect(() => {
    let cancelled = false
    readAccount(eviction.account, { keySafe: eviction.oldKeySafe })
      .then((state) => !cancelled && setTodayLeft(state.allowance?.remaining ?? 0n))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [eviction])
  // Until it is read, count today in full: the bound can only be lower.
  const today = todayLeft ?? limit
  const worst = today + limit * BigInt(days)

  const lockOutNow = eviction.keyProxy ? <LockOutNow eviction={eviction} context="start" kitOpen busy={busy} onLockOut={onLockOutNow} /> : null

  if (!verified) {
    return (
      <div className="space-y-5">
        {lockOutNow}
      <StepCard
        icon={<ScanFace className="h-5 w-5" />}
        title="Verify your identity with Swissquote"
        description="Your Account is linked to Swissquote: it co-signs a lock-out only after checking it is really you, which shortens the delay to 3 days."
      >
        <div className="border-y border-border py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">Video identification</span>
            <Badge tone="warning">MOCK</Badge>
          </div>
          <p className="mt-1 text-muted">Liveness check against your KYC record (FINMA Circular 2016/7). Simulated in this prototype.</p>
        </div>
        {/* With a key, "Lock out now" above is the one orange action. */}
        <Button size="lg" variant={eviction.keyProxy ? 'secondary' : 'primary'} className="w-full" disabled={!!busy} onClick={onVerify}>
          <BusyLabel busy={busy}>Start video identification</BusyLabel>
        </Button>
        <Button variant="secondary" className="w-full" disabled={!!busy} onClick={onSimulateAttacker}>
          <ShieldX className="h-4 w-4" /> Demo: simulate an attacker
        </Button>
      </StepCard>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {lockOutNow}
      <StepCard
        icon={<Smartphone className="h-5 w-5" />}
        title="First, erase the old phone"
        description="If it was stolen, erase it remotely: a thief then cannot use it, even unlocked. If you can’t, the lock-out still protects your Account."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <ButtonLink href="https://www.icloud.com/find" target="_blank" rel="noreferrer" variant="secondary">
            Find My (iPhone) <ExternalLink className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink href="https://www.google.com/android/find" target="_blank" rel="noreferrer" variant="secondary">
            Find My Device (Android) <ExternalLink className="h-4 w-4" />
          </ButtonLink>
        </div>
      </StepCard>

      <section className="rounded-2xl bg-accent-soft p-4" aria-label="What the old phone can still spend">
        <p className="text-sm text-foreground/75">Until the lock-out takes effect, the old phone can still spend at most</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
            {formatUsdc(worst)} <span className="font-sans text-lg">USDC</span>
          </p>
          <DaySquares days={days} today />
        </div>
        <p className="mt-2 text-sm text-foreground/75">
          <span className="font-mono tabular-nums">{formatUsdc(today)}</span> left today, then its daily limit of{' '}
          <span className="font-mono tabular-nums">{formatUsdc(limit)}</span> after each of the {days} resets. Anything above needs
          your Kit.
        </p>
      </section>

      <Plate title="Your Kit will start the lock-out">
        <dl>
          <PlateRow label="Old phone">
            <span className="font-mono">{shortAddress(eviction.oldKeySafe)}</span>
            <span className="block text-xs font-normal text-hero-muted">Locked out of your Account</span>
          </PlateRow>
          <PlateRow label="New device">
            This device <span className="font-mono text-hero-muted">{shortAddress(eviction.newKeySafe)}</span>
          </PlateRow>
          <PlateRow label="Takes effect">
            In {days} days
            {EVICTION_DELAY_IS_DEMO && (
              <span className="block text-xs font-normal text-hero-muted">
                {Math.round(EVICTION_DELAY_SECONDS[level] / 60)} min in this demo
              </span>
            )}
          </PlateRow>
          <PlateRow label="Can stop it">
            <CanStopIt withKey={!!eviction.keyProxy} />
          </PlateRow>
          {level === 1 && <PlateRow label="Swissquote">Co-signs after your identity check</PlateRow>}
          <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
        </dl>
      </Plate>

      {/* With a key, "Lock out now" above is the one orange action; the time-locked lock-out is the fallback. */}
      <Button size="lg" variant={eviction.keyProxy ? 'secondary' : 'primary'} className="w-full" disabled={!!busy} onClick={onStart}>
        <BusyLabel busy={busy}>
          <KeyRound className="h-5 w-5" /> Start the lock-out
        </BusyLabel>
      </Button>
    </div>
  )
}

/**
 * With a security key (#17, PDR-017, ADR-038): the Kit and the key are two of the Account's owners, so
 * together they replace the old phone at once. No delay, no identity check, and the thief can't stop it.
 */
function LockOutNow({
  eviction,
  context,
  kitOpen,
  busy,
  onLockOut,
}: {
  eviction: LocalEviction
  /** `start` leads the start step; `pending` ends the running time-locked lock-out instead of waiting. */
  context: 'start' | 'pending'
  kitOpen: boolean
  busy: string | null
  onLockOut: (passphrase: string) => void
}) {
  const [passphrase, setPassphrase] = useState('')
  const pending = context === 'pending'
  return (
    <section aria-labelledby={pending ? 'lock-out-now-heading' : 'lock-out-now'} className="space-y-4">
      {pending && (
        <div>
          <h2 id="lock-out-now-heading" className="text-lg font-semibold tracking-tight">
            Have your security key?
          </h2>
          <p className="mt-1 text-sm text-muted">With your Kit, it locks the old phone out now and ends this wait.</p>
        </div>
      )}
      <Plate
        title={
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex gap-1">
              <FactorSquare factor="kit" tone="hero" />
              <FactorSquare factor="key" tone="hero" />
            </span>
            <span id="lock-out-now">Your Kit and your security key will approve</span>
          </span>
        }
      >
        <dl>
          <PlateRow label="Old phone">
            <span className="font-mono">{shortAddress(eviction.oldKeySafe)}</span>
            <span className="block text-xs font-normal text-hero-muted">Locked out at once</span>
          </PlateRow>
          <PlateRow label="New device">
            This device <span className="font-mono text-hero-muted">{shortAddress(eviction.newKeySafe)}</span>
            <span className="block text-xs font-normal text-hero-muted">Takes the phone’s daily limit</span>
          </PlateRow>
          {pending && <PlateRow label="This lock-out">Cancelled, no longer needed</PlateRow>}
          <PlateRow label="Delay">None</PlateRow>
          <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
        </dl>
      </Plate>
      {!kitOpen && (
        <Field label="Kit passphrase" htmlFor="lock-out-now-kit-passphrase" hint="Your Kit is stored encrypted on this device.">
          <Input
            id="lock-out-now-kit-passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
          />
        </Field>
      )}
      <Button
        size="lg"
        variant={pending ? 'secondary' : 'primary'}
        className="w-full"
        disabled={!!busy || (!kitOpen && !passphrase)}
        onClick={() => onLockOut(passphrase)}
      >
        <BusyLabel busy={busy}>
          <KeyRound className="h-5 w-5" /> Lock out now with Kit and key
        </BusyLabel>
      </Button>
      {!pending && (
        <p className="text-center text-sm text-muted">Without your key, start the {EVICTION_DAYS[eviction.level ?? 0]}-day lock-out below.</p>
      )}
    </section>
  )
}

/** Who can stop a running lock-out: two owners together. With a security key, any two of the three (ADR-038). */
function CanStopIt({ withKey }: { withKey: boolean }) {
  if (!withKey) {
    return (
      <span className="inline-flex items-center gap-2">
        <ApprovalSquares kit tone="hero" /> The old phone + your Kit
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex shrink-0 gap-1">
        <FactorSquare factor="phone" tone="hero" />
        <FactorSquare factor="kit" tone="hero" />
        <FactorSquare factor="key" tone="hero" />
      </span>
      Any two of the old phone, your Kit, your key
    </span>
  )
}

/** Clock time, with the day when the delay spans days. */
function moment(ms: number, withDay: boolean) {
  return new Date(ms).toLocaleString('en-GB', withDay ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' })
}

type Watch = { kind: 'loading' } | { kind: 'pending'; executeAfter: number } | { kind: 'moved' } | { kind: 'stopped' }

function PendingStep({
  eviction,
  lockOutNow,
  onReady,
  onStartOver,
}: {
  eviction: LocalEviction
  /** With a security key: end the wait with the Kit and the key (#17). */
  lockOutNow: ReactNode
  onReady: () => void
  onStartOver: () => void
}) {
  const now = useNow()
  const { live } = useBlockNumber()
  const [watch, setWatch] = useState<Watch>({ kind: 'loading' })
  const moved = useEffectEvent(onReady)

  // The chain decides: still pending (countdown), finalized elsewhere (take over), or stopped from the old phone.
  useEffect(() => {
    let cancelled = false
    const check = () =>
      readAccount(eviction.account, { keySafe: eviction.oldKeySafe })
        .then((state) => {
          if (cancelled) return
          const ours = state.pendingEviction?.newOwners.some((o) => same(o, eviction.newKeySafe))
          if (state.pendingEviction && ours) return setWatch({ kind: 'pending', executeAfter: state.pendingEviction.executeAfter })
          if (state.owners.some((o) => same(o, eviction.newKeySafe))) {
            setWatch({ kind: 'moved' })
            return moved()
          }
          setWatch({ kind: 'stopped' })
        })
        .catch(() => {})
    check()
    const id = setInterval(check, 5_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [eviction])

  if (watch.kind === 'loading' || watch.kind === 'moved') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border p-6 text-sm text-muted">
        <Spinner /> Reading the lock-out onchain…
      </div>
    )
  }

  if (watch.kind === 'stopped') {
    return (
      <StepCard
        icon={<ShieldX className="h-5 w-5" />}
        title="The lock-out was stopped"
        description="It was stopped from the old phone, with your Kit and Face ID. The old phone stays on the Account."
      >
        <Button variant="secondary" className="w-full" onClick={onStartOver}>
          Start again
        </Button>
      </StepCard>
    )
  }

  const level = eviction.level ?? 0
  const delay = EVICTION_DELAY_SECONDS[level]
  const seconds = Math.floor(now / 1000)
  const remaining = Math.max(0, watch.executeAfter - seconds)
  // The chain's block time can lag the local clock: the button waits 5 s past the deadline.
  const ready = seconds >= watch.executeAfter + 5
  const elapsed = Math.min(1, Math.max(0, 1 - remaining / delay))
  const lit = Math.floor(elapsed * 10)
  const withDay = delay >= 86_400
  const limit = BigInt(eviction.dailyLimit ?? '0')

  return (
    <div className="space-y-5">
      <Plate
        title={
          <span className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 ${live ? 'bg-success' : 'bg-hero-muted'}`} aria-hidden />
            Lock-out · live onchain
          </span>
        }
      >
        <p className="font-mono text-6xl font-semibold tabular-nums tracking-[-0.04em]" aria-live="off">
          {formatDelay(remaining)}
        </p>
        <p className="mt-1 text-sm text-hero-muted">until the old phone is locked out</p>
        <div className="mt-5 grid grid-cols-10 gap-1.5" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`h-6 rounded-[3px] transition-colors duration-300 ${i < lit ? 'bg-accent' : 'bg-hero-2'}`} />
          ))}
        </div>
        <p className="mt-2 flex justify-between gap-3 font-mono text-xs tabular-nums text-hero-muted">
          <span>Started {moment((watch.executeAfter - delay) * 1000, withDay)}</span>
          <span>Takes effect {moment(watch.executeAfter * 1000, withDay)}</span>
        </p>
        <dl className="mt-5">
          <PlateRow label="Old phone">
            <span className="font-mono">{shortAddress(eviction.oldKeySafe)}</span>
            <span className="block text-xs font-normal text-hero-muted">
              Can still spend up to <span className="font-mono">{formatUsdc(limit)}</span> USDC a day
            </span>
          </PlateRow>
          <PlateRow label="New device">
            This device <span className="font-mono text-hero-muted">{shortAddress(eviction.newKeySafe)}</span>
          </PlateRow>
          <PlateRow label="Can stop it">
            <CanStopIt withKey={!!eviction.keyProxy} />
            <span className="block text-xs font-normal text-hero-muted">
              {eviction.keyProxy ? 'Not a thief holding only the phone' : 'Not a thief: they hold only the phone'}
            </span>
          </PlateRow>
        </dl>
        {eviction.startTx && (
          <a
            href={`${EXPLORER_URL}/tx/${eviction.startTx}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-hero-muted transition-colors hover:text-hero-fg"
          >
            Lock-out on Basescan <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </Plate>
      <p className="text-sm text-muted">Next: this device takes over with Face ID and your Kit. Keep this page open, or come back later.</p>
      <Button size="lg" className="w-full" disabled={!ready} onClick={onReady}>
        {ready ? 'Take over' : remaining > 0 ? 'Waiting for the delay…' : 'Waiting for the network…'}
      </Button>
      {lockOutNow && <div className="border-t border-border pt-6">{lockOutNow}</div>}
    </div>
  )
}

function TakeoverStep({
  eviction,
  kitOpen,
  busy,
  onTakeOver,
}: {
  eviction: LocalEviction
  kitOpen: boolean
  busy: string | null
  onTakeOver: (passphrase: string) => void
}) {
  const [passphrase, setPassphrase] = useState('')
  const limit = BigInt(eviction.dailyLimit ?? '0')
  return (
    <div className="space-y-5">
      <Plate title="Face ID and your Kit will approve">
        <dl>
          <PlateRow label="This device">
            Face ID, up to <span className="font-mono">{formatUsdc(limit)}</span> USDC a day
          </PlateRow>
          <PlateRow label="Old phone">
            Locked out <span className="font-mono text-hero-muted">{shortAddress(eviction.oldKeySafe)}</span>
          </PlateRow>
          <PlateRow label="Approval">
            <span className="inline-flex items-center gap-2">
              <ApprovalSquares kit tone="hero" /> Face ID + your Recovery Kit
            </span>
          </PlateRow>
          <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
        </dl>
      </Plate>
      {!kitOpen && (
        <Field label="Kit passphrase" htmlFor="takeover-kit-passphrase" hint="Your Kit is stored encrypted on this device.">
          <Input
            id="takeover-kit-passphrase"
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
          />
        </Field>
      )}
      <Button size="lg" className="w-full" disabled={!!busy || (!kitOpen && !passphrase)} onClick={() => onTakeOver(passphrase)}>
        <BusyLabel busy={busy}>
          <KeyRound className="h-5 w-5" /> Take over with Kit and Face ID
        </BusyLabel>
      </Button>
    </div>
  )
}

function DoneStep({ done }: { done: Done }) {
  const links = [
    { label: 'Locked out at once', tx: done.lockOutNowTx },
    { label: 'Lock-out', tx: done.startTx },
    { label: 'Old phone removed', tx: done.finalizeTx },
    { label: 'Limit moved', tx: done.handoverTx },
  ].filter((l): l is { label: string; tx: string } => !!l.tx)
  return (
    <div className="space-y-5">
      <Plate title="Moved · live onchain" className="animate-enter">
        <dl>
          <PlateRow label="Old phone">
            Locked out{done.lockOutNowTx ? ' at once' : ''} <span className="font-mono text-hero-muted">{shortAddress(done.oldKeySafe)}</span>
            {done.lockOutNowTx && <span className="block text-xs font-normal text-hero-muted">With your Kit and your security key</span>}
          </PlateRow>
          <PlateRow label="This device">
            <span className="inline-flex items-center gap-2">
              <ApprovalSquares kit={false} tone="hero" />
              <span>
                Face ID, up to <span className="font-mono">{formatUsdc(done.dailyLimit)}</span> USDC a day
              </span>
            </span>
          </PlateRow>
          <PlateRow label="Recovery Kit">Unchanged: keep it safe</PlateRow>
        </dl>
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {links.map((l) => (
            <a
              key={l.label}
              href={`${EXPLORER_URL}/tx/${l.tx}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-hero-muted transition-colors hover:text-hero-fg"
            >
              {l.label} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ))}
        </p>
      </Plate>
      <ButtonLink href="/" size="lg" className="w-full">
        Open my Account
      </ButtonLink>
    </div>
  )
}
