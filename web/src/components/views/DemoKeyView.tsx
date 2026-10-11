'use client'

import { Check, ExternalLink, X } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'

import { useWallet } from '@/components/providers/WalletProvider'
import { Logo } from '@/components/shell/Logo'
import { Button } from '@/components/ui/button'
import { Alert, Badge, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { accountNonce, accountOwners, accountTxDigest } from '@/lib/account'
import { EXPLORER_URL } from '@/lib/config'
import { errorMessage, shortAddress } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { queryParam } from '@/lib/inputs'
import { answerRequest, currentRequest, fromRelayedCall, getPairing, markSeen, registerOnPairing, type KeyPairing, type KeySignRequest } from '@/lib/keyRelay'
import { createSecurityKey, keyErrorMessage, signWithSecurityKey } from '@/lib/securityKey'
import { clearDemoKey, loadDemoKey, saveDemoKey, type DemoKeyRecord } from '@/lib/storage'

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
const CODE_ALPHABET = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g
const cleanCode = (value: string) => value.toUpperCase().replace(CODE_ALPHABET, '').slice(0, 6)

type Outcome = { id: string; result: 'signed' | 'refused' }
type Contact = 'idle' | 'waiting' | 'request' | 'touching' | 'signed'

/**
 * MOCK: the demo security key (ADR-043, surface brief web-src-components-views-demokeyview-tsx). A
 * teammate's phone plays the user's FIDO2 key: a real WebAuthn credential here, a real third owner of
 * the Account onchain, reached through the MOCK relay instead of USB or NFC. On ink, the key as a real
 * one behaves (blind, one contact); on white, the Demo screen shows what a real key never could: the
 * request, whose SafeTx digest this phone computes itself from the Account's nonce before signing.
 */
export function DemoKeyView() {
  const { ready } = useWallet()
  const [record, setRecord] = useState<DemoKeyRecord | null>(() => (typeof window === 'undefined' ? null : loadDemoKey()))
  const [owner, setOwner] = useState<boolean | null>(null)
  const [request, setRequest] = useState<KeySignRequest | null>(null)
  const [nonce, setNonce] = useState<{ id: string; matches: boolean } | null>(null)
  const [touching, setTouching] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seen = useRef<string | null>(null)

  // Is this key an owner of the Account yet? Often while the wallet still has to approve, rarely after.
  const checkOwner = useEffectEvent(async () => {
    if (!record) return
    const owners = await accountOwners(record.account).catch(() => null)
    if (owners) setOwner(owners.some((o) => same(o, record.proxy)))
  })
  useEffect(() => {
    if (!record) return
    const first = setTimeout(() => void checkOwner(), 0)
    const timer = setInterval(() => void checkOwner(), owner ? 30_000 : 5_000)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [record, owner])

  // The waiting request, polled through the relay. Its nonce is checked onchain once per request.
  const poll = useEffectEvent(async () => {
    if (!record || touching || document.visibilityState === 'hidden') return
    const next = await currentRequest(record.proxy).catch(() => undefined)
    if (next === undefined) return
    const valid = next && same(next.account, record.account) && same(next.proxy, record.proxy) ? next : null
    setRequest(valid)
    if (valid && seen.current !== valid.id) {
      seen.current = valid.id
      setOutcome(null)
      setError(null)
      void markSeen(record.proxy, valid.id).catch(() => {})
      const chainNonce = await accountNonce(valid.account).catch(() => null)
      setNonce({ id: valid.id, matches: chainNonce !== null && chainNonce.toString() === valid.nonce })
    }
  })
  useEffect(() => {
    if (!record || !owner) return
    const first = setTimeout(() => void poll(), 0)
    const timer = setInterval(() => void poll(), 1_500)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [record, owner])

  // A signed or refused request stays on screen a moment, then the key goes back to waiting.
  useEffect(() => {
    if (!outcome) return
    const timer = setTimeout(() => setOutcome(null), 6_000)
    return () => clearTimeout(timer)
  }, [outcome])

  if (!ready) return null

  async function approve() {
    if (!record || !request || touching) return
    setTouching(true)
    setError(null)
    try {
      // The digest comes from the Account's nonce read here, never from the relay.
      const chainNonce = await accountNonce(request.account)
      if (chainNonce.toString() !== request.nonce) throw new Error('This request no longer matches your Account’s next transaction. Refuse it.')
      const digest = accountTxDigest(request.account, fromRelayedCall(request.call), chainNonce)
      const signature = await signWithSecurityKey(digest, record.credentialId)
      await answerRequest(record.proxy, request.id, { signature })
      setOutcome({ id: request.id, result: 'signed' })
      setRequest(null)
    } catch (e) {
      setError(keyErrorMessage(e))
    } finally {
      setTouching(false)
    }
  }

  async function refuse() {
    if (!record || !request) return
    setError(null)
    try {
      await answerRequest(record.proxy, request.id, { refused: true })
      setOutcome({ id: request.id, result: 'refused' })
      setRequest(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const live = record && owner ? (request ? 'request' : outcome ? 'outcome' : 'idle') : null
  const contact: Contact = touching ? 'touching' : live === 'request' ? 'request' : outcome?.result === 'signed' ? 'signed' : record && !owner ? 'waiting' : 'idle'
  const headline = !record
    ? { title: 'Set up this key', text: 'This phone will play your FIDO2 security key. Its Face ID stands in for the touch.' }
    : owner === false
      ? { title: 'Not an owner yet', text: 'Approve on your wallet with Kit and biometrics: then this key is the third owner of your Account.' }
      : live === 'request'
        ? { title: 'Touch to approve', text: 'That is all a real key shows. Here, Face ID stands in for the touch.' }
        : outcome
          ? outcome.result === 'signed'
            ? { title: 'Approved', text: 'The signature went back to your wallet. A real key would just stop blinking.' }
            : { title: 'Refused', text: 'Nothing was signed. Your wallet says so.' }
          : { title: 'Waiting', text: 'A real key waits too, blind. When your wallet asks, the contact lights up.' }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <section className="bg-hero text-hero-fg">
        <div className="mx-auto w-full max-w-md px-4 pb-10 pt-[max(env(safe-area-inset-top),1.25rem)] sm:pt-8">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 text-base font-semibold tracking-[-0.01em]">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 ring-[1.5px] ring-inset ring-accent" />
              Simulated security key
            </span>
            <Badge tone="warning">MOCK</Badge>
          </div>

          <KeyDrawing contact={contact} onTouch={live === 'request' && request && nonce?.id === request.id && nonce.matches ? approve : undefined} />

          <div className="text-center" aria-live="polite">
            <h1 className="text-balance text-[34px] font-semibold leading-[1.05] tracking-[-0.035em]">{headline.title}</h1>
            <p className="mx-auto mt-2 max-w-xs text-pretty text-[15px] text-hero-muted">{headline.text}</p>
          </div>
        </div>
      </section>

      {/* The seam: everything below is what a real key cannot show. */}
      <div className="relative z-10 -mt-[18px] flex justify-center px-4">
        <span className="rounded-lg border border-foreground bg-background px-3 py-1.5 text-center text-[15px] font-semibold tracking-[-0.01em]">
          Demo screen · what a real key can’t show
        </span>
      </div>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-10 pt-6">
        {!record ? (
          <SetUp onDone={(next) => {
            saveDemoKey(next)
            setRecord(next)
            setOwner(false)
          }} />
        ) : (
          <div className="space-y-6">
            {live === 'request' && request ? (
              <RequestPanel request={request} nonceMatches={nonce?.id === request.id ? nonce.matches : null} touching={touching} onApprove={approve} onRefuse={refuse} />
            ) : (
              <KeyPanel record={record} owner={owner} outcome={outcome} />
            )}
            {error && (
              <Alert tone="danger" title="Not signed">
                {error}
              </Alert>
            )}
          </div>
        )}

        <footer className="mt-10 space-y-3 border-t border-border pt-5 text-xs text-muted">
          <p>
            A real FIDO2 key has no screen: it signs what your wallet shows you, after a touch and its PIN. This phone stands in for it in the
            demo. The request travels through Swissquote’s relay instead of USB or NFC, and the relay can sign nothing.
          </p>
          <div className="flex items-center justify-between gap-3">
            <Logo compact />
            {record && (
              <button
                type="button"
                className="text-muted underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => {
                  clearDemoKey()
                  setRecord(null)
                  setOwner(null)
                  setRequest(null)
                }}
              >
                Forget this key on this phone
              </button>
            )}
          </div>
        </footer>
      </main>
    </div>
  )
}

/**
 * The key as a real one looks: a connector, its engraved name ("SIMULATED", the largest lettering on the
 * ink, so the jury reads it from across the room), one contact (the key factor code). The contact pulses
 * while a request waits, and its rings stay inside the body; a tap on it approves, like a real key's touch.
 */
function KeyDrawing({ contact, onTouch }: { contact: Contact; onTouch?: () => void }) {
  const lit = contact === 'request' || contact === 'touching'
  return (
    <div className="relative mx-auto mb-7 mt-8 h-[132px] w-full max-w-[360px]" aria-hidden>
      <div className="absolute left-0 top-[44px] h-[44px] w-[34px] rounded-[3px] bg-hero-muted/30">
        <span className="absolute left-[9px] top-[13px] h-[18px] w-[16px] rounded-[2px] bg-hero-muted/40" />
      </div>
      <div className="absolute inset-y-0 left-[30px] right-0 rounded-3xl bg-hero-2 ring-1 ring-inset ring-hero-muted/15">
        <span className="absolute left-[18px] top-1/2 -translate-y-1/2 leading-none">
          <span className="block text-[clamp(20px,7.2vw,28px)] font-semibold tracking-[0.04em] text-hero-fg/90">SIMULATED</span>
          <span className="token mt-2.5 block text-hero-muted">FIDO2 key · demo</span>
        </span>
        <div className="absolute right-9 top-1/2 h-16 w-16 -translate-y-1/2">
          {lit && (
            <>
              <span className="animate-key-pulse absolute -inset-2 ring-1 ring-accent/55" />
              <span className="animate-key-pulse absolute -inset-4 ring-1 ring-accent/25 [animation-delay:0.9s]" />
            </>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={!onTouch}
            onClick={onTouch}
            className={`absolute inset-0 grid place-items-center transition-[box-shadow,background-color] duration-200 ${
              contact === 'touching' ? 'bg-accent/15 ring-[3px] ring-inset ring-accent' : lit ? 'ring-[3px] ring-inset ring-accent' : contact === 'signed' ? 'ring-[3px] ring-inset ring-accent/70' : 'ring-[3px] ring-inset ring-accent/35'
            } ${onTouch ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {contact === 'signed' && <Check className="animate-pop h-6 w-6 text-accent" />}
            {contact === 'touching' && <Spinner className="h-5 w-5 text-accent" />}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Pairing: the wallet's code, then this phone's Face ID registers the key. Nothing secret is stored here. */
function SetUp({ onDone }: { onDone: (record: DemoKeyRecord) => void }) {
  const [code, setCode] = useState(() => cleanCode(queryParam('pair')))
  const [pairing, setPairing] = useState<KeyPairing | null>(null)
  const [busy, setBusy] = useState<'finding' | 'registering' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function find(value: string) {
    setBusy('finding')
    setError(null)
    try {
      setPairing(await getPairing(value))
    } catch (e) {
      setPairing(null)
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  const findScanned = useEffectEvent((value: string) => void find(value))
  // A code scanned from the wallet's QR (?pair=) is looked up at once; a typed one when it is complete.
  useEffect(() => {
    const scanned = cleanCode(queryParam('pair'))
    if (scanned.length !== 6) return
    const timer = setTimeout(() => findScanned(scanned), 0)
    return () => clearTimeout(timer)
  }, [])

  async function register() {
    if (!pairing) return
    setBusy('registering')
    setError(null)
    try {
      // This phone's own authenticator; the wallet's passkey is excluded, so the wallet's phone can't be its own key.
      const key = await createSecurityKey(pairing.label, pairing.excludeCredentialId, 'platform')
      const publicKey = { x: key.publicKey.x.toString(), y: key.publicKey.y.toString() }
      await registerOnPairing(pairing.code, { credentialId: key.credentialId, publicKey })
      onDone({ account: pairing.account, label: pairing.label, credentialId: key.credentialId, publicKey, proxy: key.proxy, addedAt: Date.now() })
    } catch (e) {
      setError(keyErrorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">Pair with your wallet</h2>
        <p className="mt-1.5 text-sm text-muted">Type the code your wallet shows, or scan its QR code with this phone’s camera.</p>
      </div>
      <Field label="Code from your wallet" htmlFor="key-code" hint="Security → Add a security key → Use a demo key on another phone.">
        <Input
          id="key-code"
          value={code}
          onChange={(e) => {
            const next = cleanCode(e.target.value)
            setPairing(null)
            setCode(next)
            if (next.length === 6) void find(next)
          }}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="ABC234"
          className="h-14 font-mono !text-2xl tracking-[0.3em]"
        />
      </Field>
      {busy === 'finding' && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner /> Finding the request…
        </p>
      )}
      {pairing && (
        <>
          <Rows>
            <Row label="Wallet">{pairing.label}</Row>
            <Row label="Account" mono>
              {shortAddress(pairing.account)}
            </Row>
            <Row label="This key">Becomes its third owner, still 2 of 3 needed</Row>
          </Rows>
          <Button size="lg" className="w-full" disabled={!!busy} onClick={register}>
            {busy === 'registering' ? (
              <>
                <Spinner /> Waiting for Face ID…
              </>
            ) : (
              <>
                <span aria-hidden className="h-2.5 w-2.5 ring-[1.5px] ring-inset ring-accent-fg" /> Register with Face ID
              </>
            )}
          </Button>
        </>
      )}
      {error && (
        <Alert tone="danger" title="Not paired">
          {error}
        </Alert>
      )}
    </div>
  )
}

/** The key between requests: which Account it guards, whether it is an owner yet, the last answer. */
function KeyPanel({ record, owner, outcome }: { record: DemoKeyRecord; owner: boolean | null; outcome: Outcome | null }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">
          {owner === false ? 'Waiting for your wallet' : outcome ? (outcome.result === 'signed' ? 'Approved and sent back' : 'Refused, nothing signed') : `${record.label}’s key`}
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          {owner === false
            ? 'Check your wallet shows this same address. The key becomes an owner when you approve there.'
            : outcome
              ? 'Back to waiting in a moment.'
              : 'No request right now. Keep this screen open: requests appear here.'}
        </p>
      </div>
      <Rows>
        <Row label="This key" mono>
          {shortAddress(record.proxy)}
        </Row>
        <Row label="Account" mono>
          {shortAddress(record.account)}
        </Row>
        <Row label="Onchain">
          {owner === null ? (
            <span className="inline-flex items-center gap-2 text-muted">
              <Spinner /> Checking…
            </span>
          ) : owner ? (
            <a
              href={`${EXPLORER_URL}/address/${record.account}#readProxyContract`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
            >
              Third owner, 2 of 3 needed <ExternalLink className="h-3.5 w-3.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            'Not an owner yet'
          )}
        </Row>
      </Rows>
      {outcome?.result === 'refused' && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <X className="h-4 w-4" aria-hidden /> Your wallet shows the refusal.
        </p>
      )}
    </div>
  )
}

/** A signing request as the wallet describes it, checked against the Account's next transaction. */
function RequestPanel({
  request,
  nonceMatches,
  touching,
  onApprove,
  onRefuse,
}: {
  request: KeySignRequest
  nonceMatches: boolean | null
  touching: boolean
  onApprove: () => void
  onRefuse: () => void
}) {
  const now = useNow(1_000)
  const ago = Math.max(0, Math.round((now - request.createdAt) / 1000))
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.025em]">{request.title}</h2>
        <p className="mt-1.5 text-sm text-muted">
          As your wallet describes it. This key checks it is your Account’s next transaction, then computes what it signs itself.
        </p>
      </div>
      <Rows>
        {request.lines.map((line) => (
          <Row key={`${line.label}:${line.figure ?? ''}:${line.value ?? ''}`} label={line.label} note={line.note}>
            {line.figure && <span className="font-mono">{line.figure}</span>}
            {line.figure && line.value ? ' ' : null}
            {line.value}
          </Row>
        ))}
        <Row label="Asked">
          {ago < 60 ? `${ago} s ago` : `${Math.round(ago / 60)} min ago`}
        </Row>
        <Row label="Account">
          <span className="font-mono">{shortAddress(request.account)}</span>
        </Row>
        <Row label="Nonce">
          {nonceMatches === null ? (
            <span className="inline-flex items-center gap-2 text-muted">
              <Spinner /> Reading your Account…
            </span>
          ) : nonceMatches ? (
            <>
              Checked onchain · next transaction <span className="font-mono">#{request.nonce}</span>
            </>
          ) : (
            <span className="text-danger">Not your Account’s next transaction</span>
          )}
        </Row>
      </Rows>
      {nonceMatches === false && (
        <Alert tone="danger" title="Refuse this request">
          It isn’t your Account’s next transaction, so this key won’t sign it.
        </Alert>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Button variant="secondary" size="lg" disabled={touching} onClick={onRefuse}>
          Refuse
        </Button>
        <Button size="lg" disabled={touching || !nonceMatches} onClick={onApprove}>
          {touching ? (
            <>
              <Spinner /> Waiting for Face ID…
            </>
          ) : (
            <>
              <span aria-hidden className="h-2.5 w-2.5 ring-[1.5px] ring-inset ring-accent-fg" /> Touch the key
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="border-t border-border">{children}</ul>
}

/** A label, its value (mono only for figures and addresses) and, under it, what the value means. */
function Row({ label, mono = false, note, children }: { label: string; mono?: boolean; note?: string; children: ReactNode }) {
  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 text-sm">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 text-right font-medium">
        <span className={mono ? 'font-mono' : ''}>{children}</span>
        {note && <span className="block text-xs font-normal text-muted">{note}</span>}
      </span>
    </li>
  )
}
