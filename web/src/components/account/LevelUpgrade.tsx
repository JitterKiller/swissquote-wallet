'use client'

import { Check, ExternalLink, KeyRound, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { lossBound } from '@/components/account/LossBound'
import { chainLevel, type SwissquoteKeys } from '@/components/account/useSwissquoteKeys'
import { WorstCaseChange } from '@/components/account/WorstCaseChange'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { useSwissquoteLink } from '@/components/swissquote/useSwissquoteLink'
import { AddressPill } from '@/components/ui/address'
import { Button, ButtonLink } from '@/components/ui/button'
import { ApprovalSquares } from '@/components/ui/factor'
import { Alert, Skeleton, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Plate, PlateRow } from '@/components/ui/plate'
import { twoFactorCall, upgradeToLevel1Call, type AccountState } from '@/lib/account'
import { EVICTION_DAYS, EVICTION_DELAY_IS_DEMO, EVICTION_DELAY_SECONDS, EXPLORER_URL } from '@/lib/config'
import { errorMessage, formatUsdc } from '@/lib/format'
import { KitPassphraseError, unlockKit } from '@/lib/recoveryKit'
import { loadLocalKit, toPublicKey } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

const DEMO = EVICTION_DELAY_IS_DEMO ? ` (${Math.round(EVICTION_DELAY_SECONDS[1] / 60)} min in this demo)` : ''

/** The demo note for "3 days instead of 7", from the two levels' real delays. */
export function levelDemoNote() {
  if (!EVICTION_DELAY_IS_DEMO) return ''
  const [zero, one] = [Math.round(EVICTION_DELAY_SECONDS[0] / 60), Math.round(EVICTION_DELAY_SECONDS[1] / 60)]
  return zero === one ? ` (${one} min either way in this demo)` : ` (${one} min instead of ${zero} in this demo)`
}

/**
 * Upgrade to level 1 (#21, PDR-015, PDR-018, ADR-036, surface brief web-src-components-account-levelupgrade-tsx):
 * for a linked Swissquote client, Swissquote's guardian key joins the lock-out (threshold 2: the Kit
 * plus an identity check) and the delay drops from 7 days to 3. The worst case before → after and what
 * Swissquote can and never can do are shown before Face ID and the Kit sign one sponsored UserOp.
 */
export function LevelUpgrade({
  state,
  keys,
  onRetryKeys,
  onClose,
  onChanged,
}: {
  state: AccountState
  keys: SwissquoteKeys
  onRetryKeys: () => void
  onClose: () => void
  /** The Account is at level 1 onchain: the receipt replaces the form. */
  onChanged?: () => void
}) {
  const { wallet, setWallet, refresh } = useLoadedWallet()
  const link = useSwissquoteLink(wallet)
  const limit = state.allowance?.amount ?? null
  const [passphrase, setPassphrase] = useState('')
  const [kitFile, setKitFile] = useState<{ name: string; text: string } | null>(null)
  const [hasLocalKit] = useState(() => loadLocalKit() !== null)
  const [step, setStep] = useState<SendStep | 'opening' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ txHash: string } | null>(null)
  const panel = useRef<HTMLElement>(null)

  // Opened below the row (or from /swissquote): bring it into view. On the receipt, bring the whole
  // row back (it now reads 3 days) and move focus to the receipt: the Approve button that had it is gone.
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = receipt ? (panel.current?.closest('li') ?? panel.current) : panel.current
    target?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
    panel.current?.focus({ preventScroll: true })
  }, [receipt])

  const before = limit !== null ? lossBound(limit, 0) : null
  const after = limit !== null ? lossBound(limit, 1) : null
  const guardian = keys.status === 'ok' ? keys.guardian : null
  const kitReady = passphrase.length > 0 && (hasLocalKit || !!kitFile)

  async function approve() {
    if (!wallet.account || !guardian) return
    setError(null)
    try {
      setStep('opening')
      const kit = await unlockKit(passphrase, kitFile?.text)
      const call = await twoFactorCall({
        account: wallet.account,
        keySafe: wallet.address,
        call: upgradeToLevel1Call({ account: wallet.account, state, kitGuardian: kit.guardian.address, swissquoteGuardian: guardian }),
        kit: kit.owner,
      })
      const result = await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: [call],
        onStep: setStep,
      })
      setPassphrase('')
      setWallet({ ...wallet, level: 1 })
      refresh()
      setReceipt({ txHash: result.txHash })
      onChanged?.()
    } catch (e) {
      setError(e instanceof KitPassphraseError ? 'Wrong Kit passphrase. Check it and try again.' : errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  const pickFile = async (file: File | undefined) => file && setKitFile({ name: file.name, text: await file.text() })

  if (receipt) {
    return (
      <section ref={panel} tabIndex={-1} className="scroll-mt-20 space-y-4 outline-none" aria-label="Account at level 1">
        <Plate title="Level 1 · onchain" className="animate-enter">
          <dl>
            <PlateRow label="Lock-out">
              {EVICTION_DAYS[1]} days{DEMO}
              <span className="block text-xs font-normal text-hero-muted">Your Kit + a Swissquote identity check</span>
            </PlateRow>
            <PlateRow label="Guardian">
              Swissquote
              {guardian && (
                <span className="mt-1.5 flex justify-end">
                  <AddressPill address={guardian} tone="hero" />
                </span>
              )}
            </PlateRow>
            <PlateRow label="Worst case">
              <span className="font-mono">{after !== null ? formatUsdc(after) : '–'}</span> USDC
            </PlateRow>
            <PlateRow label="Approved by">
              <span className="inline-flex items-center gap-2">
                <ApprovalSquares kit tone="hero" /> Face ID + your Recovery Kit
              </span>
            </PlateRow>
            <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
          </dl>
          <a
            href={`${EXPLORER_URL}/tx/${receipt.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-hero-muted transition-colors hover:text-hero-fg"
          >
            View on Basescan <ExternalLink className="h-3.5 w-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Plate>
        <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
          Done
        </Button>
      </section>
    )
  }

  // Level 1 is for linked clients, once, and never while a lock-out is running.
  const gate =
    keys.status === 'ok' && chainLevel(state, keys) === 1
      ? 'already'
      : !link.linked
        ? 'link'
        : state.pendingEviction
          ? 'pending'
          : keys.status === 'error'
            ? 'keys'
            : null
  const loading = !link.checked || keys.status === 'loading'

  return (
    <section ref={panel} tabIndex={-1} className="scroll-mt-20 space-y-5 outline-none" aria-label="Upgrade to level 1">
      {loading ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : gate === 'already' ? (
        <div className="space-y-3">
          <p className="font-medium">Your Account is already at level 1</p>
          <p className="text-sm text-muted">A lost phone is locked out after {EVICTION_DAYS[1]} days, with your Kit and a Swissquote identity check.</p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : gate === 'link' ? (
        <div className="space-y-3">
          <p className="font-medium">Level 1 is for Swissquote clients who linked this wallet</p>
          <p className="text-sm text-muted">
            Linking proves this wallet is yours with one Face ID. Swissquote can then check it’s you before a lock-out, and your lost phone is locked
            out after {EVICTION_DAYS[1]} days instead of {EVICTION_DAYS[0]}.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/swissquote">Link your Swissquote account</ButtonLink>
            <Button variant="secondary" onClick={onClose}>
              Not now
            </Button>
          </div>
        </div>
      ) : gate === 'pending' ? (
        <div className="space-y-3">
          <p className="font-medium">A lock-out is in progress</p>
          <p className="text-sm text-muted">Stop it or let it finish before changing who guards the lock-out.</p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : gate === 'keys' ? (
        <div className="space-y-3">
          <p className="font-medium">Couldn’t load Swissquote’s guardian key</p>
          <p className="text-sm text-muted">Nothing changed. The upgrade needs it to name Swissquote as your guardian.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onRetryKeys}>Try again</Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <>
          <WorstCaseChange before={before} after={after} label="level 1">
            Locked out after {EVICTION_DAYS[1]} days instead of {EVICTION_DAYS[0]}
            {levelDemoNote()}. And someone who steals your Kit and its passphrase can’t lock your phone out: Swissquote checks your identity first.
          </WorstCaseChange>

          <section aria-labelledby="level-swissquote">
            <h3 id="level-swissquote" className="text-sm font-semibold">
              With level 1, Swissquote
            </h3>
            <ul className="mt-2 border-t border-border text-sm">
              <PowerLine can>has to confirm it’s you before a lost phone is locked out</PowerLine>
              <PowerLine>never moves your money</PowerLine>
              <PowerLine>never locks you out on its own</PowerLine>
              <PowerLine>never becomes an owner of your Account</PowerLine>
            </ul>
            <p className="mt-2 text-sm text-muted">
              If Swissquote can’t sign, a lock-out waits for it. Before ending the service, Swissquote moves you back to {EVICTION_DAYS[0]} days with your
              Kit alone.
            </p>
          </section>

          <Plate
            title={
              <span className="inline-flex items-center gap-2">
                <ApprovalSquares kit tone="hero" />
                Face ID and your Kit will approve
              </span>
            }
          >
            <dl>
              <PlateRow label="Lock-out">
                {EVICTION_DAYS[1]} days{DEMO}
                <span className="block text-xs font-normal text-hero-muted">Your Kit + a Swissquote identity check</span>
                <span className="block text-xs font-normal text-hero-muted">
                  Now {EVICTION_DAYS[0]} days, your Kit alone
                </span>
              </PlateRow>
              <PlateRow label="New guardian">
                Swissquote
                {guardian && (
                  <span className="mt-1.5 flex justify-end">
                    <AddressPill address={guardian} tone="hero" />
                  </span>
                )}
              </PlateRow>
              <PlateRow label="Worst case">
                <span className="font-mono">{after !== null ? formatUsdc(after) : '–'}</span> USDC
              </PlateRow>
              <PlateRow label="Approval">
                <span className="inline-flex items-center gap-2">
                  <ApprovalSquares kit tone="hero" /> Face ID + your Recovery Kit
                </span>
              </PlateRow>
              <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
            </dl>
          </Plate>

          <section className="space-y-4 border-t border-border pt-5">
            <div className="flex gap-3">
              <ApprovalSquares kit className="mt-[5px]" />
              <div>
                <h3 className="text-sm font-semibold">Your Recovery Kit approves with Face ID</h3>
                <p className="mt-0.5 text-sm text-muted">
                  Changing who guards the lock-out takes your Kit, so a thief with your phone can’t do it. Your passphrase opens the encrypted Kit
                  {hasLocalKit && !kitFile ? ' stored on this device' : ''}; it never leaves it.
                </p>
              </div>
            </div>
            {(!hasLocalKit || kitFile) && (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-sm transition-[border-color,box-shadow] hover:border-accent-ink focus-within:border-accent-ink focus-within:ring-4 focus-within:ring-accent-soft">
                <Upload className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 truncate">{kitFile ? kitFile.name : 'Choose your Kit file'}</span>
                <input type="file" accept="application/json,.json" aria-label="Recovery Kit file" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            )}
            <Field label="Kit passphrase" htmlFor="level-kit-passphrase">
              <Input id="level-kit-passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" />
            </Field>
          </section>

          {error && (
            <Alert tone="danger" title="Not upgraded">
              {error}
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <Button variant="secondary" size="lg" disabled={!!step} onClick={onClose}>
              Cancel
            </Button>
            <Button size="lg" disabled={!kitReady || !guardian || !!step} onClick={approve}>
              {step ? (
                <>
                  <Spinner /> {step === 'opening' ? 'Opening your Kit…' : SEND_STEP_LABEL[step]}
                </>
              ) : (
                <>
                  <KeyRound className="h-5 w-5" /> Approve with Kit and Face ID
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

/** One line of what Swissquote can (a check) or never can (an X) do: ink and Graphite, never green or red. */
function PowerLine({ can = false, children }: { can?: boolean; children: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-border py-2.5">
      {can ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <X className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
      <span>
        {can && <span className="sr-only">Can: </span>}
        {children}
      </span>
    </li>
  )
}
