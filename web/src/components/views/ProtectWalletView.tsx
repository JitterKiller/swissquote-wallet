'use client'

import { CircleCheck, Download, ExternalLink, Eye, EyeOff, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { useWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { Button, ButtonLink } from '@/components/ui/button'
import { FactorLabel, FactorSquare, type Factor } from '@/components/ui/factor'
import { Alert, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Plate, PlateRow } from '@/components/ui/plate'
import { Stepper } from '@/components/ui/stepper'
import { predictAccountAddress } from '@/lib/account'
import { EVICTION_DAYS, EVICTION_DELAY_IS_DEMO, EVICTION_DELAY_SECONDS, EXPLORER_URL, type Level } from '@/lib/config'
import { errorMessage, formatUsdcShort } from '@/lib/format'
import {
  KitPassphraseError,
  PASSPHRASE_STRENGTH_LABEL,
  createKitKeys,
  decryptKit,
  downloadKit,
  encryptKit,
  kitAccounts,
  kitAddresses,
  kitFileName,
  parseKitFile,
  passphraseIssue,
  passphraseStrength,
  type KitKeys,
  type RecoveryKitV3,
} from '@/lib/recoveryKit'
import { getSession } from '@/lib/session'
import { saveKitTestedAt } from '@/lib/storage'

import { AccountSetupStep, type AccountActivation } from './AccountSetupStep'
import { ONBOARDING_STEPS } from './CreateWalletView'

type Step = 'passphrase' | 'save' | 'test' | 'limit'
const STEPS: Step[] = ['passphrase', 'save', 'test', 'limit']

const COPY: Record<Step, { title: string; description: string }> = {
  passphrase: {
    title: 'Protect your wallet',
    description: 'Create your Recovery Kit: a second key to your wallet, locked with a passphrase only you know.',
  },
  save: {
    title: 'Save your Recovery Kit',
    description: 'Keep the file somewhere you can reach without this phone.',
  },
  test: {
    title: 'Test your Recovery Kit',
    description: 'Open the file you just saved and type your passphrase. This proves you can use it on a new phone.',
  },
  limit: {
    title: 'Choose your daily limit',
    description: 'Face ID alone can spend up to this amount a day. Above it, you also need your Kit passphrase.',
  },
}

/**
 * Protect flow (issues #9 and #10, PDR-016, PDR-020, ADR-017, ADR-018):
 * passphrase → encrypted Kit downloaded → Kit tested → daily limit → one sponsored UserOp
 * creating the Account. The Kit keys live in memory only until the Account is set up; the
 * passphrase is never stored or sent.
 */
export function ProtectWalletView() {
  const { ready, wallet } = useWallet()
  const router = useRouter()
  const [step, setStep] = useState<Step>('passphrase')
  const [keys, setKeys] = useState<KitKeys | null>(null)
  const [kit, setKit] = useState<RecoveryKitV3 | null>(null)
  const [encrypting, setEncrypting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Level 1 when signed in with Swissquote (MOCK session); upgrading later is issue #21.
  const [level] = useState<Level>(() => (getSession() ? 1 : 0))
  const [activation, setActivation] = useState<AccountActivation | null>(null)

  useEffect(() => {
    if (ready && !wallet) router.replace('/wallet/welcome')
  }, [ready, wallet, router])

  if (!ready || !wallet) return null

  if (activation) {
    return <Protected account={activation.account} dailyLimit={activation.dailyLimit} level={level} />
  }
  if (wallet.account) {
    return (
      <Protected
        account={wallet.account}
        dailyLimit={wallet.dailyLimit ? BigInt(wallet.dailyLimit) : null}
        level={wallet.level ?? 0}
      />
    )
  }

  async function createKit(passphrase: string) {
    if (!wallet) return
    setEncrypting(true)
    setError(null)
    try {
      const next = createKitKeys()
      const account = predictAccountAddress({ keySafe: wallet.address, kitOwner: kitAccounts(next).owner.address })
      setKit(await encryptKit(next, passphrase, { account, keySafe: wallet.address }))
      setKeys(next)
      setStep('save')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setEncrypting(false)
    }
  }

  function restart() {
    setKeys(null)
    setKit(null)
    setStep('passphrase')
  }

  const { title, description } = COPY[step]
  const index = STEPS.indexOf(step)

  return (
    <div className="space-y-6">
      <Stepper steps={['Create', `Protect ${index + 1}/${STEPS.length}`, 'Done']} current={1} />
      <div key={step} className="animate-enter space-y-6">
        <div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">{title}</h1>
          <p className="mt-2 text-muted">{description}</p>
        </div>

        {step === 'passphrase' && <PassphraseStep busy={encrypting} error={error} onCreate={createKit} />}
        {step === 'save' && kit && <SaveStep kit={kit} onContinue={() => setStep('test')} />}
        {step === 'test' && kit && <TestStep kit={kit} onTested={() => setStep('limit')} onRestart={restart} />}
        {step === 'limit' && kit && keys && (
          <AccountSetupStep
            wallet={wallet}
            kit={kit}
            keys={keys}
            level={level}
            onActivated={(result) => {
              setKeys(null)
              setActivation(result)
            }}
          />
        )}
      </div>

      {step === 'passphrase' && (
        <p className="text-center text-sm">
          <Link href="/wallet" className="text-muted hover:text-foreground">
            Skip for now
          </Link>
        </p>
      )}
    </div>
  )
}

// ── 1. Passphrase ───────────────────────────────────────────────────────────

function PassphraseStep({
  busy,
  error,
  onCreate,
}: {
  busy: boolean
  error: string | null
  onCreate: (passphrase: string) => void
}) {
  const [passphrase, setPassphrase] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)

  const strength = passphraseStrength(passphrase)
  const tooShort = passphrase.length > 0 && passphraseIssue(passphrase)
  const mismatch = confirm.length > 0 && confirm !== passphrase && confirm.length >= passphrase.length
  const canCreate = strength >= 2 && confirm === passphrase && !busy

  return (
    <div className="space-y-6">
      <ThreeLocks />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (canCreate) onCreate(passphrase)
        }}
      >
        <Field
          label="Kit passphrase"
          htmlFor="kit-passphrase"
          error={tooShort || (strength === 1 ? 'Too easy to guess: add another word or two.' : null)}
          hint="At least 12 characters. Three or four random words work well. Never your phone passcode."
        >
          <div className="relative">
            <Input
              id="kit-passphrase"
              type={visible ? 'text' : 'password'}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label={visible ? 'Hide passphrase' : 'Show passphrase'}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <StrengthMeter strength={passphrase ? strength : null} />

        <Field label="Confirm passphrase" htmlFor="kit-passphrase-confirm" error={mismatch && 'The passphrases don’t match.'}>
          <Input
            id="kit-passphrase-confirm"
            type={visible ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <Alert>
          Don’t save it in this phone’s password manager. If someone steals your unlocked phone, the passphrase is what
          keeps your Kit closed.
        </Alert>

        <Button type="submit" size="lg" className="w-full" disabled={!canCreate}>
          {busy ? (
            <>
              <Spinner /> Encrypting your Kit…
            </>
          ) : (
            'Create my Recovery Kit'
          )}
        </Button>
        {error && <Alert tone="danger">{error}</Alert>}
      </form>
    </div>
  )
}

// The same three locks, with the same codes and words, on every screen (components/ui/factor).
const LOCKS: { factor: Factor; title: string; text: string }[] = [
  { factor: 'phone', title: 'Face ID on this phone', text: 'Pays on its own, up to your daily limit' },
  { factor: 'cloud', title: 'Your iCloud or Google account', text: 'Keeps your encrypted Kit file' },
  { factor: 'kit', title: 'Your Kit passphrase', text: 'Opens the Kit: above your limit, or a new phone' },
]

function ThreeLocks() {
  return (
    <section>
      <h2 className="text-sm font-semibold">Three locks, all held by you</h2>
      <ul className="mt-2 border-t border-border">
        {LOCKS.map(({ factor, title, text }) => (
          <li
            key={title}
            className="grid grid-cols-[10px_1fr] items-baseline gap-x-3 border-b border-border py-2.5 text-sm sm:grid-cols-[10px_13rem_1fr]"
          >
            <FactorSquare factor={factor} />
            <span className="font-medium">{title}</span>
            <span className="col-start-2 text-muted sm:col-start-auto">{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">
        Your Recovery Kit is the file and its passphrase together. Swissquote never sees either, and holds none of
        these locks.
      </p>
    </section>
  )
}

const STRENGTH_TONE = ['bg-border', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success']

function StrengthMeter({ strength }: { strength: number | null }) {
  const level = strength ?? 0
  return (
    <div className="-mt-1 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-[2px] transition-colors duration-200 ${i <= level ? STRENGTH_TONE[level] : 'bg-border'}`}
          />
        ))}
      </div>
      <span className="w-20 text-right text-xs text-muted">
        {strength === null ? '' : PASSPHRASE_STRENGTH_LABEL[strength]}
      </span>
    </div>
  )
}

// ── 2. Save ─────────────────────────────────────────────────────────────────

function SaveStep({ kit, onContinue }: { kit: RecoveryKitV3; onContinue: () => void }) {
  const [downloaded, setDownloaded] = useState(false)
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
        <div className="min-w-0">
          <p className="token text-muted">Recovery Kit · encrypted with your passphrase</p>
          <p className="mt-1.5 truncate font-mono text-sm">{kitFileName(kit)}</p>
        </div>
        <Button
          variant={downloaded ? 'secondary' : 'primary'}
          className="w-full"
          onClick={() => {
            downloadKit(kit)
            setDownloaded(true)
          }}
        >
          {downloaded ? <CircleCheck className="h-4 w-4 text-success" /> : <Download className="h-4 w-4" />}
          {downloaded ? 'Downloaded · download again' : 'Download Recovery Kit'}
        </Button>
      </div>

      <ol className="space-y-3 text-sm">
        <Instruction n={1} done={downloaded}>
          Download the file.
        </Instruction>
        <Instruction n={2}>
          Move it to <span className="font-medium">iCloud Drive</span> or <span className="font-medium">Google Drive</span>
          , so you can open it from a new phone.
        </Instruction>
        <Instruction n={3}>Keep the passphrase apart from the file. On its own, the file is useless.</Instruction>
      </ol>

      <Button size="lg" className="w-full" disabled={!downloaded} onClick={onContinue}>
        I saved it, continue
      </Button>
    </div>
  )
}

function Instruction({ n, done = false, children }: { n: number; done?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-[11px] font-semibold tabular-nums transition-colors duration-200 ${
          done ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted'
        }`}
      >
        {done ? <CircleCheck className="h-3.5 w-3.5" /> : n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  )
}

// ── 3. Test ─────────────────────────────────────────────────────────────────

function TestStep({ kit, onTested, onRestart }: { kit: RecoveryKitV3; onTested: () => void; onRestart: () => void }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function test() {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const parsed = parseKitFile(file.text)
      const expected = kitAddresses(kit)
      if (parsed.version !== 3 || kitAddresses(parsed.kit).owner !== expected.owner) {
        throw new Error('This is not the Kit you just created. Pick the file you just downloaded.')
      }
      const accounts = await decryptKit(parsed.kit, passphrase)
      if (accounts.owner.address !== expected.owner || accounts.guardian.address !== expected.guardian) {
        throw new Error('This Kit file is damaged. Download it again.')
      }
      saveKitTestedAt()
      onTested()
    } catch (e) {
      setError(e instanceof KitPassphraseError ? 'Wrong passphrase. Check it and try again.' : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        test()
      }}
    >
      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm transition-colors ${
          file ? 'border-success bg-success-soft' : 'border-border bg-surface-2 hover:border-accent-ink'
        }`}
      >
        {file ? <CircleCheck className="h-5 w-5 shrink-0 text-success" /> : <Upload className="h-5 w-5 shrink-0 text-muted" />}
        <span className="min-w-0">
          <span className="block font-medium">{file ? 'Kit file selected' : 'Choose your Kit file'}</span>
          <span className="block truncate text-xs text-muted">{file ? file.name : 'swissquote-recovery-kit-….json'}</span>
        </span>
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Recovery Kit file"
          className="sr-only"
          onChange={async (e) => {
            const picked = e.target.files?.[0]
            if (picked) setFile({ name: picked.name, text: await picked.text() })
          }}
        />
      </label>

      <Field label="Kit passphrase" htmlFor="kit-test-passphrase">
        <Input
          id="kit-test-passphrase"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="off"
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={!file || !passphrase || busy}>
        {busy ? (
          <>
            <Spinner /> Opening your Kit…
          </>
        ) : (
          'Test my Kit'
        )}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}

      <p className="text-center text-sm text-muted">
        Lost the file or the passphrase?{' '}
        <button type="button" onClick={onRestart} className="font-medium text-foreground hover:underline">
          Create a new Kit
        </button>
      </p>
    </form>
  )
}

