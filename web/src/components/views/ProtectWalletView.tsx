'use client'

import { CircleCheck, Cloud, Download, ExternalLink, Eye, EyeOff, FileKey, KeyRound, ScanFace, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { useWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { Button, ButtonLink } from '@/components/ui/button'
import { Alert, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
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
    if (ready && !wallet) router.replace('/welcome')
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

  return (
    <div className="space-y-8">
      <Stepper steps={ONBOARDING_STEPS} current={1} />
      <div key={step} className="animate-enter space-y-8">
        <div>
          <p className="text-sm font-medium text-accent">
            Step {STEPS.indexOf(step) + 1} of {STEPS.length}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
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
          <Link href="/" className="text-muted hover:text-foreground">
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

const LOCKS = [
  { icon: ScanFace, title: 'Face ID', text: 'Everyday payments, up to your daily limit' },
  { icon: Cloud, title: 'Your iCloud or Google account', text: 'Keeps your encrypted Kit file' },
  { icon: KeyRound, title: 'Your Kit passphrase', text: 'Opens the Kit: large payments, a new phone' },
]

function ThreeLocks() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <p className="text-sm font-medium">Three locks, all held by you</p>
      <ul className="mt-3 space-y-3">
        {LOCKS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-medium">{title}</span>
              <span className="block text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Swissquote never sees your Kit or your passphrase.</p>
    </div>
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
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${i <= level ? STRENGTH_TONE[level] : 'bg-border'}`}
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
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <FileKey className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-xs">{kitFileName(kit)}</p>
            <p className="mt-0.5 text-xs text-muted">Encrypted with your passphrase</p>
          </div>
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
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold transition-colors duration-200 ${
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
      toast.success('Your Recovery Kit works')
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
          file ? 'border-success bg-success-soft' : 'border-border bg-surface-2 hover:border-accent'
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
      <div className="text-center">
        <div className="animate-pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Your wallet is protected</h1>
        <p className="mt-2 text-muted">
          This phone spends up to your daily limit. Anything above it, or a new phone, needs your Kit.
        </p>
      </div>

      <dl className="animate-enter divide-y divide-border rounded-2xl border border-border bg-surface px-4 shadow-card [animation-delay:80ms] sm:px-5">
        <SummaryRow label="Account">
          <AddressPill address={account} />
        </SummaryRow>
        {dailyLimit !== null && <SummaryRow label="Daily limit">{formatUsdcShort(dailyLimit)} USDC with Face ID</SummaryRow>}
        <SummaryRow label="Recovery Kit">Saved and tested</SummaryRow>
        <SummaryRow label="Stolen phone locked out">
          After {EVICTION_DAYS[level]} days
          {EVICTION_DELAY_IS_DEMO && (
            <span className="block text-xs font-normal text-muted">
              {Math.round(EVICTION_DELAY_SECONDS[level] / 60)} minutes in this demo
            </span>
          )}
        </SummaryRow>
      </dl>

      <div className="space-y-3">
        <ButtonLink href="/" size="lg" className="w-full">
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
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}
