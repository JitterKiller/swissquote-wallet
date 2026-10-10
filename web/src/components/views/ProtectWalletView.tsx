'use client'

import { CircleCheck, Clock, Download, FileKey, Landmark, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useWallet } from '@/components/providers/WalletProvider'
import { Button, ButtonLink } from '@/components/ui/button'
import { Alert, Spinner } from '@/components/ui/feedback'
import { Stepper } from '@/components/ui/stepper'
import { api } from '@/lib/api'
import { RECOVERY_DELAY_LABEL } from '@/lib/config'
import { errorMessage } from '@/lib/format'
import { recoverySetupCalls } from '@/lib/recovery'
import { createRecoveryKit, downloadRecoveryKit, type RecoveryKit } from '@/lib/recoveryKit'
import { toPublicKey } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

import { ONBOARDING_STEPS } from './CreateWalletView'

/**
 * Registers two guardians on the Safe in one gasless UserOp:
 *  - the Recovery Kit (key generated here, downloaded, never stored),
 *  - the Swissquote Guardian (signs only after identity verification).
 */
export function ProtectWalletView() {
  const { ready, wallet, refresh } = useWallet()
  const router = useRouter()
  const [kit, setKit] = useState<RecoveryKit | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [step, setStep] = useState<SendStep | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (ready && !wallet) router.replace('/welcome')
  }, [ready, wallet, router])

  if (!ready || !wallet) return null

  async function activate() {
    if (!wallet || !kit) return
    setError(null)
    try {
      setStep('preparing')
      const { guardian } = await api<{ guardian: string }>('/api/guardian')
      await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: recoverySetupCalls(wallet.address, kit.guardianAddress, guardian),
        onStep: setStep,
      })
      refresh()
      setDone(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  if (done) {
    return (
      <div className="space-y-8">
        <Stepper steps={ONBOARDING_STEPS} current={2} />
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
            <CircleCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight">Your wallet is protected</h1>
          <p className="mt-2 text-muted">
            Keep your Recovery Kit somewhere safe. You’re ready to receive and send USDC.
          </p>
        </div>
        <ButtonLink href="/" size="lg" className="w-full">
          Go to my wallet
        </ButtonLink>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Stepper steps={ONBOARDING_STEPS} current={1} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Protect your wallet</h1>
        <p className="mt-2 text-muted">
          If you lose this device, two approvals get your wallet back. Neither can do anything alone.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <GuardianCard
          icon={<FileKey className="h-5 w-5" />}
          title="Your Recovery Kit"
          text="A file you keep offline: printed or in a password manager. Not on this device."
        />
        <GuardianCard
          icon={<Landmark className="h-5 w-5" />}
          title="Swissquote"
          text="Approves only after verifying your identity with a video call."
        />
      </div>

      <ul className="space-y-2 text-sm text-muted">
        <li className="flex gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" /> Every recovery waits {RECOVERY_DELAY_LABEL}. You can cancel it
          from this device.
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> Swissquote alone can never take control of your wallet.
        </li>
      </ul>

      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
        <Button
          variant={kit ? 'secondary' : 'primary'}
          className="w-full"
          onClick={() => {
            const next = kit ?? createRecoveryKit(wallet.address)
            downloadRecoveryKit(next)
            setKit(next)
          }}
        >
          {kit ? <CircleCheck className="h-4 w-4 text-success" /> : <Download className="h-4 w-4" />}
          {kit ? 'Recovery Kit downloaded ✓' : 'Download Recovery Kit'}
        </Button>
        <label className={`flex items-start gap-3 text-sm ${kit ? '' : 'opacity-50'}`}>
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            disabled={!kit}
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I stored my Recovery Kit somewhere safe, not on this device.
        </label>
        <Button size="lg" className="w-full" disabled={!kit || !confirmed || step !== null} onClick={activate}>
          {step ? (
            <>
              <Spinner /> {SEND_STEP_LABEL[step]}
            </>
          ) : (
            'Activate protection'
          )}
        </Button>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      <p className="text-center text-sm">
        <Link href="/" className="text-muted hover:text-foreground">
          Skip for now
        </Link>
      </p>
    </div>
  )
}

function GuardianCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  )
}
