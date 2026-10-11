'use client'

import type { MetaTransaction } from 'abstractionkit'
import { ArrowLeft, ExternalLink, FingerprintPattern } from 'lucide-react'
import { useState } from 'react'
import { encodeFunctionData, erc20Abi, parseUnits, type Address } from 'viem'

import { AllowanceMeter } from '@/components/account/AllowanceMeter'
import { KeyWaiting, SECOND_FACTOR, SecondFactorIcon, SecondFactorSection, openingLabel, useSecondFactor, type SecondFactorChoice } from '@/components/account/SecondFactor'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { ComplianceChecks, type ComplianceState } from '@/components/send/ComplianceChecks'
import { RecipientField, type Recipient } from '@/components/send/RecipientField'
import { Button, ButtonLink } from '@/components/ui/button'
import { ApprovalSquares, FactorSquare } from '@/components/ui/factor'
import { Alert, Badge, Spinner } from '@/components/ui/feedback'
import { amountFit, Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { Plate, PlateRow } from '@/components/ui/plate'
import { ProgressList, Stepper } from '@/components/ui/stepper'
import { QuotaHint } from '@/components/swissquote/QuotaHint'
import { OffersHint } from '@/components/views/OffersView'
import type { SecondFactor } from '@/lib/account'
import { EXPLORER_URL, USDC_ADDRESS, USDC_DECIMALS } from '@/lib/config'
import { errorMessage, formatDecimal, formatUsdc, formatUsdcExact, shortAddress } from '@/lib/format'
import { cleanAmount, cleanRecipient, queryParam } from '@/lib/inputs'
import { KitPassphraseError } from '@/lib/recoveryKit'
import { limitSpendCalls, spend, spendRoute, type SpendRoute } from '@/lib/spend'
import { toPublicKey } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, usdcTransfer, type SendStep } from '@/lib/wallet'

