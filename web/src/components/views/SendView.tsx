'use client'

import type { MetaTransaction } from 'abstractionkit'
import { ArrowLeft, ExternalLink, FingerprintPattern, KeyRound, Upload } from 'lucide-react'
import { useState } from 'react'
import { encodeFunctionData, erc20Abi, parseUnits, type Address } from 'viem'

import { AllowanceMeter } from '@/components/account/AllowanceMeter'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { ComplianceChecks, type ComplianceState } from '@/components/send/ComplianceChecks'
import { RecipientField, type Recipient } from '@/components/send/RecipientField'
import { Button, ButtonLink } from '@/components/ui/button'
import { ApprovalSquares, FactorSquare } from '@/components/ui/factor'
import { Alert, Badge, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { Plate, PlateRow } from '@/components/ui/plate'
import { ProgressList, Stepper } from '@/components/ui/stepper'
import type { KitSigner } from '@/lib/account'
import { EXPLORER_URL, USDC_ADDRESS, USDC_DECIMALS } from '@/lib/config'
import { errorMessage, formatUsdc, formatUsdcShort, shortAddress } from '@/lib/format'
import { KitPassphraseError, unlockKit } from '@/lib/recoveryKit'
import { limitSpendCalls, spend, spendRoute, type SpendRoute } from '@/lib/spend'
import { loadLocalKit, toPublicKey } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, usdcTransfer, type SendStep } from '@/lib/wallet'