// ── Done ────────────────────────────────────────────────────────────────────

function Protected({ account, dailyLimit, level }: { account: `0x${string}`; dailyLimit: bigint | null; level: Level }) {
  return (
    <div className="space-y-8">
      <Stepper steps={ONBOARDING_STEPS} current={2} />
      <div>
        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl">Your wallet is protected</h1>
        <p className="mt-2 text-muted">
          This phone spends up to your daily limit. Anything above it, or a new phone, needs your Kit.
        </p>
      </div>

      <Plate title="Account · live onchain" className="animate-enter">
        <dl>
          <PlateRow label={<FactorLabel tone="hero">Account</FactorLabel>}>
            <AddressPill address={account} tone="hero" />
          </PlateRow>
          <PlateRow label={<FactorLabel factors={['phone', 'kit']} tone="hero">Owners</FactorLabel>}>Only you: this phone and your Kit</PlateRow>
          {dailyLimit !== null && (
            <PlateRow label={<FactorLabel factors={['phone']} tone="hero">Face ID alone</FactorLabel>}>
              Up to <span className="tabular-nums">{formatUsdcShort(dailyLimit)}</span> USDC a day
            </PlateRow>
          )}
          <PlateRow label={<FactorLabel factors={['kit']} tone="hero">Recovery Kit</FactorLabel>}>Downloaded and tested</PlateRow>
          <PlateRow label={<FactorLabel factors={['kit']} tone="hero">Lost or stolen phone</FactorLabel>}>
            Your Kit locks it out, {EVICTION_DAYS[level]} days after you start
            <span className="block text-xs font-normal text-hero-muted">A thief can&apos;t cancel it</span>
            {EVICTION_DELAY_IS_DEMO && (
              <span className="block text-xs font-normal text-hero-muted">
                {Math.round(EVICTION_DELAY_SECONDS[level] / 60)} minutes in this demo
              </span>
            )}
          </PlateRow>
        </dl>
      </Plate>

      <div className="space-y-3">
        <ButtonLink href="/wallet" size="lg" className="w-full">
          Go to my wallet
        </ButtonLink>
        <a
          href={`${EXPLORER_URL}/address/${account}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          View your Account on Basescan <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {level === 0 && (
        <section aria-labelledby="client-title" className="rounded-2xl border border-border p-5">
          <h2 id="client-title" className="font-semibold">
            Swissquote client?
          </h2>
          <p className="mt-1 text-sm text-muted">
            Link your account with one Face ID for an @handle, one-tap transfers and all network fees covered. Then, with your Kit, add Swissquote’s
            identity check: a stolen phone is locked out after {EVICTION_DAYS[1]} days instead of {EVICTION_DAYS[0]}. Swissquote never becomes an
            owner.
          </p>
          <ButtonLink href="/wallet/swissquote" variant="secondary" className="mt-4">
            Link my Swissquote account
          </ButtonLink>
        </section>
      )}
    </div>
  )
}

