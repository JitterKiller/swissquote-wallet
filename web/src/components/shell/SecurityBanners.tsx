'use client'

import type { MetaTransaction } from 'abstractionkit'
import { ArrowUpRight, KeyRound, ShieldAlert, ShieldX, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { Address } from 'viem'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { Button } from '@/components/ui/button'
import { ApprovalSquares, FactorSquare } from '@/components/ui/factor'
import { Alert, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Plate, PlateRow } from '@/components/ui/plate'
import type { AccountState } from '@/lib/account'
import { EVICTION_DELAY_SECONDS, EXPLORER_URL } from '@/lib/config'
import { cancelEvictionCalls, safeRevertReason, thiefCancelCalls } from '@/lib/eviction'
import { errorChain, errorMessage, formatCountdown, formatDelay, formatTime, shortAddress } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { recoveryModule, type PendingRecovery } from '@/lib/recovery'
import { KitPassphraseError, unlockKit } from '@/lib/recoveryKit'
import { loadLocalKit, toPublicKey } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

import { Logo } from './Logo'

/** Shown on every page of the CURRENT device while a recovery is pending. */
export function RecoveryAlert({ pending }: { pending: PendingRecovery }) {
  const { wallet, refresh } = useLoadedWallet()
  const now = useNow()
  const [step, setStep] = useState<SendStep | null>(null)
  const remaining = Math.max(0, pending.executeAfter - Math.floor(now / 1000))

  async function cancel() {
    try {
      await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: [recoveryModule.createCancelRecoveryMetaTransaction()],
        onStep: setStep,
      })
      toast.success('Recovery cancelled. Your wallet stays on this device.')
      refresh()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  return (
    <div role="alert" className="overflow-hidden rounded-2xl border border-danger/30 bg-danger-soft">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-white">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Recovery requested for your wallet</p>
          <p className="mt-0.5 text-sm text-muted">
            Someone asked to move your wallet to a new device ({shortAddress(pending.newOwners[0] ?? '')}). It
            becomes effective in{' '}
            <span className="font-semibold tabular-nums text-foreground">{formatCountdown(remaining)}</span>.
            Swissquote alerted you by push, email, SMS and e-banking (mock).
          </p>
        </div>
        <Button variant="danger" onClick={cancel} disabled={step !== null} className="shrink-0">
          {step ? (
            <>
              <Spinner /> {SEND_STEP_LABEL[step]}
            </>
          ) : (
            'This wasn’t me: cancel recovery'
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * Shown on every page of the CURRENT phone while a lock-out of this phone is pending (#16, PDR-018).
 * The owner stops it with the Kit and Face ID; a thief holding only the phone cannot.
 */
export function EvictionAlert({ pending }: { pending: NonNullable<AccountState['pendingEviction']> }) {
  const { wallet, chain, refresh } = useLoadedWallet()
  const now = useNow()
  const [open, setOpen] = useState(false)
  const remaining = Math.max(0, pending.executeAfter - Math.floor(now / 1000))
  const evictionModule = chain.account?.evictionModule ?? null
  const level = wallet.level ?? ((chain.account?.guardians.length ?? 0) > 1 ? 1 : 0)
  const startedAt = (pending.executeAfter - EVICTION_DELAY_SECONDS[level]) * 1000

  return (
    <div role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger text-background">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Someone asked to lock this phone out</p>
          <p className="mt-0.5 text-sm text-foreground/75">
            Effective in <span className="font-mono font-semibold tabular-nums text-foreground">{formatDelay(remaining)}</span>. If it
            wasn’t you, stop it with your Kit and Face ID. Moving to a new phone yourself? Nothing to do here.
          </p>
        </div>
        {!open && (
          <Button variant="danger" className="shrink-0" onClick={() => setOpen(true)}>
            This wasn’t me
          </Button>
        )}
      </div>
      {open && wallet.account && evictionModule && (
        <StopLockOut
          account={wallet.account}
          evictionModule={evictionModule}
          startedAt={startedAt}
          onStopped={refresh}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

type Outcome = { kind: 'refused'; reason: string | null } | { kind: 'error'; title: string; message: string }

function StopLockOut({
  account,
  evictionModule,
  startedAt,
  onStopped,
  onClose,
}: {
  account: Address
  evictionModule: Address
  startedAt: number
  onStopped: () => void
  onClose: () => void
}) {
  const { wallet } = useLoadedWallet()
  const [hasLocalKit] = useState(() => loadLocalKit() !== null)
  const [kitFile, setKitFile] = useState<{ name: string; text: string } | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [step, setStep] = useState<SendStep | 'opening' | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const result = useRef<HTMLDivElement>(null)

  // The answer lands below the plate: bring it into view on a phone held up in the demo.
  useEffect(() => {
    if (!outcome) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    result.current?.scrollIntoView({
      block: 'nearest',
      behavior: still ? 'auto' : 'smooth',
    })
  }, [outcome])

  const send = (calls: MetaTransaction[]) =>
    sendCalls({
      address: wallet.address,
      credentialId: wallet.credentialId,
      publicKey: toPublicKey(wallet),
      calls,
      onStep: setStep,
    })

  async function stop() {
    setOutcome(null)
    try {
      setStep('opening')
      const kit = (await unlockKit(passphrase, kitFile?.text)).owner
      await send(
        await cancelEvictionCalls({
          account,
          keySafe: wallet.address,
          evictionModule,
          kit,
        }),
      )
      setPassphrase('')
      toast.success('Lock-out stopped. This phone stays on your Account.')
      onStopped()
    } catch (e) {
      setOutcome({
        kind: 'error',
        title: 'Not stopped',
        message: e instanceof KitPassphraseError ? 'Wrong Kit passphrase. Check it and try again.' : errorMessage(e),
      })
    } finally {
      setStep(null)
    }
  }

  // Demo (shape round): what a thief with this phone alone would try. The Account must refuse it.
  async function tryAlone() {
    setOutcome(null)
    const calls = thiefCancelCalls({
      account,
      keySafe: wallet.address,
      evictionModule,
    })
    try {
      await send(calls)
      setOutcome({
        kind: 'error',
        title: 'Unexpected',
        message: 'A cancel with this phone alone went through. Report it.',
      })
    } catch (e) {
      // The bundler's simulation reverts (EXECUTION_REVERTED); eth_call names the Safe's reason.
      if (/EXECUTION_REVERTED|-32521|GS0\d\d/.test(errorChain(e))) {
        setOutcome({
          kind: 'refused',
          reason: await safeRevertReason(wallet.address, calls[0]),
        })
      } else {
        setOutcome({
          kind: 'error',
          title: 'Not sent',
          message: errorMessage(e),
        })
      }
    } finally {
      setStep(null)
    }
  }

  const label = step === 'opening' ? 'Opening your Kit…' : step ? SEND_STEP_LABEL[step] : null
  const pickFile = async (file: File | undefined) => file && setKitFile({ name: file.name, text: await file.text() })

  return (
    <div className="space-y-4 border-t border-danger/20 p-5">
      <div className="flex gap-3">
        <ApprovalSquares kit className="mt-[5px]" />
        <div>
          <h2 className="text-sm font-semibold">Stop the lock-out</h2>
          <p className="mt-0.5 text-sm text-foreground/75">Your Kit passphrase, then Face ID: two of your factors.</p>
        </div>
      </div>
      {(!hasLocalKit || kitFile) && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-danger/30 bg-surface px-4 py-3 text-sm focus-within:border-accent-ink focus-within:ring-4 focus-within:ring-accent-soft">
          <Upload className="h-4 w-4 shrink-0 text-muted" />
          <span className="min-w-0 truncate">{kitFile ? kitFile.name : 'Choose your Kit file'}</span>
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Recovery Kit file"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </label>
      )}
      <Field label="Kit passphrase" htmlFor="stop-kit-passphrase">
        <Input
          id="stop-kit-passphrase"
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          autoComplete="off"
        />
      </Field>
      <Plate title="Face ID and your Kit will stop it">
        <dl>
          <PlateRow label="Stops">The lock-out started at {formatTime(startedAt)}</PlateRow>
          <PlateRow label="Approval">
            <span className="inline-flex items-center gap-2">
              <ApprovalSquares kit tone="hero" /> Face ID + your Kit
            </span>
          </PlateRow>
          <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
        </dl>
      </Plate>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Button variant="danger" size="lg" disabled={!passphrase || (!hasLocalKit && !kitFile) || !!step} onClick={stop}>
          {label ? (
            <>
              <Spinner /> {label}
            </>
          ) : (
            <>
              <KeyRound className="h-5 w-5" /> Stop it with Kit and Face ID
            </>
          )}
        </Button>
        <Button variant="secondary" size="lg" disabled={!!step} onClick={onClose}>
          Close
        </Button>
      </div>
      <Button variant="ghost" className="w-full" disabled={!!step} onClick={tryAlone}>
        <ShieldX className="h-4 w-4" /> Demo: try with Face ID only
      </Button>
      {outcome?.kind === 'refused' && (
        <div ref={result} role="status" className="flex scroll-mb-28 gap-3 border-t border-danger/20 pt-4">
          <span className="mt-[5px] inline-flex shrink-0 gap-1" aria-hidden>
            <FactorSquare factor="phone" />
            <span className="inline-block h-2.5 w-2.5 ring-1 ring-inset ring-foreground/40" />
          </span>
          <div>
            <p className="font-semibold text-danger">Refused by your Account</p>
            <p className="mt-0.5 font-mono text-xs tabular-nums">{outcome.reason ?? 'Reverted'} · 1 of 2 factors</p>
            <p className="mt-1 text-sm text-foreground/75">
              Stopping a lock-out needs this phone and your Kit. A thief holds only this phone.
            </p>
          </div>
        </div>
      )}
      {outcome?.kind === 'error' && (
        <div ref={result} className="scroll-mb-28">
          <Alert tone="danger" title={outcome.title}>
            {outcome.message}
          </Alert>
        </div>
      )}
    </div>
  )
}

/** This phone lost its keys: the Kit locked it out of the Account (eviction), or a legacy recovery moved the wallet. */
export function RevokedScreen({ onForget, account }: { onForget: () => void; account?: Address | null }) {
  const evicted = !!account
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-danger-soft text-danger">
            <ShieldX className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">
            {evicted ? 'This phone was locked out' : 'This device no longer controls this wallet'}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {evicted
              ? 'Your Recovery Kit moved your Account to a new phone. This phone is no longer one of its owners: it cannot spend or sign anything, even in a thief’s hands.'
              : 'The wallet was recovered to a new device. This passkey was removed from the wallet and can no longer sign anything, even if this device was stolen.'}
          </p>
          {evicted && (
            <a
              href={`${EXPLORER_URL}/address/${account}#readProxyContract`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
            >
              Check the owners on Basescan <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
          <Button variant="secondary" className="mt-6 w-full" onClick={onForget}>
            Remove this wallet from this {evicted ? 'phone' : 'device'}
          </Button>
        </div>
      </div>
    </div>
  )
}
