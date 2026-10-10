'use client'

import { AtSign, BadgeCheck, Check, Copy, Link2, LogOut, ShieldCheck, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import QRCode from 'react-qr-code'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { ComplianceChecks } from '@/components/send/ComplianceChecks'
import { RecipientField, type Recipient } from '@/components/send/RecipientField'
import { useCopy } from '@/components/ui/address'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Alert, Badge } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page'
import { USDC_DECIMALS } from '@/lib/config'
import { errorMessage } from '@/lib/format'
import {
  addContact,
  claimHandle,
  getMyHandle,
  paymentRequestUrl,
  setVisibility,
  type MyHandle,
  type Visibility,
} from '@/lib/handles'
import { getMyWallet, linkWallet, type RegisteredWallet } from '@/lib/registry'
import { clearSession, getSession, mockSignIn, type SwissquoteSession } from '@/lib/session'
import { usdcTransfer } from '@/lib/wallet'

const VISIBILITY: { value: Visibility; label: string; hint: string }[] = [
  { value: 'clients', label: 'Swissquote clients', hint: 'Any signed-in client who types your exact handle.' },
  { value: 'contacts', label: 'My contacts', hint: 'Only clients you added below.' },
  { value: 'nobody', label: 'Nobody', hint: 'Use payment requests instead.' },
]

