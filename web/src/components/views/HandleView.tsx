'use client'

import { AtSign, Check, Copy, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import QRCode from 'react-qr-code'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { ComplianceChecks } from '@/components/send/ComplianceChecks'
import { RecipientField, type Recipient } from '@/components/send/RecipientField'
import { SwissquoteLinkCard } from '@/components/swissquote/SwissquoteLinkCard'
import { useSwissquoteLink } from '@/components/swissquote/useSwissquoteLink'
import { useCopy } from '@/components/ui/address'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Alert } from '@/components/ui/feedback'
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
  const link = useSwissquoteLink(wallet)
  const { session, linked } = link
  const [mine, setMine] = useState<MyHandle>(null)
  const [handle, setHandle] = useState('')
  const [contact, setContact] = useState('')
  const [amount, setAmount] = useState('')
  const [checkValue, setCheckValue] = useState('')
  const [checkAmount, setCheckAmount] = useState('')
  const [checkRecipient, setCheckRecipient] = useState<Recipient | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const linkedClient = linked?.clientId
  useEffect(() => {
    if (!linkedClient) return
    let cancelled = false
    getMyHandle(linkedClient)
      .catch(() => null)
      .then((next) => !cancelled && setMine(next))
    return () => {
      cancelled = true
    }
  }, [linkedClient])

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

  const requestUrl = mine && linked ? paymentRequestUrl(mine.handle, amount || undefined) : ''

  return (
    <div className="space-y-6">
      <PageHeader title="Handle" description="Get paid by @name instead of a 0x address, with your verified name shown to the payer." />
      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <SwissquoteLinkCard link={link} description="Handles are for linked Swissquote clients: your name is verified by your KYC." />

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
          {mine && linked && (
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
