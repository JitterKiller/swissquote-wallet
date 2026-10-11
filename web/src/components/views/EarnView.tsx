'use client'

import type { MetaTransaction } from 'abstractionkit'
import { ArrowLeft, ExternalLink, KeyRound, ShieldX, Sprout, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { parseUnits, type Address } from 'viem'

import { percent, useEarnPositions } from '@/components/account/EarnCard'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { ComplianceChecks, type ComplianceState } from '@/components/send/ComplianceChecks'
import { AddressPill } from '@/components/ui/address'
import { Button, ButtonLink } from '@/components/ui/button'
import { ApprovalSquares } from '@/components/ui/factor'
import { Alert, Badge, EmptyState, Skeleton, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { useBlockNumber } from '@/components/ui/live'
import { PageHeader } from '@/components/ui/page'
import { Plate, PlateRow } from '@/components/ui/plate'
import { Stepper } from '@/components/ui/stepper'
import { EXPLORER_URL, USDC_DECIMALS } from '@/lib/config'
import { APPROVED_DAPPS, UNLISTED_DEMO, dappActionCalls, dappActionSteps, unlistedDemoCalls, type Dapp, type DappAction } from '@/lib/dapps'
import { errorChain, errorMessage, formatUsdc, shortAddress } from '@/lib/format'
import { cleanAmount } from '@/lib/inputs'
import { KitPassphraseError, unlockKit } from '@/lib/recoveryKit'
import { loadLocalKit, toPublicKey } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

type Position = { dapp: Dapp; supplied: bigint; apy: number }

/**
 * Earn (issue #25, PDR-025, ADR-028, surface brief web-src-components-views-earnview-tsx): the
 * Account lends USDC directly to a short list Swissquote approved. Every move is signed by Face ID
 * and the Kit, approvals are exact, and withdrawals only ever return to the Account. Variable
 * rates, read on-chain, never promised.
 */
export function EarnView() {
  const { wallet } = useLoadedWallet()
  const [refreshKey, setRefreshKey] = useState(0)
  const positions = useEarnPositions(wallet.account ?? null, refreshKey)
  const [action, setAction] = useState<{ dapp: Dapp; kind: DappAction } | null>(null)

  if (!wallet.account) {
    return (
      <div className="space-y-6">
        <PageHeader title="Earn" />
        <EmptyState
          icon={<Sprout className="h-5 w-5" />}
          title="Protect your wallet first"
          description="Earn lends from your Account, and every move needs your Recovery Kit with Face ID."
          action={<ButtonLink href="/welcome/protect">Protect your wallet</ButtonLink>}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earn"
        description="Lend USDC from your Account to protocols Swissquote approved. Variable rates, and the money only ever comes back to your Account."
      />
      <PositionsPlate positions={positions} />
      <div className="grid gap-4 lg:grid-cols-2">
        {APPROVED_DAPPS.map((dapp) => (
          <ProtocolCard
            key={dapp.id}
            dapp={dapp}
            position={positions?.find((p) => p.dapp.id === dapp.id) ?? null}
            active={action?.dapp.id === dapp.id ? action.kind : null}
            onAction={(kind) => setAction({ dapp, kind })}
          />
        ))}
      </div>
      {action && (
        <ActionPanel
          key={`${action.dapp.id}:${action.kind}`}
          dapp={action.dapp}
          kind={action.kind}
          position={positions?.find((p) => p.dapp.id === action.dapp.id)?.supplied ?? 0n}
          onClose={() => setAction(null)}
          onLanded={() => setRefreshKey((k) => k + 1)}
        />
      )}
      <UnlistedDemo />
    </div>
  )
}

/** What the Account has lent, live onchain (Ink Plate Rule). */
function PositionsPlate({ positions }: { positions: Position[] | null }) {
  const { live } = useBlockNumber()
  const total = positions?.reduce((sum, p) => sum + p.supplied, 0n) ?? null
  return (
    <section className="rounded-2xl border border-hero-2 bg-hero p-5 text-hero-fg sm:p-6">
      <p className="token flex items-center gap-2 text-hero-muted">
        <span className={`h-1.5 w-1.5 ${live ? 'bg-success' : 'bg-hero-muted'}`} aria-hidden />
        Lent · live onchain
      </p>
      {total === null ? (
        <Skeleton className="mt-4 h-12 w-48 bg-hero-2" />
      ) : (
        <p className="mt-4 font-mono text-5xl font-semibold tabular-nums tracking-[-0.04em] sm:text-6xl">
          {formatUsdc(total)} <span className="font-sans text-xl font-normal tracking-normal text-hero-muted">USDC</span>
        </p>
      )}
      <dl className="mt-5">
        {(positions ?? APPROVED_DAPPS.map((dapp) => ({ dapp, supplied: null, apy: null }))).map((p) => (
          <PlateRow key={p.dapp.id} label={p.dapp.name}>
            {p.supplied === null ? (
              <span className="text-hero-muted">…</span>
            ) : (
              <>
                <span className="font-mono tabular-nums">{formatUsdc(p.supplied)}</span> USDC
                <span className="ml-3 font-mono text-hero-muted tabular-nums">{percent(p.apy)}</span>
              </>
            )}
          </PlateRow>
        ))}
      </dl>
      <p className="mt-4 text-xs text-hero-muted">Testnet rates, variable. Swissquote neither holds the positions nor promises a return.</p>
    </section>
  )
}

function ProtocolCard({
  dapp,
  position,
  active,
  onAction,
}: {
  dapp: Dapp
  position: Position | null
  active: DappAction | null
  onAction: (kind: DappAction) => void
}) {
  const lent = position?.supplied ?? 0n
  return (
    <section className={`flex flex-col rounded-2xl border p-5 sm:p-6 ${active ? 'border-foreground' : 'border-border'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{dapp.name}</h2>
        <Badge>Approved</Badge>
      </div>
      <p className="mt-3">
        {position ? (
          <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight">{percent(position.apy)}</span>
        ) : (
          <Skeleton className="inline-block h-8 w-24" />
        )}
        <span className="ml-2 text-sm text-muted">a year, variable</span>
      </p>
      <p className="mt-3 text-sm">{dapp.description}</p>
      <p className="mt-2 text-sm text-muted">{dapp.risks}</p>
      <ul className="mt-4 border-t border-border text-sm">
        <li className="flex items-baseline justify-between gap-3 border-b border-border py-2.5">
          <span className="text-muted">You lend</span>
          <span>
            <span className="font-mono font-medium tabular-nums">{position ? formatUsdc(lent) : '…'}</span> USDC
          </span>
        </li>
        <li className="flex items-baseline justify-between gap-3 border-b border-border py-2.5">
          <span className="text-muted">Contract</span>
          <a
            href={`${EXPLORER_URL}/address/${dapp.contracts[0]}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted transition-colors hover:text-foreground"
          >
            {shortAddress(dapp.contracts[0])} <ExternalLink className="h-3 w-3" />
          </a>
        </li>
      </ul>
      {/* A single action spans the card; the card's ink border marks the protocol in action. */}
      <div className={`mt-auto grid gap-2 pt-5 ${lent > 0n ? 'sm:grid-cols-2' : ''}`}>
        <Button onClick={() => onAction('deposit')} variant="secondary" size="lg" aria-pressed={active === 'deposit'}>
          Deposit
        </Button>
        {lent > 0n && (
          <Button onClick={() => onAction('withdraw')} variant="secondary" size="lg" aria-pressed={active === 'withdraw'}>
            Withdraw
          </Button>
        )}
      </div>
    </section>
  )
}

type Stage = 'amount' | 'review' | 'sending' | 'done'

function parseAmount(value: string): bigint | null {
  if (!value || !/^\d*\.?\d*$/.test(value)) return null
  try {
    return parseUnits(value, USDC_DECIMALS)
  } catch {
    return null
  }
}

/** Deposit or withdraw: amount, then a sealed 2-of-2 review with the steps, checks, risks and the Kit. */
function ActionPanel({
  dapp,
  kind,
  position,
  onClose,
  onLanded,
}: {
  dapp: Dapp
  kind: DappAction
  position: bigint
  onClose: () => void
  onLanded: () => void
}) {
  const { wallet, chain, refresh } = useLoadedWallet()
  const account = wallet.account as Address
  const deposit = kind === 'deposit'
  const available = deposit ? (chain.balance ?? null) : position
  const [stage, setStage] = useState<Stage>('amount')
  const [amount, setAmount] = useState('')
  const [whole, setWhole] = useState(false)
  const [compliance, setCompliance] = useState<ComplianceState | null>(null)
  const [understood, setUnderstood] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [kitFile, setKitFile] = useState<{ name: string; text: string } | null>(null)
  const [hasLocalKit] = useState(() => loadLocalKit() !== null)
  const [step, setStep] = useState<SendStep | 'opening' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  // What was signed, kept for the receipt: the position reads 0 once a full withdrawal lands.
  const [signed, setSigned] = useState<bigint | null>(null)
  const panel = useRef<HTMLElement>(null)
  const amountField = useRef<HTMLInputElement>(null)

  // On a phone the panel opens below both cards: bring it into view and focus the amount.
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panel.current?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
    amountField.current?.focus({ preventScroll: true })
  }, [])

  const value = whole ? position : parseAmount(amount)
  const tooMuch = value !== null && available !== null && value > available
  const amountError = amount && value === null ? 'Enter a valid amount.' : tooMuch ? (deposit ? 'More than your balance.' : 'More than you lend.') : null
  const canContinue = value !== null && value > 0n && !amountError
  const target = whole ? 'max' : value
  // The checks simulate the Account's own calls, step by step (ADR-028).
  const inner: MetaTransaction[] =
    value !== null && value > 0n && target !== null
      ? dappActionSteps({ dapp, action: kind, account, amount: target }).map((c) => ({ to: c.to, value: 0n, data: c.data }))
      : []
  const kitReady = passphrase.length > 0 && (hasLocalKit || !!kitFile)
  const canApprove = !!compliance && !compliance.blocked && !compliance.needsConfirmation && (!deposit || understood) && kitReady
  const verb = deposit ? 'Deposit to' : 'Withdraw from'

  async function approve() {
    if (target === null || value === null) return
    setError(null)
    try {
      setStep('opening')
      setSigned(value)
      const kit = (await unlockKit(passphrase, kitFile?.text)).owner
      setStage('sending')
      const calls = await dappActionCalls({ dapp, action: kind, account, keySafe: wallet.address, amount: target, kit })
      const result = await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls,
        onStep: setStep,
      })
      setTxHash(result.txHash)
      setPassphrase('')
      setStage('done')
      refresh()
      onLanded()
    } catch (e) {
      setError(e instanceof KitPassphraseError ? 'Wrong Kit passphrase. Check it and try again.' : errorMessage(e))
      setStage('review')
    } finally {
      setStep(null)
    }
  }

  const pickFile = async (file: File | undefined) => file && setKitFile({ name: file.name, text: await file.text() })
  const shown = value !== null ? formatUsdc(value) : '0.00'

  if (stage === 'done' && txHash) {
    const amountSent = formatUsdc(signed ?? 0n)
    return (
      <div className="space-y-4">
        <Plate title={deposit ? 'Deposit confirmed · onchain' : 'Withdrawal confirmed · onchain'} seal={false} className="animate-enter">
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-[-0.04em]">
            {amountSent} <span className="font-sans text-lg font-normal tracking-normal text-hero-muted">USDC</span>
          </p>
          <dl className="mt-5">
            <PlateRow label={deposit ? 'Lent to' : 'Back from'}>{dapp.name}</PlateRow>
            <PlateRow label="Approved by">
              <span className="inline-flex items-center gap-2">
                <ApprovalSquares kit tone="hero" /> Face ID + your Recovery Kit
              </span>
            </PlateRow>
            <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
          </dl>
          <a
            href={`${EXPLORER_URL}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-hero-muted transition-colors hover:text-hero-fg"
          >
            View on Basescan <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Plate>
        <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    )
  }

  return (
    <section ref={panel} className="scroll-mt-20 space-y-5 rounded-2xl border border-foreground p-5 sm:p-6" aria-label={`${verb} ${dapp.name}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {verb} {dapp.name}
        </h2>
        <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
          Cancel
        </button>
      </div>
      <Stepper steps={['Amount', 'Review', 'Done']} current={stage === 'amount' ? 0 : 1} />

      {stage === 'amount' && (
        <>
          <Field
            label="Amount"
            htmlFor="earn-amount"
            error={amountError}
            aside={
              <span className="text-xs text-muted">
                {deposit ? 'In your Account' : 'You lend'}{' '}
                <span className="font-mono tabular-nums">{available === null ? '…' : formatUsdc(available)}</span> USDC
              </span>
            }
          >
            <div className="relative">
              <Input
                ref={amountField}
                id="earn-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={whole ? formatUsdc(position).replace(/,/g, '') : amount}
                onChange={(e) => {
                  setWhole(false)
                  setAmount(cleanAmount(e.target.value, USDC_DECIMALS))
                }}
                className="h-16 border-[1.5px] border-foreground pr-32 font-mono !text-4xl font-semibold tabular-nums tracking-tight"
                autoComplete="off"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <button
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    if (!available) return
                    if (deposit) setAmount(formatUsdc(available).replace(/,/g, ''))
                    else setWhole(true)
                  }}
                  className="token h-9 rounded-lg px-2.5 text-accent-ink transition-colors hover:bg-accent-soft disabled:opacity-40"
                >
                  Max
                </button>
                <span className="token px-2 text-muted">USDC</span>
              </div>
            </div>
          </Field>
          {whole && <p className="text-sm text-muted">Your whole position, with the interest earned so far, comes back to your Account.</p>}
          <Button size="lg" className="w-full" disabled={!canContinue} onClick={() => setStage('review')}>
            Continue
          </Button>
        </>
      )}

      {(stage === 'review' || stage === 'sending') && value !== null && (
        <div className="space-y-5">
          <Plate title="Face ID and your Kit will approve" className="!mt-16">
            <p className="font-mono text-4xl font-semibold tabular-nums tracking-[-0.04em] sm:text-5xl">
              {shown} <span className="font-sans text-lg font-normal tracking-normal text-hero-muted">USDC</span>
            </p>
            <dl className="mt-5">
              {deposit ? (
                <>
                  <PlateRow label="Allow">
                    {dapp.name} to take exactly <span className="font-mono">{shown}</span> USDC, no more
                    <span className="mt-1.5 flex justify-end">
                      <AddressPill address={dapp.contracts[0]} tone="hero" />
                    </span>
                  </PlateRow>
                  <PlateRow label="Supply">
                    <span className="font-mono">{shown}</span> USDC from your Account
                  </PlateRow>
                </>
              ) : (
                <PlateRow label="Withdraw">
                  {whole ? 'Your whole position' : <span className="font-mono">{shown} USDC</span>} back to your Account
                </PlateRow>
              )}
              <PlateRow label="Approval">
                <span className="inline-flex items-center gap-2">
                  <ApprovalSquares kit tone="hero" /> Face ID + your Recovery Kit
                </span>
              </PlateRow>
              <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
            </dl>
          </Plate>

          <section className="space-y-3 border-t border-border pt-5">
            <h3 className="text-sm font-semibold">Checks before Face ID</h3>
            <ComplianceChecks
              subject="dapp"
              from={account}
              to={dapp.contracts[0]}
              amount={value}
              balance={deposit ? (chain.balance ?? null) : null}
              knownRecipients={[]}
              calls={inner}
              onChange={setCompliance}
            />
          </section>

          {deposit && (
            <section className="border-t border-border pt-5 text-sm">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-foreground" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
                <span>I understand: this is not a bank deposit, the rate is variable and can fall, and smart contracts carry risk.</span>
              </label>
            </section>
          )}

          <section className="space-y-4 border-t border-border pt-5">
            <div className="flex gap-3">
              <ApprovalSquares kit className="mt-[5px]" />
              <div>
                <h3 className="text-sm font-semibold">Your Recovery Kit approves with Face ID</h3>
                <p className="mt-0.5 text-sm text-muted">
                  A protocol move is never covered by today’s Face ID limit. Your passphrase opens the encrypted Kit
                  {hasLocalKit && !kitFile ? ' stored on this device' : ''}; it never leaves it.
                </p>
              </div>
            </div>
            {(!hasLocalKit || kitFile) && (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-sm transition-colors hover:border-accent-ink">
                <Upload className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 truncate">{kitFile ? kitFile.name : 'Choose your Kit file'}</span>
                <input type="file" accept="application/json,.json" aria-label="Recovery Kit file" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            )}
            <Field label="Kit passphrase" htmlFor="earn-kit-passphrase">
              <Input id="earn-kit-passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" />
            </Field>
          </section>

          {error && (
            <Alert tone="danger" title="Not sent">
              {error}
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <Button variant="secondary" size="lg" disabled={!!step} onClick={() => setStage('amount')}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="lg" disabled={!canApprove || !!step} onClick={approve}>
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
        </div>
      )}
    </section>
  )
}

/** Demo (shape round): an unlisted dApp is not sponsored; the paymaster's own answer is the evidence. */
function UnlistedDemo() {
  const { wallet } = useLoadedWallet()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ refused: boolean; message: string } | null>(null)
  const answer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!outcome) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    answer.current?.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' })
  }, [outcome])

  async function tryUnlisted() {
    setBusy(true)
    setOutcome(null)
    try {
      await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: unlistedDemoCalls(),
      })
      setOutcome({ refused: false, message: 'The operation was sponsored. That should not happen: report it.' })
    } catch (e) {
      // The paymaster's own answer is the evidence.
      const chain = errorChain(e)
      const reply = /Swissquote only sponsors approved dApps[^·]*/.exec(chain)?.[0]?.trim()
      setOutcome(reply || /unapproved-dapp/.test(chain) ? { refused: true, message: reply ?? errorMessage(e) } : { refused: false, message: errorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">Only approved dApps are sponsored</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Swissquote reviews each contract (audits, track record, legal) before it pays its network fees: it approves
          contracts, not brands. Anything else is not blocked: you would pay the fee yourself.
        </p>
      </div>
      <Button variant="secondary" disabled={busy} onClick={tryUnlisted}>
        {busy ? <Spinner /> : <ShieldX className="h-4 w-4" />} Demo: try an unlisted router
      </Button>
      {outcome && (
        <div ref={answer} className="scroll-mb-28">
          {outcome.refused ? (
            <div role="status" className="flex gap-3 border-t border-border pt-4">
              <ShieldX className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold">Not sponsored by Swissquote</p>
                <p className="mt-0.5 font-mono text-xs tabular-nums">
                  unapproved-dapp · {UNLISTED_DEMO.name} {shortAddress(UNLISTED_DEMO.contract)}
                </p>
                <p className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">{outcome.message}</p>
              </div>
            </div>
          ) : (
            <Alert tone="danger" title="Not sent">
              {outcome.message}
            </Alert>
          )}
        </div>
      )}
    </section>
  )
}
