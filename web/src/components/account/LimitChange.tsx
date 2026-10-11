'use client'

import { ExternalLink, KeyRound, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatUnits } from 'viem'

import { dailyLimitError, LimitPicker, parseDailyLimit } from '@/components/account/LimitPicker'
import { lossBound } from '@/components/account/LossBound'
import { WorstCaseChange } from '@/components/account/WorstCaseChange'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { Button } from '@/components/ui/button'
import { ApprovalSquares } from '@/components/ui/factor'
import { Alert, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Plate, PlateRow } from '@/components/ui/plate'
import { setDailyLimitCall, twoFactorCall, type AccountState } from '@/lib/account'
import { EXPLORER_URL, USDC_DECIMALS, type Level } from '@/lib/config'
import { errorMessage, formatUsdc } from '@/lib/format'
import { KitPassphraseError, unlockKit } from '@/lib/recoveryKit'
import { loadLocalKit, toPublicKey } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

const FIELD_ID = 'limit-new'
const IMPACT_ID = 'limit-impact'

/**
 * Change the daily limit (#13, PDR-020, ADR-035, surface brief web-src-components-account-limitchange-tsx):
 * the new worst case beside the current one before anything is signed, then Face ID and the Kit sign
 * one sponsored UserOp (`setAllowance` from the Account, a security operation, ADR-023). Up or down.
 */