/** `@handle` settings and payment requests (PDR-010, issue #20). */
export function HandleView() {
  const { wallet, chain, transfers } = useLoadedWallet()
  const { copied, copy } = useCopy()
  // Client-only page (AppShell renders after hydration): localStorage is available.
  const [session, setSessionState] = useState<SwissquoteSession | null>(() => getSession())
  const [linked, setLinked] = useState<RegisteredWallet | null>(null)
  const [mine, setMine] = useState<MyHandle>(null)
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [contact, setContact] = useState('')
  const [amount, setAmount] = useState('')
  const [checkValue, setCheckValue] = useState('')
  const [checkAmount, setCheckAmount] = useState('')
  const [checkRecipient, setCheckRecipient] = useState<Recipient | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (current: SwissquoteSession | null) => {
      const entry = current ? await getMyWallet(current.clientId).catch(() => null) : null
      const ownsThisWallet = !!entry && entry.keySafe.toLowerCase() === wallet.address.toLowerCase()
      const handle = ownsThisWallet && current ? await getMyHandle(current.clientId).catch(() => null) : null
      return { linked: ownsThisWallet ? entry : null, mine: handle }
    },
    [wallet.address],
  )

  const refresh = useCallback(
    async (current: SwissquoteSession | null) => {
      const next = await load(current)
      setLinked(next.linked)
      setMine(next.mine)
    },
    [load],
  )

  useEffect(() => {
    let cancelled = false
    load(getSession()).then((next) => {
      if (cancelled) return
      setLinked(next.linked)
      setMine(next.mine)
    })
    return () => {
      cancelled = true
    }
  }, [load])

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const requestUrl = mine ? paymentRequestUrl(mine.handle, amount || undefined) : ''

  return (
    <div className="space-y-6">
      <PageHeader title="Handle" description="Get paid by @name instead of a 0x address, with your verified name shown to the payer." />
      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              icon={<ShieldCheck className="h-[18px] w-[18px]" />}
              title="Swissquote account"
              description="Handles are for linked Swissquote clients: your name is verified by your KYC."
              action={<Badge tone="warning">MOCK</Badge>}
            />
            <CardBody className="space-y-4">
              {!session ? (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const next = mockSignIn(name)
                    setSessionState(next)
                    void refresh(next)
                  }}
                >
                  <Field label="Name on your Swissquote account" htmlFor="name" hint="Mock e-banking sign-in for the demo.">
                    <Input id="name" placeholder="Adam Meier" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Button type="submit" className="w-full" disabled={name.trim().length < 2}>
                    Sign in with Swissquote
                  </Button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{session.displayName}</p>
                    <p className="text-xs text-muted">Client {session.clientId}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      clearSession()
                      setSessionState(null)
                      void refresh(null)
                    }}
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </div>
              )}

              {session && !linked && (
                <Alert
                  tone="info"
                  title="Link this wallet to your account"
                  action={
                    <Button
                      disabled={busy !== null}
                      onClick={() =>
                        act('link', async () => {
                          setLinked(await linkWallet({ clientId: session.clientId, displayName: session.displayName, wallet }))
                          setMine(await getMyHandle(session.clientId).catch(() => null))
                        })
                      }
                    >
                      <Link2 className="h-4 w-4" /> {busy === 'link' ? 'Waiting for Face ID…' : 'Link with Face ID'}
                    </Button>
                  }
                >
                  One Face ID signs a statement that this wallet is yours. Swissquote keeps it as proof of ownership (FINMA travel rule) and will see this wallet&apos;s on-chain activity.
                </Alert>
              )}
              {linked && (
                <p className="flex items-center gap-2 text-sm">
                  <BadgeCheck className="h-4 w-4 text-success" /> Linked as <span className="font-medium">{linked.maskedName}</span>
                </p>
              )}
            </CardBody>
          </Card>

          {linked && session && (
            <Card>
              <CardHeader icon={<AtSign className="h-[18px] w-[18px]" />} title={mine ? `@${mine.handle}` : 'Choose your handle'} />
              <CardBody className="space-y-5">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    act('claim', async () => setMine(await claimHandle(session.clientId, handle, mine?.visibility)))
                  }}
                >
                  <Input placeholder={mine ? 'Change handle' : 'adam'} value={handle} onChange={(e) => setHandle(e.target.value)} />
                  <Button type="submit" disabled={busy !== null || handle.trim().length < 3}>
                    {mine ? 'Change' : 'Claim'}
                  </Button>
                </form>

                {mine && (
                  <fieldset className="space-y-2">
                    <legend className="mb-1 text-sm font-medium">Who can find you by handle</legend>
                    {VISIBILITY.map((option) => (
                      <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm has-[:checked]:border-accent">
                        <input
                          type="radio"
                          name="visibility"
                          className="mt-1"
                          checked={mine.visibility === option.value}
                          onChange={() => act('visibility', async () => setMine(await setVisibility(session.clientId, option.value)))}
                        />
                        <span>
                          <span className="font-medium">{option.label}</span>
                          <span className="block text-xs text-muted">{option.hint}</span>
                        </span>
                      </label>
                    ))}
                    <p className="text-xs text-muted">
                      Exact handle only: nobody can search or list clients. Anyone you pay, or who pays you, learns your address and can read its on-chain history.
                    </p>
                  </fieldset>
                )}

                {mine?.visibility === 'contacts' && (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      act('contact', async () => {
                        setMine(await addContact(session.clientId, contact))
                        setContact('')
                      })
                    }}
                  >
                    <Field label="Add a contact" htmlFor="contact" hint={`${mine.contacts} contact(s) can find you.`}>
                      <div className="flex gap-2">
                        <Input id="contact" placeholder="@lea" value={contact} onChange={(e) => setContact(e.target.value)} />
                        <Button type="submit" variant="secondary" disabled={busy !== null || contact.trim().length < 3}>
                          <Users className="h-4 w-4" /> Add
                        </Button>
                      </div>
                    </Field>
                  </form>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {mine && (
            <Card>
              <CardHeader title="Request a payment" description="Share a link or a QR code: the payer sees your verified name before paying." />
              <CardBody className="flex flex-col items-center space-y-4 text-center">
                <Field label="Amount (optional)" htmlFor="request-amount">
                  <Input id="request-amount" inputMode="decimal" placeholder="20.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(',', '.'))} />
                </Field>
                <div className="rounded-2xl border border-border bg-white p-4">
                  <QRCode value={requestUrl} size={164} fgColor="#121418" bgColor="#ffffff" />
                </div>
                <p className="max-w-sm break-all font-mono text-xs text-muted">{requestUrl}</p>
                <Button className="w-full" onClick={() => copy(requestUrl, 'Payment link copied')}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy payment link
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Check a payment" description="What a payer sees before Face ID: verified name, sanctions screening, simulation, look-alike and large-payment checks." />
            <CardBody className="space-y-4">
              <RecipientField value={checkValue} onChange={setCheckValue} onRecipient={setCheckRecipient} />
              <Field label="Amount (USDC)" htmlFor="check-amount">
                <Input id="check-amount" inputMode="decimal" placeholder="0.00" value={checkAmount} onChange={(e) => setCheckAmount(e.target.value.replace(',', '.'))} />
              </Field>
              <ComplianceChecks
                from={wallet.address}
                to={checkRecipient?.address ?? null}
                amount={parseAmount(checkAmount)}
                balance={chain.balance}
                knownRecipients={transfers?.map((t) => t.counterparty) ?? []}
                calls={checkRecipient && parseAmount(checkAmount) ? [usdcTransfer(checkRecipient.address, checkAmount)] : undefined}
                onChange={() => {}}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function parseAmount(value: string) {
  try {
    const amount = parseUnits(value || '0', USDC_DECIMALS)
    return amount > 0n ? amount : null
  } catch {
    return null
  }
}