type Stage = 'details' | 'review' | 'sending' | 'done'
const STAGES: Stage[] = ['details', 'review', 'sending']
const SEND_STEPS: SendStep[] = ['preparing', 'sponsoring', 'signing', 'submitting', 'confirming']

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Send (issue #12, surface brief web-src-components-views-overviewview-tsx). From the Account:
 * within today's Face ID budget the phone alone approves (Allowance Module); above it the Recovery
 * Kit co-signs (passphrase, then Face ID) and the seal marks the 2 of 2. Compliance checks run on
 * the review, before Face ID (PDR-023). Wallets without an Account keep the Key Safe send.
 */
export function SendView() {
  const { wallet, chain, transfers, refresh } = useLoadedWallet()
  const [stage, setStage] = useState<Stage>('details')
  const [raw, setRaw] = useState('')
  const [recipient, setRecipient] = useState<Recipient | null>(null)
  const [amount, setAmount] = useState('')
  const [compliance, setCompliance] = useState<ComplianceState | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [kitFile, setKitFile] = useState<{ name: string; text: string } | null>(null)
  const [hasLocalKit] = useState(() => loadLocalKit() !== null)
  const [opening, setOpening] = useState(false)
  const [step, setStep] = useState<SendStep>('preparing')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<{
    txHash: string
    amount: bigint
    to: Recipient
    route: SpendRoute | 'legacy'
    remainingBefore: bigint | null
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
    !!compliance && !compliance.blocked && !compliance.needsConfirmation && (!needsKit || (passphrase.length > 0 && (hasLocalKit || !!kitFile)))

  async function approve() {
    if (!to || !recipient || amountValue === null || !route || route === 'loading' || route === 'insufficient') return
    setError(null)
    try {
      let kit: KitSigner | undefined
      if (needsKit) {
        setOpening(true)
        kit = (await unlockKit(passphrase, kitFile?.text)).owner
        setOpening(false)
      }
      setStage('sending')
      const result = account
        ? await spend({ wallet: { ...wallet, account }, to, amount: amountValue, kit, onStep: setStep })
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
      })
      setPassphrase('')
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
    setPassphrase('')
    setKitFile(null)
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
                    onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
                    className="h-16 border-[1.5px] border-foreground pr-32 font-mono !text-4xl font-semibold tabular-nums tracking-tight"
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
              <Plate title={needsKit ? 'Face ID and your Kit will approve' : 'Face ID will approve'} seal={needsKit} className={needsKit ? '!mt-16' : ''}>
                <p className="font-mono text-4xl font-semibold tabular-nums tracking-[-0.04em] sm:text-5xl">
                  {formatUsdc(amountValue)} <span className="font-sans text-lg font-normal tracking-normal text-hero-muted">USDC</span>
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
                      <ApprovalSquares kit={needsKit} tone="hero" />
                      {needsKit ? 'Face ID + your Recovery Kit' : 'Face ID alone'}
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
                <section className="space-y-4 rounded-2xl border border-border p-5">
                  <div className="flex gap-3">
                    <FactorSquare factor="kit" className="mt-1" />
                    <div>
                      <h2 className="text-sm font-semibold">Your Recovery Kit approves too</h2>
                      <p className="mt-1 text-sm text-muted">
                        This payment is above what Face ID can spend today. Your passphrase opens the encrypted Kit
                        {hasLocalKit && !kitFile ? ' stored on this phone' : ''}; it never leaves this device.
                      </p>
                    </div>
                  </div>
                  {(!hasLocalKit || kitFile) && (
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-sm transition-colors hover:border-accent-ink">
                      <Upload className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 truncate">{kitFile ? kitFile.name : 'Choose your Kit file'}</span>
                      <input
                        type="file"
                        accept="application/json,.json"
                        aria-label="Recovery Kit file"
                        className="sr-only"
                        onChange={async (e) => {
                          const picked = e.target.files?.[0]
                          if (picked) setKitFile({ name: picked.name, text: await picked.text() })
                        }}
                      />
                    </label>
                  )}
                  <Field label="Kit passphrase" htmlFor="send-kit-passphrase">
                    <Input
                      id="send-kit-passphrase"
                      type="password"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      autoComplete="off"
                    />
                  </Field>
                  {hasLocalKit && !kitFile && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-foreground">
                      <input
                        type="file"
                        accept="application/json,.json"
                        className="sr-only"
                        onChange={async (e) => {
                          const picked = e.target.files?.[0]
                          if (picked) setKitFile({ name: picked.name, text: await picked.text() })
                        }}
                      />
                      Use my Kit file instead
                    </label>
                  )}
                </section>
              )}

              {error && (
                <Alert tone="danger" title="Not sent">
                  {error}
                </Alert>
              )}
              <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                <Button variant="secondary" size="lg" onClick={() => setStage('details')}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button size="lg" disabled={!canApprove || opening} onClick={approve}>
                  {opening ? (
                    <>
                      <Spinner /> Opening your Kit…
                    </>
                  ) : (
                    <>
                      {needsKit ? <KeyRound className="h-5 w-5" /> : <FingerprintPattern className="h-5 w-5" />}
                      {needsKit ? 'Approve with Kit and Face ID' : 'Approve with Face ID'}
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
                  Sending <span className="font-mono tabular-nums">{amountValue !== null && formatUsdc(amountValue)}</span> USDC
                </p>
                <p className="text-sm text-muted">Approve with Face ID or Touch ID when prompted.</p>
              </div>
              <ProgressList steps={SEND_STEPS.map((s) => SEND_STEP_LABEL[s])} current={SEND_STEPS.indexOf(step)} />
            </section>
          )}

          {stage === 'done' && sent && (
            <div className="space-y-5">
              <Plate title="Sent · live onchain" seal={false} className="animate-enter">
                <p className="font-mono text-4xl font-semibold tabular-nums tracking-[-0.04em] sm:text-5xl">
                  {formatUsdc(sent.amount)} <span className="font-sans text-lg font-normal tracking-normal text-hero-muted">USDC</span>
                </p>
                <dl className="mt-5">
                  <PlateRow label="To">
                    <RecipientName recipient={sent.to} />
                  </PlateRow>
                  <PlateRow label="Approved by">
                    <span className="inline-flex items-center gap-2">
                      <ApprovalSquares kit={sent.route === 'kit'} tone="hero" />
                      {sent.route === 'kit' ? 'Face ID + your Recovery Kit' : 'Face ID alone'}
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="secondary" size="lg" onClick={reset}>
                  Send another
                </Button>
                <ButtonLink href="/" size="lg">
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

/** Whole balance, formatted for the input. */
function maxAmount(balance: bigint) {
  return formatUsdcShort(balance).replace(/,/g, '')
}
