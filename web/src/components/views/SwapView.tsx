'use client'

import { ArrowDownUp, ArrowLeft, ChevronDown, ExternalLink, KeyRound, Repeat, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatUnits, parseUnits, type Address } from 'viem'

import { useAssetBalances } from '@/components/account/AssetBalances'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { ComplianceChecks, type ComplianceState } from '@/components/send/ComplianceChecks'
import { AddressPill } from '@/components/ui/address'
import { Button, ButtonLink } from '@/components/ui/button'
import { ApprovalSquares } from '@/components/ui/factor'
import { Alert, EmptyState, Spinner } from '@/components/ui/feedback'
import { amountFit, Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { Plate, PlateRow } from '@/components/ui/plate'
import { ASSETS, ASSET_IDS, formatAsset, formatAssetExact, toInput, type Asset, type AssetId } from '@/lib/assets'
import { HIGH_VALUE_USDC } from '@/lib/compliance'
import { EXPLORER_URL } from '@/lib/config'
import { UNISWAP_V3_ROUTER } from '@/lib/dapps'
import { errorMessage } from '@/lib/format'
import { cleanAmount, INPUT_DECIMALS } from '@/lib/inputs'
import { KitPassphraseError, unlockKit } from '@/lib/recoveryKit'
import { loadLocalKit, toPublicKey } from '@/lib/storage'
import { quoteSwap, receivedBy, swapCalls, swapSteps, SLIPPAGE_BPS, type Quote } from '@/lib/swap'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

type Stage = 'details' | 'review' | 'done'

function parseAmount(value: string, asset: Asset): bigint | null {
  if (!value || !/^\d*\.?\d*$/.test(value)) return null
  try {
    return parseUnits(value, asset.decimals)
  } catch {
    return null
  }
}

/** "1 USDC = 0.9979 EURC": four significant decimals, enough to see the pool's spread. */
function rateLine(quote: Quote, tokenIn: Asset, tokenOut: Asset) {
  const rate = Number(formatUnits(quote.amountOut, tokenOut.decimals)) / Number(formatUnits(quote.amountIn, tokenIn.decimals))
  const shown = rate >= 1 ? rate.toLocaleString('en-US', { maximumFractionDigits: 4 }) : rate.toPrecision(4)
  return `1 ${tokenIn.symbol} = ${shown} ${tokenOut.symbol}`
}

/**
 * Swap (PDR-028, ADR-032, surface brief web-src-components-views-swapview-tsx): USDC ↔ EURC and
 * USDC ↔ ETH at Uniswap v3, from the Account. The owner gives an exact amount and gets at least the
 * minimum shown (0.5% slippage) or nothing happens; Face ID and the Kit sign every swap.
 */
export function SwapView() {
  const { wallet } = useLoadedWallet()
  const [refreshKey, setRefreshKey] = useState(0)
  const balances = useAssetBalances(wallet.account ?? null, refreshKey)
  const [from, setFrom] = useState<AssetId>('USDC')
  const [to, setTo] = useState<AssetId>('EURC')
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<{ key: string; value: Quote | null | 'error' } | null>(null)
  const [stage, setStage] = useState<Stage>('details')
  const [receipt, setReceipt] = useState<(SwapReceipt & { from: AssetId; to: AssetId }) | null>(null)

  const tokenIn = ASSETS[from]
  const tokenOut = ASSETS[to]
  const amountIn = parseAmount(amount, tokenIn)
  const balance = balances?.[from] ?? null
  const key = `${from}:${to}:${amountIn ?? ''}`
  const current = quote?.key === key && quote.value !== 'error' ? quote.value : undefined
  const quoteFailed = quote?.key === key && quote.value === 'error'
  const tooMuch = amountIn !== null && balance !== null && amountIn > balance
  const amountError = amount && amountIn === null ? 'Enter a valid amount.' : tooMuch ? 'More than your balance.' : null
  // Max is the whole balance to the last unit the app deals in; dust below it stays (ETH only).
  const max = balance !== null ? toInput(balance, tokenIn) : null

  // A live quote while typing (debounced), refreshed every 15 s: the review freezes the one shown.
  useEffect(() => {
    if (stage !== 'details' || amountIn === null || amountIn === 0n) return
    let cancelled = false
    const load = () =>
      quoteSwap(tokenIn, tokenOut, amountIn)
        .then((value) => !cancelled && setQuote({ key, value }))
        // The node did not answer: keep a quote already shown for this amount, else say so (not "no pool").
        .catch(() => !cancelled && setQuote((q) => (q?.key === key && q.value && q.value !== 'error' ? q : { key, value: 'error' })))
    const first = setTimeout(load, 350)
    const every = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearTimeout(first)
      clearInterval(every)
    }
  }, [key, stage, amountIn, tokenIn, tokenOut])

  if (!wallet.account) {
    return (
      <div className="space-y-6">
        <PageHeader title="Swap" />
        <EmptyState
          icon={<Repeat className="h-5 w-5" />}
          title="Protect your wallet first"
          description="Swaps run from your Account, and every swap needs your Recovery Kit with Face ID."
          action={<ButtonLink href="/welcome/protect">Protect your wallet</ButtonLink>}
        />
      </div>
    )
  }
  const account = wallet.account

  function pick(side: 'from' | 'to', id: AssetId) {
    // USDC is always one side: EURC and ETH swap against USDC only.
    if (side === 'from') {
      setFrom(id)
      if (id === to) setTo(from)
      else if (id !== 'USDC' && to !== 'USDC') setTo('USDC')
    } else {
      setTo(id)
      if (id === from) setFrom(to)
      else if (id !== 'USDC' && from !== 'USDC') setFrom('USDC')
    }
    setAmount('')
  }

  function flip() {
    setFrom(to)
    setTo(from)
    setAmount(current ? toInput(current.amountOut, tokenOut) : '')
  }

  const canReview = amountIn !== null && amountIn > 0n && !amountError && !!current
  const outText = current ? formatAsset(current.amountOut, tokenOut) : amountIn && (quote?.key !== key || quoteFailed) ? '…' : '0.00'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Swap"
        description="Change between dollars (USDC), euros (EURC) and ETH at Uniswap, from your Account. You get at least the minimum shown, or nothing happens."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-6">
          {stage === 'details' && (
            <section className="rounded-2xl border border-border p-5 sm:p-6">
              <Field
                label="You give"
                htmlFor="swap-amount"
                error={amountError}
                aside={
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <span>
                      Balance <span className="font-mono tabular-nums">{balance === null ? '…' : formatAsset(balance, tokenIn)}</span> {tokenIn.symbol}
                    </span>
                    <button
                      type="button"
                      disabled={!max || max === '0'}
                      onClick={() => max && setAmount(max)}
                      aria-label={`Max: your whole ${tokenIn.symbol} balance`}
                      className="token relative rounded-md px-1.5 py-1 text-accent-ink transition-colors after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:bg-accent-soft disabled:opacity-40"
                    >
                      Max
                    </button>
                  </span>
                }
              >
                <div className="relative">
                  <Input
                    id="swap-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(cleanAmount(e.target.value, INPUT_DECIMALS))}
                    className={`h-16 border-[1.5px] border-foreground pr-24 font-mono !text-4xl font-semibold tabular-nums tracking-tight ${amountFit(amount, 9)}`}
                    autoComplete="off"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <AssetPicker label="Asset you give" value={from} onChange={(id) => pick('from', id)} />
                  </div>
                </div>
              </Field>

              <div className="my-3 flex justify-center">
                <button
                  type="button"
                  onClick={flip}
                  aria-label="Swap the two assets"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-surface-2 max-sm:h-11 max-sm:w-11"
                >
                  <ArrowDownUp className="h-4 w-4" />
                </button>
              </div>

              <p id="swap-out-label" className="text-sm font-medium">
                You get about
              </p>
              <div
                role="group"
                aria-labelledby="swap-out-label"
                className="mt-1.5 flex h-16 items-center justify-between gap-3 rounded-xl bg-surface-2 pl-3.5 pr-2"
              >
                <span
                  aria-live="polite"
                  className={`min-w-0 truncate font-mono text-4xl font-semibold tabular-nums tracking-tight ${amountFit(outText, 9)} ${current ? '' : 'text-muted'}`}
                >
                  {outText}
                </span>
                <AssetPicker label="Asset you get" value={to} onChange={(id) => pick('to', id)} />
              </div>

              {amountIn !== null && amountIn > 0n && quote?.key === key && quote.value === null && (
                <p className="mt-3 text-sm text-danger">No Uniswap pool can fill this amount right now.</p>
              )}
              {amountIn !== null && amountIn > 0n && quoteFailed && (
                <p className="mt-3 text-sm text-muted">Couldn’t get a quote from the network. Retrying…</p>
              )}

              {current && (
                <ul className="mt-5 border-t border-border text-sm">
                  <SwapRow label="Rate">
                    <span className="font-mono tabular-nums">{rateLine(current, tokenIn, tokenOut)}</span>
                  </SwapRow>
                  <SwapRow label="At least">
                    <span className="font-mono tabular-nums">{formatAsset(current.minOut, tokenOut)}</span> {tokenOut.symbol}
                    <span className="text-muted"> · {Number(SLIPPAGE_BPS) / 100}% slippage</span>
                  </SwapRow>
                  <SwapRow label="Pool">
                    Uniswap v3 <span className="text-muted">· {current.fee / 10_000}% fee</span>
                  </SwapRow>
                </ul>
              )}
              {(from === 'ETH' || to === 'ETH') && current && (
                <p className="mt-3 text-xs text-muted">
                  Testnet pool price. ETH on Base Sepolia trades far from real markets; the rate you see is what the pool pays.
                </p>
              )}

              <Button size="lg" className="mt-5 w-full" disabled={!canReview} onClick={() => setStage('review')}>
                Review swap
              </Button>
            </section>
          )}

          {stage === 'review' && current && amountIn !== null && (
            <SwapReview
              account={account}
              tokenIn={tokenIn}
              tokenOut={tokenOut}
              quote={current}
              balance={balance}
              onBack={() => setStage('details')}
              onDone={(r) => {
                setReceipt({ ...r, from, to })
                setStage('done')
                setRefreshKey((k) => k + 1)
              }}
            />
          )}

          {stage === 'done' && receipt && (
            <div className="space-y-4">
              <Plate title="Swap confirmed · onchain" className="animate-enter">
                <dl>
                  <PlateRow label="You gave">
                    <span className="font-mono">{formatAssetExact(receipt.gave, ASSETS[receipt.from])}</span> {ASSETS[receipt.from].symbol}
                  </PlateRow>
                  {receipt.got !== null ? (
                    <PlateRow label="You got">
                      <span className="font-mono">{formatAssetExact(receipt.got, ASSETS[receipt.to])}</span> {ASSETS[receipt.to].symbol}
                    </PlateRow>
                  ) : (
                    <PlateRow label="You got at least">
                      <span className="font-mono">{formatAsset(receipt.minOut, ASSETS[receipt.to])}</span> {ASSETS[receipt.to].symbol}
                    </PlateRow>
                  )}
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
                </a>
              </Plate>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => {
                  setStage('details')
                  setAmount('')
                  setReceipt(null)
                }}
              >
                Swap again
              </Button>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-border p-5 text-sm">
          <h2 className="font-semibold">Your Account holds</h2>
          <ul className="mt-2 border-t border-border">
            {ASSET_IDS.map((id) => (
              <li key={id} className="flex items-baseline justify-between gap-3 border-b border-border py-2.5">
                <span>
                  {ASSETS[id].name} <span className="text-muted">· {ASSETS[id].symbol}</span>
                </span>
                <span className="font-mono tabular-nums">{balances ? formatAsset(balances[id], ASSETS[id]) : '…'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Swaps go through Uniswap v3, a contract Swissquote approved. Each needs Face ID and your Kit.</p>
        </aside>
      </div>
    </div>
  )
}

function SwapRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-border py-2.5">
      <span className="text-muted">{label}</span>
      <span className="text-right">{children}</span>
    </li>
  )
}

/** The asset choice as a compact token chip (a native select, so it stays accessible on phones). */
function AssetPicker({ label, value, onChange }: { label: string; value: AssetId; onChange: (id: AssetId) => void }) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as AssetId)}
        className="token h-9 cursor-pointer appearance-none rounded-lg border border-border bg-surface py-0 pl-2.5 pr-7 text-foreground transition-colors hover:bg-surface-2 max-sm:h-11"
      >
        {ASSET_IDS.map((id) => (
          <option key={id} value={id}>
            {ASSETS[id].symbol}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
    </span>
  )
}

type SwapReceipt = { txHash: string; gave: bigint; got: bigint | null; minOut: bigint }

/** The 2-of-2 review: the exact steps, the checks, the Kit, then biometrics. */
function SwapReview({
  account,
  tokenIn,
  tokenOut,
  quote,
  balance,
  onBack,
  onDone,
}: {
  account: Address
  tokenIn: Asset
  tokenOut: Asset
  quote: Quote
  balance: bigint | null
  onBack: () => void
  onDone: (receipt: SwapReceipt) => void
}) {
  const { wallet, refresh } = useLoadedWallet()
  const [compliance, setCompliance] = useState<ComplianceState | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [kitFile, setKitFile] = useState<{ name: string; text: string } | null>(null)
  const [hasLocalKit] = useState(() => loadLocalKit() !== null)
  const [step, setStep] = useState<SendStep | 'opening' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panel.current?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
  }, [])

  const steps = swapSteps({ account, tokenIn, tokenOut, quote }).map((c) => ({ to: c.to, value: 0n, data: c.data }))
  const gives = formatAssetExact(quote.amountIn, tokenIn)
  const canApprove = !!compliance && !compliance.blocked && !compliance.needsConfirmation && passphrase.length > 0 && (hasLocalKit || !!kitFile)

  async function approve() {
    setError(null)
    try {
      setStep('opening')
      const kit = (await unlockKit(passphrase, kitFile?.text)).owner
      const calls = await swapCalls({ account, keySafe: wallet.address, tokenIn, tokenOut, quote, kit })
      const result = await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls,
        onStep: setStep,
      })
      const got = await receivedBy(account, tokenOut, result.txHash as `0x${string}`)
      setPassphrase('')
      refresh()
      onDone({ txHash: result.txHash, gave: quote.amountIn, got, minOut: quote.minOut })
    } catch (e) {
      setError(e instanceof KitPassphraseError ? 'Wrong Kit passphrase. Check it and try again.' : errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  const pickFile = async (file: File | undefined) => file && setKitFile({ name: file.name, text: await file.text() })

  return (
    <section ref={panel} className="scroll-mt-20 space-y-5" aria-label="Review swap">
      <Plate
        title={
          <span className="inline-flex items-center gap-2">
            <ApprovalSquares kit tone="hero" />
            Face ID and your Kit will approve
          </span>
        }
      >
        <p className="font-mono text-4xl font-semibold tabular-nums tracking-[-0.04em] sm:text-5xl">
          {gives} <span className="font-sans text-lg font-normal tracking-normal text-hero-muted">{tokenIn.symbol}</span>
        </p>
        <dl className="mt-5">
          <PlateRow label="At least">
            <span className="font-mono">{formatAsset(quote.minOut, tokenOut)}</span> {tokenOut.symbol}
            <span className="block text-xs font-normal text-hero-muted">
              Expected <span className="font-mono">{formatAsset(quote.amountOut, tokenOut)}</span> · if less, nothing happens
            </span>
          </PlateRow>
          <PlateRow label="Allow">
            Uniswap v3 to take exactly <span className="font-mono">{gives}</span> {tokenIn.symbol}, no more
            <span className="mt-1.5 flex justify-end">
              <AddressPill address={UNISWAP_V3_ROUTER} tone="hero" />
            </span>
          </PlateRow>
          <PlateRow label="Swap">
            In the {quote.fee / 10_000}% pool, back to your Account
          </PlateRow>
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
          to={UNISWAP_V3_ROUTER}
          amount={quote.amountIn}
          balance={balance}
          decimals={tokenIn.decimals}
          // 5,000 dollars or euros; ETH has the balance rule only.
          largeAt={tokenIn.id === 'ETH' ? null : HIGH_VALUE_USDC}
          knownRecipients={[]}
          calls={steps}
          onChange={setCompliance}
        />
      </section>

      <section className="space-y-4 border-t border-border pt-5">
        <div className="flex gap-3">
          <ApprovalSquares kit className="mt-[5px]" />
          <div>
            <h3 className="text-sm font-semibold">Your Recovery Kit approves with Face ID</h3>
            <p className="mt-0.5 text-sm text-muted">
              A swap is never covered by today’s Face ID limit. Your passphrase opens the encrypted Kit
              {hasLocalKit && !kitFile ? ' stored on this device' : ''}; it never leaves it.
            </p>
          </div>
        </div>
        {(!hasLocalKit || kitFile) && (
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-sm transition-colors hover:border-accent-ink focus-within:border-accent-ink focus-within:ring-4 focus-within:ring-accent-soft">
            <Upload className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 truncate">{kitFile ? kitFile.name : 'Choose your Kit file'}</span>
            <input type="file" accept="application/json,.json" aria-label="Recovery Kit file" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
          </label>
        )}
        <Field label="Kit passphrase" htmlFor="swap-kit-passphrase">
          <Input id="swap-kit-passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" />
        </Field>
      </section>

      {error && (
        <Alert tone="danger" title="Not swapped">
          {error}
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <Button variant="secondary" size="lg" disabled={!!step} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button size="lg" disabled={!canApprove || !!step} onClick={approve}>
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