export function LimitChange({
  state,
  level,
  onClose,
  onChanged,
}: {
  state: AccountState
  level: Level
  onClose: () => void
  /** The limit changed onchain: the receipt replaces the form (the row's Cancel no longer applies). */
  onChanged?: () => void
}) {
  const { wallet, setWallet, refresh } = useLoadedWallet()
  const current = state.allowance?.amount ?? null
  const spent = state.allowance?.spent ?? 0n
  const [value, setValue] = useState(() => (current !== null ? formatUnits(current, USDC_DECIMALS) : ''))
  const [passphrase, setPassphrase] = useState('')
  const [kitFile, setKitFile] = useState<{ name: string; text: string } | null>(null)
  const [hasLocalKit] = useState(() => loadLocalKit() !== null)
  const [step, setStep] = useState<SendStep | 'opening' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ txHash: string; limit: bigint; was: bigint | null } | null>(null)
  const panel = useRef<HTMLElement>(null)

  // Opened below the row (or from the Overview): bring it into view and focus the amount. On the receipt,
  // shorter than the form it replaces, bring the whole row back (its new value above the receipt) and
  // move focus to the receipt: the Approve button that had it is gone.
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = receipt ? (panel.current?.closest('li') ?? panel.current) : panel.current
    target?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
    if (receipt) panel.current?.focus({ preventScroll: true })
    else document.getElementById(FIELD_ID)?.focus({ preventScroll: true })
  }, [receipt])

  const next = parseDailyLimit(value)
  const fieldError = dailyLimitError(value, next) ?? (next === 0n ? 'Choose more than 0.' : null)
  const unchanged = next !== null && current !== null && next === current
  const valid = next !== null && next > 0n && !fieldError && !unchanged
  const kitReady = passphrase.length > 0 && (hasLocalKit || !!kitFile)

  async function approve() {
    if (!valid || next === null || !wallet.account) return
    setError(null)
    try {
      setStep('opening')
      const kit = (await unlockKit(passphrase, kitFile?.text)).owner
      const call = await twoFactorCall({
        account: wallet.account,
        keySafe: wallet.address,
        call: setDailyLimitCall({ keySafe: wallet.address, dailyLimit: next }),
        kit,
      })
      const result = await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: [call],
        onStep: setStep,
      })
      setPassphrase('')
      setWallet({ ...wallet, dailyLimit: next.toString() })
      refresh()
      setReceipt({ txHash: result.txHash, limit: next, was: current })
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
      <section ref={panel} tabIndex={-1} className="scroll-mt-20 space-y-4 outline-none" aria-label="Daily limit changed">
        <Plate title="Limit changed · onchain" className="animate-enter">
          <dl>
            <PlateRow label="Daily limit">
              <span className="font-mono">{formatUsdc(receipt.limit)}</span> USDC a day
              {receipt.was !== null && (
                <span className="block text-xs font-normal text-hero-muted">
                  Was <span className="font-mono">{formatUsdc(receipt.was)}</span>
                </span>
              )}
            </PlateRow>
            <PlateRow label="Worst case">
              <span className="font-mono">{formatUsdc(lossBound(receipt.limit, level))}</span> USDC
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

  return (
    <section ref={panel} className="scroll-mt-20 space-y-5" aria-label="Change your daily limit">
      <LimitPicker id={FIELD_ID} label="New daily limit" value={value} onChange={setValue} error={fieldError} describedBy={IMPACT_ID} />

      <LimitImpact current={current} next={valid ? next : null} spent={spent} level={level} unchanged={unchanged} invalid={!!fieldError} />

      {valid && next !== null && (
        <Plate
          title={
            <span className="inline-flex items-center gap-2">
              <ApprovalSquares kit tone="hero" />
              Face ID and your Kit will approve
            </span>
          }
        >
          <dl>
            <PlateRow label="Daily limit">
              <span className="font-mono">{formatUsdc(next)}</span> USDC a day
              {current !== null && (
                <span className="block text-xs font-normal text-hero-muted">
                  Now <span className="font-mono">{formatUsdc(current)}</span>
                </span>
              )}
            </PlateRow>
            <PlateRow label="Worst case">
              <span className="font-mono">{formatUsdc(lossBound(next, level))}</span> USDC
            </PlateRow>
            <PlateRow label="Approval">
              <span className="inline-flex items-center gap-2">
                <ApprovalSquares kit tone="hero" /> Face ID + your Recovery Kit
              </span>
            </PlateRow>
            <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
          </dl>
        </Plate>
      )}

      <section className="space-y-4 border-t border-border pt-5">
        <div className="flex gap-3">
          <ApprovalSquares kit className="mt-[5px]" />
          <div>
            <h3 className="text-sm font-semibold">Your Recovery Kit approves with Face ID</h3>
            <p className="mt-0.5 text-sm text-muted">
              Up or down, your limit only changes with your Kit: with the phone alone, a thief can’t change your rules or block your spending. Your
              passphrase opens the encrypted Kit{hasLocalKit && !kitFile ? ' stored on this device' : ''}; it never leaves it.
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
        <Field label="Kit passphrase" htmlFor="limit-kit-passphrase">
          <Input id="limit-kit-passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" />
        </Field>
      </section>

      {error && (
        <Alert tone="danger" title="Limit not changed">
          {error}
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <Button variant="secondary" size="lg" disabled={!!step} onClick={onClose}>
          Cancel
        </Button>
        <Button size="lg" disabled={!valid || !kitReady || !!step} onClick={approve}>
          {step ? (
            <>
              <Spinner /> {step === 'opening' ? 'Opening your Kit…' : SEND_STEP_LABEL[step]}
            </>
          ) : (
            <>
              <KeyRound className="h-5 w-5" /> Approve with Kit and biometrics
            </>
          )}
        </Button>
      </div>
    </section>
  )
}

/** The worst case now and with the new limit, on the Apricot Field: a raise is never just a bigger number in a field. */
/** The limit's worst case before → after (shared Worst Case Change), with what the change means today. */
function LimitImpact({
  current,
  next,
  spent,
  level,
  unchanged,
  invalid,
}: {
  current: bigint | null
  next: bigint | null
  spent: bigint
  level: Level
  unchanged: boolean
  invalid: boolean
}) {
  const before = current !== null ? lossBound(current, level) : null
  const after = next !== null ? lossBound(next, level) : null
  const leftToday = next !== null ? (next > spent ? next - spent : 0n) : null
  const showAfter = !unchanged && !invalid && after !== null
  return (
    <WorstCaseChange before={before} after={showAfter ? after : null} label="the new limit" id={IMPACT_ID}>
      {unchanged ? (
        'That is your current limit: pick a new one.'
      ) : invalid ? (
        'Choose a limit from 0.01 to 1,000,000 USDC to see your new worst case.'
      ) : before !== null && after !== null ? (
        <>
          <span className="font-mono tabular-nums">{formatUsdc(after > before ? after - before : before - after)}</span> USDC{' '}
          {after > before ? 'more' : 'less'} than now.{' '}
          {leftToday === 0n ? (
            <>
              You spent <span className="font-mono tabular-nums">{formatUsdc(spent)}</span> today: Face ID can’t spend more until the reset.
            </>
          ) : (
            <>
              Face ID could still spend <span className="font-mono tabular-nums">{formatUsdc(leftToday ?? 0n)}</span> today.
            </>
          )}
        </>
      ) : (
        'Type a new limit to see your new worst case.'
      )}
    </WorstCaseChange>
  )
}
