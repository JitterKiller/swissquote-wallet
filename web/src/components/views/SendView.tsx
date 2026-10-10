'use client'

import { CircleCheck, ClipboardPaste, ExternalLink, FingerprintPattern, Lock, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { isAddress, parseUnits } from 'viem'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Alert } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { ProgressList, Stepper } from '@/components/ui/stepper'
import { EXPLORER_URL, USDC_DECIMALS } from '@/lib/config'
import { errorMessage, formatUsdc, shortAddress } from '@/lib/format'
import { toPublicKey } from '@/lib/storage'
import { spend, spendRoute } from '@/lib/spend'
import { SEND_STEP_LABEL, sendCalls, usdcTransfer, type SendStep } from '@/lib/wallet'

type Stage = 'details' | 'review' | 'sending' | 'done'

const STAGES: Stage[] = ['details', 'review', 'sending']
const SEND_STEPS: SendStep[] = ['preparing', 'sponsoring', 'signing', 'submitting', 'confirming']

export function SendView() {
  const { wallet, chain, transfers, refresh } = useLoadedWallet()
  const [stage, setStage] = useState<Stage>('details')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<SendStep>('preparing')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const balance = chain.balance
  const recipientError = to && !isAddress(to) ? 'This is not a valid address.' : null
  const amountValue = parseAmount(amount)
  const amountError =
    amount && amountValue === null
      ? 'Enter a valid amount.'
      : amountValue !== null && balance !== null && amountValue > balance
        ? 'Insufficient balance.'
        : null
  const canContinue = isAddress(to) && amountValue !== null && amountValue > 0n && !amountError
  const firstTime = !!transfers && !transfers.some((t) => t.counterparty.toLowerCase() === to.toLowerCase())
  const fundsAddress = wallet.account ?? wallet.address
  const toSelf = to.toLowerCase() === fundsAddress.toLowerCase()
  // With an Account (ADR-017): Face ID alone up to today's allowance; above it the Kit is needed (#12).
  const route = wallet.account && amountValue !== null ? spendRoute(chain.account, balance, amountValue) : null

  async function send() {
    setError(null)
    setStage('sending')
    try {
      if (route === 'kit') {
        throw new Error('This is above what Face ID alone can send today. Above your daily limit, your Recovery Kit is needed too.')
      }
      const result = wallet.account
        ? await spend({ wallet: { ...wallet, account: wallet.account }, to: to as `0x${string}`, amount: amountValue!, onStep: setStep })
        : await sendCalls({
            address: wallet.address,
            credentialId: wallet.credentialId,
            publicKey: toPublicKey(wallet),
            calls: [usdcTransfer(to as `0x${string}`, amount)],
            onStep: setStep,
          })
      setTxHash(result.txHash)
      setStage('done')
      refresh()
    } catch (e) {
      setError(errorMessage(e))
      setStage('review')
    }
  }

  function reset() {
    setStage('details')
    setTo('')
    setAmount('')
    setTxHash(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Send" description="Transfer USDC to any address. No network fees." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          {stage !== 'done' && (
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <Stepper steps={['Details', 'Review', 'Confirm']} current={STAGES.indexOf(stage)} />
            </div>
          )}

          {stage === 'details' && (
            <CardBody className="space-y-5">
              <Field label="Recipient" htmlFor="to" error={recipientError} hint="A 0x address on Base Sepolia.">
                <div className="relative">
                  <Input
                    id="to"
                    placeholder="0x…"
                    value={to}
                    onChange={(e) => setTo(e.target.value.trim())}
                    className="pr-24 font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setTo((await navigator.clipboard.readText()).trim())
                      } catch {}
                    }}
                    className="absolute right-1.5 top-1.5 inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" /> Paste
                  </button>
                </div>
              </Field>

              <Field
                label="Amount"
                htmlFor="amount"
                error={amountError}
                aside={
                  <span className="text-xs text-muted">
                    Available: {balance === null ? '…' : `${formatUsdc(balance)} USDC`}
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
                    className="h-14 pr-32 text-2xl font-semibold tabular-nums"
                    autoComplete="off"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!balance}
                      onClick={() => balance !== null && setAmount(maxAmount(balance))}
                      className="h-10 rounded-lg px-2.5 text-xs font-semibold text-accent-ink hover:bg-accent-soft disabled:opacity-40"
                    >
                      MAX
                    </button>
                    <span className="rounded-lg bg-surface-2 px-2.5 py-2 text-sm font-medium">USDC</span>
                  </div>
                </div>
              </Field>

              <FeeRow />

              <Button size="lg" className="w-full" disabled={!canContinue} onClick={() => setStage('review')}>
                Continue
              </Button>
            </CardBody>
          )}

          {stage === 'review' && amountValue !== null && (
            <CardBody className="space-y-5">
              <div className="rounded-2xl bg-surface-2 p-5 text-center">
                <p className="text-sm text-muted">You send</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
                  {formatUsdc(amountValue)} <span className="text-xl text-muted">USDC</span>
                </p>
                <p className="mt-1 text-sm text-muted">to {shortAddress(to)}</p>
              </div>
              <dl className="divide-y divide-border text-sm">
                <Row label="Recipient">
                  <span className="break-all font-mono text-xs">{to}</span>
                </Row>
                <Row label="Network">Base Sepolia</Row>
                <Row label="Network fee">
                  <span className="font-medium text-success">Free</span>
                  <span className="block text-xs text-muted">Sponsored by Swissquote</span>
                </Row>
                <Row label="Total">
                  <span className="font-semibold">{formatUsdc(amountValue)} USDC</span>
                </Row>
              </dl>
              {toSelf ? (
                <Alert tone="warning" title="This is your own address">
                  The funds will come back to this wallet.
                </Alert>
              ) : (
                firstTime && (
                  <Alert tone="warning" title="First transfer to this address">
                    Double-check it. Blockchain transfers can’t be reversed.
                  </Alert>
                )
              )}
              {error && <Alert tone="danger" title="Transfer not sent">{error}</Alert>}
              <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                <Button variant="secondary" size="lg" onClick={() => setStage('details')}>
                  Back
                </Button>
                <Button size="lg" onClick={send}>
                  <FingerprintPattern className="h-5 w-5" /> Confirm with passkey
                </Button>
              </div>
            </CardBody>
          )}

          {stage === 'sending' && (
            <CardBody className="space-y-6">
              <div>
                <p className="font-semibold">Sending {amountValue !== null && formatUsdc(amountValue)} USDC</p>
                <p className="text-sm text-muted">Approve with Face ID or Touch ID when prompted.</p>
              </div>
              <ProgressList steps={SEND_STEPS.map((s) => SEND_STEP_LABEL[s])} current={SEND_STEPS.indexOf(step)} />
            </CardBody>
          )}

          {stage === 'done' && amountValue !== null && (
            <CardBody className="py-10 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
                <CircleCheck className="h-8 w-8" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight">Sent {formatUsdc(amountValue)} USDC</h2>
              <p className="mt-1 text-sm text-muted">to {shortAddress(to)} · no network fee</p>
              {txHash && (
                <a
                  href={`${EXPLORER_URL}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent-ink"
                >
                  View on explorer <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <div className="mx-auto mt-8 grid max-w-sm gap-3 sm:grid-cols-2">
                <Button variant="secondary" onClick={reset}>
                  New transfer
                </Button>
                <ButtonLink href="/">Back to overview</ButtonLink>
              </div>
            </CardBody>
          )}
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader
              icon={<Lock className="h-[18px] w-[18px]" />}
              title="Only you can approve"
              description="Transfers are signed by the passkey on this device. Swissquote can’t move your funds."
            />
            <div className="h-5" />
          </Card>
          <Card>
            <CardHeader
              icon={<Sparkles className="h-[18px] w-[18px]" />}
              title="No network fees"
              description="Swissquote covers the gas. You never need to hold ETH."
            />
            <div className="h-5" />
          </Card>
        </aside>
      </div>
    </div>
  )
}

function FeeRow() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-2 px-4 py-3 text-sm">
      <span className="text-muted">Network fee</span>
      <span className="text-right">
        <span className="block font-semibold text-success">Free</span>
        <span className="block text-xs text-muted">Sponsored by Swissquote</span>
      </span>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

function parseAmount(amount: string): bigint | null {
  if (!amount) return null
  if (!/^\d*\.?\d*$/.test(amount)) return null
  try {
    return parseUnits(amount, USDC_DECIMALS)
  } catch {
    return null
  }
}

function maxAmount(balance: bigint) {
  const whole = balance / 10n ** BigInt(USDC_DECIMALS)
  const fraction = (balance % 10n ** BigInt(USDC_DECIMALS)).toString().padStart(USDC_DECIMALS, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : `${whole}`
}
