'use client'

import { ArrowDownLeft, ArrowUpRight, Landmark } from 'lucide-react'
import { useEffect, useState } from 'react'
import { parseUnits, type Address } from 'viem'

import { levelDemoNote } from '@/components/account/LevelUpgrade'
import { chainLevel, useSwissquoteKeys } from '@/components/account/useSwissquoteKeys'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { SwissquoteLinkCard } from '@/components/swissquote/SwissquoteLinkCard'
import { useSwissquoteLink } from '@/components/swissquote/useSwissquoteLink'
import { ExplorerLink } from '@/components/ui/address'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Alert, Badge, Skeleton } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { EVICTION_DAYS, USDC_DECIMALS } from '@/lib/config'
import { errorMessage, formatUsdc } from '@/lib/format'
import { cleanAmount } from '@/lib/inputs'
import { getAccountOverview, moveToSwissquote, moveToWallet, type AccountOverview } from '@/lib/swissquoteAccount'
import { SEND_STEP_LABEL, type SendStep } from '@/lib/wallet'

/** Transfers between the (MOCK) Swissquote account and this wallet (PDR-024, issue #19). */
export function SwissquoteView() {
  const { wallet, chain, refresh } = useLoadedWallet()
  const link = useSwissquoteLink(wallet)
  const clientId = link.linked?.clientId
  const [overview, setOverview] = useState<{ clientId: string; data: AccountOverview } | null>(null)
  const [toWallet, setToWallet] = useState('')
  const [toSwissquote, setToSwissquote] = useState('')
  const [busy, setBusy] = useState<'withdraw' | 'deposit' | null>(null)
  const [step, setStep] = useState<SendStep | null>(null)
  const [result, setResult] = useState<{ title: string; txHash: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    getAccountOverview(clientId)
      .then((data) => !cancelled && setOverview({ clientId, data }))
      .catch((e) => !cancelled && setError(errorMessage(e)))
    return () => {
      cancelled = true
    }
  }, [clientId, version])

  const data = overview && overview.clientId === clientId ? overview.data : null

  async function run(kind: 'withdraw' | 'deposit', fn: () => Promise<{ title: string; txHash: string }>) {
    setBusy(kind)
    setError(null)
    setResult(null)
    try {
      setResult(await fn())
      setVersion((v) => v + 1)
      refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
      setStep(null)
    }
  }

  const valid = (value: string) => {
    try {
      return parseUnits(value || '0', USDC_DECIMALS) > 0n
    } catch {
      return false
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Swissquote account"
        description="Move USDC between your Swissquote account and this wallet in one tap. Your ownership of this wallet is already proven: no whitelisting, no screenshots."
      />
      {error && <Alert tone="danger" title="Transfer not done">{error}</Alert>}
      {result && (
        <Alert tone="success" title={result.title}>
          <ExplorerLink path={`tx/${result.txHash}`} />
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {!link.linked && (
            <SwissquoteLinkCard link={link} description="Transfers are for linked Swissquote clients. Linking proves this wallet is yours (FINMA travel rule)." />
          )}

          {link.linked && (
            <>
              <Card>
                <CardHeader
                  icon={<Landmark className="h-[18px] w-[18px]" />}
                  title={`${link.linked.maskedName} · Swissquote account`}
                  description="USDC available on your Swissquote account."
                  action={<Badge tone="warning">MOCK</Badge>}
                />
                <CardBody>
                  {data ? (
                    <p className="text-3xl font-semibold tabular-nums">{formatUsdc(BigInt(data.balance))} USDC</p>
                  ) : (
                    <Skeleton className="h-9 w-48" />
                  )}
                  <p className="mt-1 text-sm text-muted">
                    Wallet: {chain.balance === null ? '…' : `${formatUsdc(chain.balance)} USDC`}
                  </p>
                </CardBody>
              </Card>
              <LevelCallout />

              <Card>
                <CardHeader icon={<ArrowDownLeft className="h-[18px] w-[18px]" />} title="Move to my wallet" description="Swissquote sends USDC on-chain to your self-custody wallet." />
                <CardBody className="space-y-3">
                  <Field label="Amount (USDC)" htmlFor="to-wallet">
                    <Input id="to-wallet" inputMode="decimal" placeholder="50.00" value={toWallet} onChange={(e) => setToWallet(cleanAmount(e.target.value, 2))} />
                  </Field>
                  <Button
                    className="w-full"
                    disabled={busy !== null || !valid(toWallet)}
                    onClick={() =>
                      run('withdraw', async () => {
                        const { txHash } = await moveToWallet(link.linked!.clientId, toWallet)
                        setToWallet('')
                        return { title: `${toWallet} USDC moved to your wallet`, txHash }
                      })
                    }
                  >
                    {busy === 'withdraw' ? 'Sending on-chain…' : 'Move to my wallet'}
                  </Button>
                </CardBody>
              </Card>

              <Card>
                <CardHeader icon={<ArrowUpRight className="h-[18px] w-[18px]" />} title="Move to Swissquote" description="Face ID sends USDC to Swissquote; your account is credited as soon as the transfer is on-chain." />
                <CardBody className="space-y-3">
                  <Field label="Amount (USDC)" htmlFor="to-swissquote">
                    <Input id="to-swissquote" inputMode="decimal" placeholder="20.00" value={toSwissquote} onChange={(e) => setToSwissquote(cleanAmount(e.target.value, 2))} />
                  </Field>
                  <Button
                    className="w-full"
                    disabled={busy !== null || !valid(toSwissquote) || !data}
                    onClick={() =>
                      run('deposit', async () => {
                        const { txHash } = await moveToSwissquote({
                          clientId: link.linked!.clientId,
                          wallet,
                          amount: toSwissquote,
                          depositAddress: data!.depositAddress as Address,
                          onStep: setStep,
                        })
                        setToSwissquote('')
                        return { title: `${toSwissquote} USDC credited to your Swissquote account`, txHash }
                      })
                    }
                  >
                    {busy === 'deposit' ? (step ? SEND_STEP_LABEL[step] : 'Crediting…') : 'Move to Swissquote with Face ID'}
                  </Button>
                </CardBody>
              </Card>
            </>
          )}
        </div>

        <Card>
          <CardHeader title="Why it is instant" />
          <CardBody className="space-y-3 text-sm text-muted">
            <p>FINMA lets Swissquote transact only with wallets that belong to its client. You proved it once, with Face ID, when you linked this wallet.</p>
            <p>Travel rule: originator and beneficiary are you, already verified. Swissquote records each transfer with your proof of ownership.</p>
            <p>Deposits are credited only for on-chain transfers coming from your linked wallet.</p>
            {data && (
              <p className="text-xs">
                Demo treasury: {formatUsdc(BigInt(data.treasury))} USDC at <span className="break-all font-mono">{data.depositAddress}</span>
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/**
 * The Account's level, right after the link (PDR-015 funnel, #21): at level 0 a linked client can have a
 * lost phone locked out after 3 days instead of 7, with an identity check. The upgrade itself is signed
 * on the Security page, in the "Lock-out delay" row's panel.
 */
function LevelCallout() {
  const { wallet, chain } = useLoadedWallet()
  const { keys } = useSwissquoteKeys()
  const state = wallet.account ? chain.account : null
  if (!state) return null
  const level = chainLevel(state, keys)
  const demo = levelDemoNote()
  return (
    <section aria-labelledby="level-title" className="rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="level-title" className="font-semibold">
          {level === 1 ? 'Level 1: lock-out after 3 days' : 'Your Account is at level 0'}
        </h2>
        <span className="token text-muted">{level === 1 ? 'Kit + identity check' : 'Kit alone · 7 days'}</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {level === 1
          ? `A lost phone is locked out after ${EVICTION_DAYS[1]} days${demo}, with your Kit and a Swissquote identity check. Swissquote is not an owner of your Account.`
          : `As a linked client, you can have a lost phone locked out after ${EVICTION_DAYS[1]} days instead of ${EVICTION_DAYS[0]}${demo}, with your Kit and a Swissquote identity check. Swissquote never becomes an owner.`}
      </p>
      {level === 0 && (
        <ButtonLink href="/security?change=level" variant="secondary" className="mt-4">
          Shorten the lock-out to 3 days
        </ButtonLink>
      )}
    </section>
  )
}