type Stage = 'details' | 'review' | 'sending' | 'done'
const STAGES: Stage[] = ['details', 'review', 'sending']
const SEND_STEPS: SendStep[] = ['preparing', 'sponsoring', 'signing', 'submitting', 'confirming']

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Send (issue #12, surface brief web-src-components-views-overviewview-tsx). From the Account:
 * within today's Face ID budget the phone alone approves (Allowance Module); above it the Recovery
 * Kit co-signs (passphrase, then Face ID) and the plate's factor squares show the 2 of 2. Compliance checks run on
 * the review, before Face ID (PDR-023). Wallets without an Account keep the Key Safe send.
 */
export function SendView() {
  const { wallet, chain, transfers, refresh } = useLoadedWallet()
  const [stage, setStage] = useState<Stage>('details')
  // A payment link (/send?to=@handle&amount=20, PDR-010) fills the form, through the same filters as typing.
  const [raw, setRaw] = useState(() => cleanRecipient(queryParam('to')))
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [amount, setAmount] = useState(() => cleanAmount(queryParam('amount'), USDC_DECIMALS))
  const [compliance, setCompliance] = useState<ComplianceState | null>(null)
  const factor = useSecondFactor(chain.account, wallet.address, wallet.account)
  const [opening, setOpening] = useState(false)
  const [step, setStep] = useState<SendStep>('preparing')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{
    txHash: string
    amount: bigint
    to: Recipient
    route: SpendRoute | 'legacy'
    remainingBefore: bigint | null
    /** Above the limit: which factor approved with Face ID. */
    by: SecondFactorChoice
  } | null>(null)

  const account = wallet.account
  const fundsAddress = account ?? wallet.address
  const balance = chain.balance
  const allowance = chain.account?.allowance ?? null
  const amountValue = parseAmount(amount)
  // Never guess the route: until the balance and today's limit are read, it is unknown.
  const stateReady = balance !== null && (!account || chain.account !== null)
  const route: SpendRoute | 'legacy' | 'loading' | null =
    amountValue === null || amountValue === 0n
      ? null
      : !stateReady
        ? 'loading'
        : account
          ? spendRoute(chain.account, balance, amountValue)
          : amountValue > balance!
            ? 'insufficient'
            : 'legacy'
  const amountError = amount && amountValue === null ? 'Enter a valid amount.' : route === 'insufficient' ? 'More than your balance.' : null
  const to = recipient?.address ?? null
  const canContinue = !!to && amountValue !== null && amountValue > 0n && !amountError && stateReady
  const knownRecipients = transfers?.map((t) => t.counterparty) ?? []
  const firstTime = !!to && !!transfers && !transfers.some((t) => same(t.counterparty, to))
  const toSelf = !!to && (same(to, fundsAddress) || same(to, wallet.address))
  const needsKit = route === 'kit'
  const words = SECOND_FACTOR[factor.choice]

  // What the simulation runs, from the address that will actually move the funds.
  const simulation: { from: Address; calls: MetaTransaction[] } | null =
    !to || amountValue === null
      ? null
      : route === 'limit' && account
        ? { from: wallet.address, calls: limitSpendCalls({ account, keySafe: wallet.address, to, amount: amountValue }) }
        : route === 'kit' && account
          ? {
              from: account,
              calls: [{ to: USDC_ADDRESS, value: 0n, data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amountValue] }) }],
            }
          : { from: wallet.address, calls: [usdcTransfer(to, amount)] }

  const canApprove =
    !!compliance && !compliance.blocked && !compliance.needsConfirmation && (!needsKit || factor.ready)

  async function approve() {
    if (!to || !recipient || amountValue === null || !route || route === 'loading' || route === 'insufficient') return
    setError(null)
    try {
      let second: SecondFactor | undefined
      const by = factor.choice
      if (needsKit) {
        setOpening(true)
        second = await factor.resolve({
          title: `Pay ${formatUsdcExact(amountValue)} USDC`,
          lines: [
            recipient.verified
              ? { label: 'To', value: `${recipient.maskedName} · @${recipient.handle}`, note: 'Verified payee' }
              : { label: 'To', figure: shortAddress(to), note: 'An address' },
            { label: 'From', value: 'Your Account', note: 'Above what Face ID can spend today' },
          ],
        })
        setOpening(false)
      }
      setStage('sending')
      const result = account
        ? await spend({ wallet: { ...wallet, account }, to, amount: amountValue, ...second, onStep: setStep })
        : await sendCalls({
            address: wallet.address,
            credentialId: wallet.credentialId,
            publicKey: toPublicKey(wallet),
            calls: [usdcTransfer(to, amount)],
            onStep: setStep,
          })
      setSent({
        txHash: result.txHash,
        amount: amountValue,
        to: recipient,
        route: route as SpendRoute | 'legacy',
        remainingBefore: allowance?.remaining ?? null,
        by,
      })
      factor.clear()
      setStage('done')
      refresh()
    } catch (e) {
      setOpening(false)
      setError(e instanceof KitPassphraseError ? 'Wrong Kit passphrase. Check it and try again.' : errorMessage(e))
      setStage('review')
    }
  }

  function reset() {
    setStage('details')
    setRaw('')
    setRecipient(null)
    setAmount('')
    setCompliance(null)
    factor.clear()
    factor.setKitFile(null)
    setSent(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Send" description="USDC from your Account. No network fee." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-6">
          {stage !== 'done' && <Stepper steps={['Details', 'Review', 'Send']} current={STAGES.indexOf(stage)} />}

          {stage === 'details' && (
            <section className="space-y-5 rounded-2xl border border-border p-5 sm:p-6">
              <RecipientField value={raw} onChange={setRaw} onRecipient={setRecipient} />
              <Field
                label="Amount"
                htmlFor="amount"
                error={amountError}
                aside={
                  <span className="text-xs text-muted">
                    Available <span className="font-mono tabular-nums">{balance === null ? '…' : formatUsdc(balance)}</span> USDC
                  </span>
                }
              >
                <div className="relative">
                  <Input
                    id="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(cleanAmount(e.target.value, USDC_DECIMALS))}
                    className={`h-16 border-[1.5px] border-foreground pr-32 font-mono !text-4xl font-semibold tabular-nums tracking-tight ${amountFit(amount, 7)}`}
                    autoComplete="off"
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    <button
                      type="button"
                      disabled={!balance}
                      onClick={() => balance !== null && setAmount(maxAmount(balance))}
                      className="token h-9 rounded-lg px-2.5 text-accent-ink transition-colors hover:bg-accent-soft disabled:opacity-40"
                    >
                      Max
                    </button>
                    <span className="token px-2 text-muted">USDC</span>
                  </div>
                </div>
              </Field>
              {route && route !== 'insufficient' && amountValue !== null && (
                <RouteNote route={route} amount={amountValue} remaining={allowance?.remaining ?? 0n} />
              )}
              <Button size="lg" className="w-full" disabled={!canContinue} onClick={() => setStage('review')}>
                Continue
              </Button>
            </section>
          )}

          {stage === 'review' && recipient && amountValue !== null && route && (
            <div className="space-y-5">
              <Plate
                title={
                  <span className="inline-flex items-center gap-2">
                    <ApprovalSquares kit={needsKit} second={factor.choice} tone="hero" />
                    {needsKit ? words.plate : 'Face ID will approve'}
                  </span>
                }
              >
                <p className="font-mono text-4xl font-semibold tabular-nums tracking-[-0.04em] sm:text-5xl">
                  {formatUsdcExact(amountValue)} <span className="font-sans text-lg font-normal tracking-normal text-hero-muted">USDC</span>
                </p>
                <dl className="mt-5">
                  <PlateRow label="To">
                    <RecipientName recipient={recipient} />
                  </PlateRow>
                  <PlateRow label="From">
                    {account ? 'Your Account' : 'This phone'} <span className="font-mono text-hero-muted">{shortAddress(fundsAddress)}</span>
                  </PlateRow>
                  <PlateRow label="Approval">
                    <span className="inline-flex items-center gap-2">
                      <ApprovalSquares kit={needsKit} second={factor.choice} tone="hero" />
                      {needsKit ? words.approval : 'Face ID alone'}
                    </span>
                    <span className="block text-xs font-normal text-hero-muted">
                      {needsKit ? 'Above what Face ID can spend today' : account ? 'Within today’s limit' : 'This phone holds the funds'}
                    </span>
                  </PlateRow>
                  <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
                </dl>
              </Plate>

              {toSelf ? (
                <Alert tone="warning" title="This is your own address">
                  The funds will come back to this wallet.
                </Alert>
              ) : (
                firstTime &&
                !recipient.verified && (
                  <Alert tone="warning" title="First payment to this address">
                    Check it twice. Blockchain transfers cannot be reversed.
                  </Alert>
                )
              )}

              <section className="space-y-3 rounded-2xl border border-border p-5">
                <h2 className="text-sm font-semibold">Checks before Face ID</h2>
                {simulation && (
                  <ComplianceChecks
                    from={simulation.from}
                    to={to}
                    amount={amountValue}
                    balance={balance}
                    knownRecipients={knownRecipients}
                    calls={simulation.calls}
                    onChange={setCompliance}
                  />
                )}
              </section>

              {needsKit && (
                <SecondFactorSection
                  factor={factor}
                  idPrefix="send"
                  kitTitle="Your Recovery Kit approves too"
                  reason="This payment is above what Face ID can spend today."
                  className="space-y-4 rounded-2xl border border-border p-5"
                  disabled={opening}
                />
              )}

              {error && (
                <Alert tone="danger" title="Not sent">
                  {error}
                  <QuotaHint error={error} />
                </Alert>
              )}
              <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                <Button variant="secondary" size="lg" onClick={() => setStage('details')}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button size="lg" disabled={!canApprove || opening} onClick={approve}>
                  {opening ? (
                    <>
                      <Spinner /> {openingLabel(factor.choice, factor.waiting)}
                    </>
                  ) : (
                    <>
                      {needsKit ? <SecondFactorIcon choice={factor.choice} /> : <FingerprintPattern className="h-5 w-5" />}
                      {needsKit ? words.button : 'Approve with biometrics'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {stage === 'sending' && (
            <section className="space-y-6 rounded-2xl border border-border p-5 sm:p-6">
              <div>
                <p className="font-semibold">
                  Sending <span className="font-mono tabular-nums">{amountValue !== null && formatUsdcExact(amountValue)}</span> USDC
                </p>
                <p className="text-sm text-muted">Approve with Face ID or Touch ID when prompted.</p>
              </div>
              <KeyWaiting waiting={factor.waiting} demo={factor.key?.kind === 'demo'} />
              <ProgressList steps={SEND_STEPS.map((s) => SEND_STEP_LABEL[s])} current={SEND_STEPS.indexOf(step)} />
            </section>
          )}

          {stage === 'done' && sent && (
            <div className="space-y-5">
              <Plate title="Sent · live onchain" className="animate-enter">
                <p className="font-mono text-4xl font-semibold tabular-nums tracking-[-0.04em] sm:text-5xl">
                  {formatUsdcExact(sent.amount)} <span className="font-sans text-lg font-normal tracking-normal text-hero-muted">USDC</span>
                </p>
                <dl className="mt-5">
                  <PlateRow label="To">
                    <RecipientName recipient={sent.to} />
                  </PlateRow>
                  <PlateRow label="Approved by">
                    <span className="inline-flex items-center gap-2">
                      <ApprovalSquares kit={sent.route === 'kit'} second={sent.by} tone="hero" />
                      {sent.route === 'kit' ? SECOND_FACTOR[sent.by].approval : 'Face ID alone'}
                    </span>
                  </PlateRow>
                  <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
                </dl>
                <a
                  href={`${EXPLORER_URL}/tx/${sent.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm text-hero-muted transition-colors hover:text-hero-fg"
                >
                  View on Basescan <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Plate>
              {/* Under the plate, never on it (the Ink Plate Rule): the one Client → Premium trigger (PDR-019, #22). */}
              {sent.route === 'kit' && sent.by === 'kit' && <OffersHint />}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="secondary" size="lg" onClick={reset}>
                  Send another
                </Button>
                <ButtonLink href="/wallet" size="lg">
                  Back to overview
                </ButtonLink>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {allowance && (
            <section className="rounded-2xl border border-border p-5">
              <AllowanceMeter
                allowance={allowance}
                tone="light"
                size="sm"
                spend={
                  stage !== 'done'
                    ? amountValue && (route === 'limit' || route === 'kit')
                      ? { amount: amountValue, route }
                      : null
                    : // Sent within the limit: hold the preview until the chain shows the new balance, then the cells drain.
                      sent?.route === 'limit' && sent.remainingBefore === allowance.remaining
                      ? { amount: sent.amount, route: 'limit' }
                      : null
                }
              />
            </section>
          )}
          <section className="rounded-2xl border border-border p-5 text-sm">
            <h2 className="font-semibold">Who approves</h2>
            <ul className="mt-2 border-t border-border">
              <li className="grid grid-cols-[10px_1fr] items-baseline gap-x-3 border-b border-border py-2.5">
                <FactorSquare factor="phone" />
                <span>
                  <span className="font-medium">This phone</span>
                  <span className="block text-muted">Face ID alone, within today’s limit</span>
                </span>
              </li>
              <li className="grid grid-cols-[10px_1fr] items-baseline gap-x-3 border-b border-border py-2.5">
                <FactorSquare factor="kit" />
                <span>
                  <span className="font-medium">Recovery Kit</span>
                  <span className="block text-muted">With Face ID, for anything above it</span>
                </span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted">Swissquote can never approve a payment.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

/** Live as the amount changes: which factors this payment needs, and why. Read from across a room. */
function RouteNote({ route, amount, remaining }: { route: SpendRoute | 'legacy' | 'loading'; amount: bigint; remaining: bigint }) {
  if (route === 'loading') {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-muted" aria-live="polite">
        <Spinner className="h-3.5 w-3.5" /> Checking today’s limit…
      </p>
    )
  }
  const kit = route === 'kit'
  const figure = (value: bigint) => <span className="font-mono tabular-nums">{formatUsdc(value)}</span>
  return (
    <p className="flex gap-2.5 text-sm font-medium" aria-live="polite">
      <ApprovalSquares kit={kit} className="mt-[5px]" />
      <span>
        <span className="font-semibold">{kit ? 'Needs your Kit:' : 'Face ID alone:'}</span>{' '}
        {route === 'legacy' ? (
          'this phone holds the funds.'
        ) : kit && remaining === 0n ? (
          'Face ID has spent today’s limit.'
        ) : (
          <>
            {figure(amount)} is {kit ? 'above' : 'within'} the {figure(remaining)} Face ID can still spend today.
          </>
        )}
      </span>
    </p>
  )
}

function RecipientName({ recipient }: { recipient: Recipient }) {
  if (recipient.verified) {
    return (
      <>
        {recipient.maskedName} <Badge tone="success">Verified</Badge>
        <span className="block text-xs font-normal text-hero-muted">@{recipient.handle}</span>
      </>
    )
  }
  return <span className="break-all font-mono text-xs">{recipient.address}</span>
}

function parseAmount(amount: string): bigint | null {
  if (!amount || !/^\d*\.?\d*$/.test(amount)) return null
  try {
    return parseUnits(amount, USDC_DECIMALS)
  } catch {
    return null
  }
}

/** Whole balance for the input, to the last unit: rounding "0.999512" to "1" would be more than the balance. */
function maxAmount(balance: bigint) {
  return formatDecimal(balance, USDC_DECIMALS, { round: 'down', group: false, min: 0 })
}
