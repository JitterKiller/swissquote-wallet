'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react'

import { levelDemoNote } from '@/components/account/LevelUpgrade'
import { lossBound } from '@/components/account/LossBound'
import { useOwnerKinds } from '@/components/account/useOwnerKinds'
import { chainLevel, useSwissquoteKeys } from '@/components/account/useSwissquoteKeys'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { useSwissquoteLink } from '@/components/swissquote/useSwissquoteLink'
import { Button, ButtonLink } from '@/components/ui/button'
import { FactorLabel } from '@/components/ui/factor'
import { Alert, Badge, Skeleton } from '@/components/ui/feedback'
import { PageHeader } from '@/components/ui/page'
import { EVICTION_DAYS, EVICTION_DELAY_IS_DEMO, EVICTION_DELAY_SECONDS, type Level } from '@/lib/config'
import { errorMessage, formatDay, formatUsdc } from '@/lib/format'
import { changeOffer, getOfferStatus, offerOf, type OfferAction, type OfferId, type OfferStatus, type Subscription } from '@/lib/offers'
import { markOffersHintSeen, offersHintSeen } from '@/lib/storage'

/** Figures in mono, words in the grotesk (DESIGN.md, the Mono-Is-Data Rule). */
function Figure({ children }: { children: ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>
}

const OFFER_IDS: OfferId[] = ['free', 'client', 'premium']

/** The three offers of PDR-019. Premium's price is a placeholder until the business model is done. */
const OFFERS: Record<OfferId, { name: string; who: string; level: Level; price: ReactNode }> = {
  free: {
    name: 'Free',
    who: 'For everyone',
    level: 0,
    price: (
      <>
        CHF <Figure>0</Figure>
      </>
    ),
  },
  client: {
    name: 'Client',
    who: 'Linked Swissquote clients',
    level: 1,
    price: (
      <>
        CHF <Figure>0</Figure>
      </>
    ),
  },
  premium: {
    name: 'Premium',
    who: 'Theft protection, for linked clients',
    level: 1,
    price: (
      <>
        CHF <Figure>5–9</Figure> a month
        <span className="block text-xs font-normal text-muted">Price to model</span>
      </>
    ),
  },
}

/** "3 min in this demo" while the testnet delays are on (the Security page's wording). */
const demoDelay = (level: Level) => (EVICTION_DELAY_IS_DEMO ? `${Math.round(EVICTION_DELAY_SECONDS[level] / 60)} min in this demo` : null)

/** The worst case for a stolen phone: today's limit, then one more after each daily reset until the lock-out. */
type Bound = { amount: bigint | null; resets: number; notes: ReactNode[] }

type Cell = { value?: ReactNode; lines?: (ReactNode | null)[]; none?: boolean; bound?: Bound }

type Row = { id: string; label: string; detail?: ReactNode; link?: { href: string; label: string }; cells: Record<OfferId, Cell> }

/** Every row, from the user's own daily limit and Swissquote's fee quota. */
function offerRows(limit: bigint | null, quota: number | null): { rows: Row[]; same: Row[] } {
  // A key gives the same powers at every level (PDR-019): each Free and Client cell says what the user's own
  // key does there. "Soon" marks what the app doesn't build yet (ADR-038): a key tap for large payments,
  // and replacing a lost Kit with the phone and the key.
  const soon = (text: ReactNode) => (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {text} <Badge>Soon</Badge>
    </span>
  )
  const largePayments: Cell = {
    value: <FactorLabel factors={['phone', 'kit']}>Face ID + your Kit passphrase</FactorLabel>,
    lines: [soon('Or a tap on your own key')],
  }
  const slowExit: Cell = { value: 'Move out day by day', lines: ['Within your daily limit, with Face ID', soon('Or replaced with your own key')] }
  const ownKey: Cell = { value: <FactorLabel factors={['key']}>Bring your own</FactorLabel>, lines: ['Any FIDO2 key, added by you'] }
  const allCovered: Cell = { value: 'All covered', lines: ['No monthly quota, by Swissquote'] }
  const withOwnKey = 'With your own key: one day of the limit'
  const extras: Cell = { value: '@handle and verified payee', lines: ['One-tap transfers with your Swissquote account'] }
  const everywhere = (cell: Cell): Record<OfferId, Cell> => ({ free: cell, client: cell, premium: cell })

  const rows: Row[] = [
    {
      id: 'lock-out',
      label: 'Stolen phone',
      detail: 'When your Kit locks it out',
      cells: {
        free: {
          value: (
            <>
              After <Figure>{EVICTION_DAYS[0]}</Figure> days
            </>
          ),
          lines: ['Your Kit alone', demoDelay(0), 'At once with your own key'],
        },
        client: {
          value: (
            <>
              After <Figure>{EVICTION_DAYS[1]}</Figure> days
            </>
          ),
          lines: ['Your Kit + a Swissquote identity check', demoDelay(1), 'At once with your own key'],
        },
        premium: { value: 'At once', lines: ['Your Kit + the included key'] },
      },
    },
    {
      id: 'worst-case',
      label: 'Worst case',
      detail:
        limit !== null ? (
          <>
            If your phone is stolen, at your <Figure>{formatUsdc(limit)}</Figure> USDC daily limit
          </>
        ) : (
          'If your phone is stolen'
        ),
      cells: {
        free: {
          bound: { amount: limit === null ? null : lossBound(limit, 0), resets: EVICTION_DAYS[0], notes: [<Resets key="r" days={EVICTION_DAYS[0]} />, withOwnKey] },
        },
        client: {
          bound: { amount: limit === null ? null : lossBound(limit, 1), resets: EVICTION_DAYS[1], notes: [<Resets key="r" days={EVICTION_DAYS[1]} />, withOwnKey] },
        },
        // Locked out at once with the key: one day of the limit, if the owner acts before the next reset.
        premium: { bound: { amount: limit, resets: 0, notes: ['If you act before the next daily reset', 'Insured (partner to be chosen)'] } },
      },
    },
    {
      id: 'large-payments',
      label: 'Large payments',
      detail: 'Above your daily limit',
      cells: {
        free: largePayments,
        client: largePayments,
        premium: { value: <FactorLabel factors={['phone', 'key']}>Face ID + a tap on the key</FactorLabel>, lines: [soon('The included key')] },
      },
    },
    {
      id: 'lost-kit',
      label: 'Lost Kit',
      cells: { free: slowExit, client: slowExit, premium: { value: soon('Replaced at once'), lines: ['With your phone and the included key'] } },
    },
    {
      id: 'security-key',
      label: 'Security key',
      detail: 'With one, any offer locks a stolen phone out at once.',
      link: { href: '/wallet/security?change=key', label: 'Add a security key' },
      cells: { free: ownKey, client: ownKey, premium: { value: <FactorLabel factors={['key']}>Included</FactorLabel>, lines: ['Shipped, set up and checked for you'] } },
    },
    {
      id: 'network-fees',
      label: 'Network fees',
      cells: {
        free: {
          value:
            quota !== null ? (
              <>
                <Figure>{quota}</Figure> a month covered
              </>
            ) : (
              'A monthly quota covered'
            ),
          lines: ['Security operations always covered'],
        },
        client: allCovered,
        premium: allCovered,
      },
    },
    {
      id: 'banking-extras',
      label: 'Banking extras',
      cells: { free: { none: true }, client: extras, premium: extras },
    },
    {
      id: 'assistance',
      label: 'Assistance',
      cells: {
        free: { value: 'In-app guide', lines: ['“Phone lost or stolen?” step by step'] },
        client: { value: 'Guide + alerts', lines: ['Push, SMS, email and e-banking'] },
        premium: { value: 'Guide, alerts + a hotline', lines: ['Priority, when your phone is stolen'] },
      },
    },
  ]

  const same: Row[] = [
    { id: 'account', label: 'Your Account', cells: everywhere({ value: 'Owned only by you', lines: ['Swissquote is never an owner'] }) },
    { id: 'daily-limit', label: 'Daily limit', cells: everywhere({ value: 'Chosen by you', lines: ['No offer sells a higher one'] }) },
  ]
  return { rows, same }
}

function Resets({ days }: { days: number }) {
  return (
    <>
      Today + <Figure>{days}</Figure> daily resets
    </>
  )
}

/**
 * Offers (#22, PDR-019, ADR-039, surface brief web-src-components-views-offersview-tsx): what Free,
 * Client and Premium "Theft protection" do for this Account, the user's column outlined, the worst
 * case from their own daily limit. Basic security is the same in every column. The offer comes from
 * the link (registry) and the MOCK subscription (`/api/offers`); the level is read onchain.
 */
export function OffersView() {
  const { wallet, chain } = useLoadedWallet()
  const link = useSwissquoteLink(wallet)
  const { keys } = useSwissquoteKeys()
  const state = wallet.account ? chain.account : null
  // The level the chain enforces (as on the Security page); 0 before the wallet has an Account.
  const level: Level | null = !wallet.account ? 0 : state ? chainLevel(state, keys) : null
  const limit = state?.allowance?.amount ?? null
  const clientId = link.linked?.clientId ?? null
  // A key already among the owners changes the next step: nothing to order or add.
  const { keyOwner } = useOwnerKinds(state ?? { owners: [] }, wallet.address)

  // Next keeps this page alive while hidden (Activity) and re-runs this effect when it shows again:
  // the subscription is read again on every visit.
  const [status, setStatus] = useState<{ clientId: string | null; data: OfferStatus } | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!link.checked) return
    let cancelled = false
    getOfferStatus(clientId)
      .then((data) => {
        if (cancelled) return
        setStatus({ clientId, data })
        setFailed(false)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [link.checked, clientId, attempt])
  const data = status && status.clientId === clientId ? status.data : null
  const offer: OfferId | null = !link.checked ? null : !link.linked ? 'free' : data ? offerOf(true, data.subscription) : null

  const [busy, setBusy] = useState<OfferAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  // On phones one offer shows at a time: the user's own until they pick another (null).
  const [shown, setShown] = useState<OfferId | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  // Transient: a picked tab and a failed action don't survive leaving the page.
  useLayoutEffect(
    () => () => {
      setShown(null)
      setError(null)
    },
    [],
  )

  // MOCK: subscribing, ordering the key and ending Premium only change the record in /api/offers.
  async function act(action: OfferAction) {
    if (!clientId) return
    setBusy(action)
    setError(null)
    try {
      setStatus({ clientId, data: await changeOffer(clientId, action) })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
      // The button that was pressed is gone or moved: the new state is read from the heading.
      heading.current?.focus()
    }
  }

  const { rows, same } = offerRows(limit, data?.sponsoredPerMonth ?? null)
  const loadingBound = !!wallet.account && limit === null

  const subscribe = (
    <span className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" className="max-sm:h-11" disabled={busy !== null} onClick={() => act('subscribe')}>
        {busy === 'subscribe' ? 'Subscribing…' : 'Subscribe'}
      </Button>
      <Badge tone="warning">MOCK</Badge>
    </span>
  )
  // Each column's way in, under it (and under the shown offer on phones). None for the user's own column.
  const actions: Record<OfferId, ReactNode> = {
    free: null,
    client:
      offer === 'free' ? (
        <ButtonLink href="/wallet/swissquote" variant="secondary" size="sm" className="max-sm:h-11">
          Link your account
        </ButtonLink>
      ) : null,
    premium:
      offer === 'free' ? (
        <span className="text-xs text-muted">For Swissquote clients who linked this wallet</span>
      ) : offer === 'client' ? (
        level === 1 ? (
          subscribe
        ) : (
          <span className="text-xs text-muted">First, shorten the lock-out to {EVICTION_DAYS[1]} days, above</span>
        )
      ) : null,
  }

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <PageHeader title="Offers" description="What each offer does for your Account. Basic security is free in all of them." />
        <YourOffer
          offer={offer}
          level={level}
          hasAccount={!!wallet.account}
          hasKey={!!keyOwner}
          subscription={data?.subscription ?? null}
          failed={failed && !!link.linked && !data}
          busy={busy}
          error={error}
          headingRef={heading}
          onAct={act}
          onRetry={() => {
            setFailed(false)
            setAttempt((a) => a + 1)
          }}
        />
      </div>

      <OffersTable rows={rows} same={same} current={offer} actions={actions} loadingBound={loadingBound} />
      <OffersOnPhone rows={rows} same={same} current={offer} shown={shown ?? offer ?? 'free'} onShow={setShown} actions={actions} loadingBound={loadingBound} />

      <div className="space-y-2">
        <p className="text-sm text-muted">Everyone gets the full security. Premium is faster, insured, with someone to call.</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <Badge tone="warning">MOCK</Badge>
          Subscribing and ordering a key take no payment and ship nothing in this prototype. Prices are to model, and the insurance needs a
          licensed partner, still to be chosen.
        </p>
      </div>
    </div>
  )
}

// ── The user's offer and its next step ───────────────────────────────────────

function YourOffer({
  offer,
  level,
  hasAccount,
  hasKey,
  subscription,
  failed,
  busy,
  error,
  headingRef,
  onAct,
  onRetry,
}: {
  offer: OfferId | null
  level: Level | null
  hasAccount: boolean
  hasKey: boolean
  subscription: Subscription | null
  failed: boolean
  busy: OfferAction | null
  error: string | null
  headingRef: Ref<HTMLHeadingElement>
  onAct: (action: OfferAction) => void
  onRetry: () => void
}) {
  if (failed) {
    return (
      <section className="rounded-2xl border border-border p-5 sm:p-6">
        <h2 className="font-medium">Couldn’t load your offer</h2>
        <p className="mt-1 text-sm text-muted">The comparison below still holds. Nothing changed on your Account.</p>
        <Button variant="secondary" size="sm" className="mt-4 max-sm:h-11" onClick={onRetry}>
          Try again
        </Button>
      </section>
    )
  }
  if (offer === null || level === null) return <Skeleton className="h-32 rounded-2xl sm:h-28" />

  const demo = levelDemoNote()
  const ordered = subscription?.keyOrderedAt ?? null
  const pending = busy !== null

  let text: ReactNode
  let next: ReactNode
  // What the MOCK action does not do, as a caption under it.
  let mock: string | null = null
  if (!hasAccount) {
    text = 'This wallet has no Account yet. Protect it first: a Recovery Kit and a daily limit you choose, free in every offer.'
    next = <ButtonLink href="/wallet/welcome/protect">Protect your wallet</ButtonLink>
  } else if (offer === 'free') {
    text =
      level === 1
        ? 'Link this wallet to your Swissquote account for an @handle, one-tap transfers and all network fees covered.'
        : `Linking is free for Swissquote clients: an @handle, one-tap transfers and all network fees covered. Then, with your Kit, add Swissquote's identity check and a stolen phone is locked out after ${EVICTION_DAYS[1]} days instead of ${EVICTION_DAYS[0]}${demo}. Swissquote never becomes an owner.`
    next = <ButtonLink href="/wallet/swissquote">Link your Swissquote account</ButtonLink>
  } else if (offer === 'client' && level === 0) {
    text = `Your Account still locks a stolen phone out after ${EVICTION_DAYS[0]} days${demo}. As a client, shorten it to ${EVICTION_DAYS[1]} days with your Kit: Swissquote checks your identity first and never becomes an owner.`
    next = <ButtonLink href="/wallet/security?change=level">Shorten the lock-out to {EVICTION_DAYS[1]} days</ButtonLink>
  } else if (offer === 'client') {
    text = hasKey
      ? 'Your security key is already an owner. Premium adds an insured worst case and a priority hotline. Your basic security stays the same.'
      : 'Premium adds a security key shipped and set up for you, an insured worst case and a priority hotline. Your basic security stays the same.'
    next = (
      <Button disabled={pending} onClick={() => onAct('subscribe')}>
        {busy === 'subscribe' ? 'Subscribing…' : 'Subscribe to Premium'}
      </Button>
    )
    mock = 'No payment in this prototype.'
  } else if (hasKey) {
    text =
      'Your security key is an owner of your Account: with your Kit, it locks a stolen phone out at once. Act before the next daily reset and you lose at most one day of your limit.'
    next = null
  } else if (!ordered) {
    text =
      'You subscribed to Theft protection. Your security key is included: order it, then add it as a third owner of your Account when it arrives. Until then, your Account works as before.'
    next = (
      <Button disabled={pending} onClick={() => onAct('order-key')}>
        {busy === 'order-key' ? 'Ordering…' : 'Order my security key'}
      </Button>
    )
    mock = 'Nothing ships in this prototype.'
  } else {
    const day = formatDay(ordered)
    const when = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : `on ${day}`
    const delay = demoDelay(level)
    text = `Your security key was ordered ${when}. When it arrives, add it as a third owner of your Account: until then, a stolen phone is locked out after ${EVICTION_DAYS[level]} days${delay ? ` (${delay})` : ''}.`
    next = (
      <ButtonLink href="/wallet/security?change=key" variant="secondary">
        Add a security key
      </ButtonLink>
    )
    mock = 'Nothing ships in this prototype.'
  }

  return (
    <section aria-labelledby="your-offer" className="rounded-2xl border border-border p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="your-offer" ref={headingRef} tabIndex={-1} className="font-semibold outline-none">
              Your offer: {OFFERS[offer].name}
            </h2>
            {/* Mono only for data: the onchain level is a token, "Not protected yet" is words. */}
            {hasAccount ? <span className="token text-muted">Level {level} · onchain</span> : <span className="text-sm text-muted">Not protected yet</span>}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted">{text}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 max-sm:[&>*]:w-full">
            {next}
            {offer === 'premium' && (
              <Button variant="ghost" size="sm" className="max-sm:h-11" disabled={pending} onClick={() => onAct('end')}>
                {busy === 'end' ? 'Ending…' : 'End Premium'}
              </Button>
            )}
          </div>
          {mock && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Badge tone="warning">MOCK</Badge>
              {mock}
            </p>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <Alert tone="danger" title="Nothing changed">
            {error}
          </Alert>
        </div>
      )}
    </section>
  )
}

// ── The comparison: a table from 640px ───────────────────────────────────────

/** The user's column: an ink outline, the card-in-action rule (DESIGN.md), drawn cell by cell. */
const outline = (current: OfferId | null, id: OfferId, part: 'top' | 'middle' | 'bottom') => {
  if (current !== id) return ''
  if (part === 'top') return 'rounded-t-2xl border-x border-t border-x-foreground border-t-foreground'
  if (part === 'bottom') return 'rounded-b-2xl border-x border-b border-x-foreground border-b-foreground'
  return 'border-x border-x-foreground'
}

function OffersTable({
  rows,
  same,
  current,
  actions,
  loadingBound,
}: {
  rows: Row[]
  same: Row[]
  current: OfferId | null
  actions: Record<OfferId, ReactNode>
  loadingBound: boolean
}) {
  const body = (row: Row) => (
    <tr key={row.id}>
      <th scope="row" className="border-b border-b-border py-4 pr-6 text-left align-top font-normal">
        <RowLabel row={row} />
      </th>
      {OFFER_IDS.map((id) => (
        // h-px lets the worst-case tiles fill the row (a percentage height inside a table cell).
        <td key={id} className={`border-b border-b-border px-4 py-4 align-top ${row.cells[id].bound ? 'h-px' : ''} ${outline(current, id, 'middle')}`}>
          <CellContent cell={row.cells[id]} loading={loadingBound} fill />
        </td>
      ))}
    </tr>
  )
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm max-sm:hidden">
      <caption className="sr-only">What each offer does{current ? `. Your offer is ${OFFERS[current].name}.` : ''}</caption>
      <colgroup>
        <col className="w-[24%]" />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <td className="border-b border-b-border" />
          {OFFER_IDS.map((id) => (
            <th key={id} scope="col" className={`border-b border-b-border px-4 pb-5 pt-4 text-left align-top font-normal ${outline(current, id, 'top')}`}>
              <OfferHead id={id} current={current === id} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map(body)}</tbody>
      <tbody>
        <tr>
          <th scope="rowgroup" className="border-b border-b-border pb-3 pt-8 text-left align-bottom font-semibold">
            Same in every offer
          </th>
          {OFFER_IDS.map((id) => (
            <td key={id} className={`border-b border-b-border ${outline(current, id, 'middle')}`} />
          ))}
        </tr>
        {same.map(body)}
      </tbody>
      <tfoot>
        <tr>
          <td />
          {OFFER_IDS.map((id) => (
            <td key={id} className={`px-4 pb-5 pt-4 align-top ${outline(current, id, 'bottom')}`}>
              {actions[id]}
            </td>
          ))}
        </tr>
      </tfoot>
    </table>
  )
}

function OfferHead({ id, current, large = false }: { id: OfferId; current: boolean; large?: boolean }) {
  const offer = OFFERS[id]
  return (
    <>
      <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className={`font-semibold tracking-tight ${large ? 'text-xl' : 'text-lg'}`}>{offer.name}</span>
        {current && <Badge tone="accent">Your offer</Badge>}
      </span>
      <span className="mt-0.5 block text-xs text-muted">
        {offer.who} · <span className="whitespace-nowrap">level {offer.level}</span>
      </span>
      <span className="mt-2 block text-sm font-medium">{offer.price}</span>
    </>
  )
}

function RowLabel({ row }: { row: Row }) {
  return (
    <>
      <span className="block font-medium">{row.label}</span>
      {row.detail && <span className="mt-0.5 block text-xs text-muted">{row.detail}</span>}
      {row.link && <RowLink {...row.link} />}
    </>
  )
}

/** An Ember Ink link inside a row; 44px tall on phones without moving the line (negative margins). */
function RowLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-accent-ink underline-offset-4 hover:underline max-sm:-my-3 max-sm:min-h-11 max-sm:text-sm"
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  )
}

function CellContent({ cell, loading, roomy = false, fill = false }: { cell: Cell; loading: boolean; roomy?: boolean; fill?: boolean }) {
  if (cell.bound) return <BoundTile bound={cell.bound} loading={loading} fill={fill} />
  const line = roomy ? 'text-sm' : 'text-xs'
  return (
    <>
      {cell.none ? (
        <>
          <span aria-hidden className="text-muted">
            —
          </span>
          <span className="sr-only">None</span>
        </>
      ) : (
        <span className="block font-medium">{cell.value}</span>
      )}
      {cell.lines?.map(
        (text, i) =>
          text && (
            <span key={i} className={`mt-0.5 block text-muted ${line}`}>
              {text}
            </span>
          ),
      )}
    </>
  )
}

/**
 * The worst case on the Apricot Field (the Loss Bound Truth Rule: exact, two decimals), with the
 * loss bound's day squares at 12px: "now", then one per daily reset until the lock-out.
 */
function BoundTile({ bound, loading, fill }: { bound: Bound; loading: boolean; fill: boolean }) {
  const figure = bound.amount !== null ? formatUsdc(bound.amount) : null
  // Step a long figure down before it would clip in a narrow column.
  const fit = figure && figure.length > 9 ? 'text-base' : figure && figure.length > 6 ? 'text-xl' : 'text-xl lg:text-2xl'
  return (
    <div className={`rounded-2xl bg-accent-soft p-3 lg:p-4 ${fill ? 'h-full' : ''}`}>
      <p className={`flex flex-wrap items-baseline gap-x-1.5 font-mono font-semibold tabular-nums tracking-tight [overflow-wrap:anywhere] ${fit}`}>
        {figure !== null ? (
          <>
            {figure} <span className="font-sans text-sm font-normal tracking-normal">USDC</span>
          </>
        ) : loading ? (
          <>
            <span aria-hidden>…</span>
            <span className="sr-only">Loading</span>
          </>
        ) : (
          <>
            {bound.resets + 1} × <span className="font-sans text-sm font-normal tracking-normal">your daily limit</span>
          </>
        )}
      </p>
      <span className="mt-2 flex flex-wrap gap-1" aria-hidden>
        {Array.from({ length: bound.resets + 1 }, (_, i) => (
          <span key={i} className={`h-3 w-3 rounded-[3px] ${i === 0 ? 'bg-accent' : 'bg-accent/45'}`} />
        ))}
      </span>
      {bound.notes.map((note, i) => (
        <span key={i} className={`block text-xs text-foreground/75 ${i === 0 ? 'mt-2' : 'mt-0.5'}`}>
          {note}
        </span>
      ))}
    </div>
  )
}

// ── Phones: one offer at a time ──────────────────────────────────────────────

function OffersOnPhone({
  rows,
  same,
  current,
  shown,
  onShow,
  actions,
  loadingBound,
}: {
  rows: Row[]
  same: Row[]
  current: OfferId | null
  shown: OfferId
  onShow: (id: OfferId) => void
  actions: Record<OfferId, ReactNode>
  loadingBound: boolean
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  // Arrow keys, Home and End move between the offers (a tablist with automatic activation).
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const keys: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: OFFER_IDS.length - 1 }
    if (!(event.key in keys)) return
    event.preventDefault()
    const next = (keys[event.key] + OFFER_IDS.length) % OFFER_IDS.length
    onShow(OFFER_IDS[next])
    tabs.current[next]?.focus()
  }
  const list = (items: Row[]) =>
    items.map((row) => (
      <div key={row.id} className="border-b border-border py-3">
        <dt className="text-sm text-muted">
          {row.label}
          {row.detail && <span className="block text-xs">{row.detail}</span>}
        </dt>
        <dd className="mt-1">
          <CellContent cell={row.cells[shown]} loading={loadingBound} roomy />
          {row.link && <RowLink {...row.link} />}
        </dd>
      </div>
    ))

  return (
    <div className="space-y-4 sm:hidden">
      <div role="tablist" aria-label="Offers" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1">
        {OFFER_IDS.map((id, index) => {
          const selected = shown === id
          return (
            <button
              key={id}
              ref={(node) => {
                tabs.current[index] = node
              }}
              id={`offer-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="offer-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onShow(id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`h-11 rounded-lg text-sm transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.97] ${
                selected ? 'bg-surface-2 font-semibold text-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              {OFFERS[id].name}
              {current === id && <span className="sr-only">, your offer</span>}
            </button>
          )
        })}
      </div>

      <section
        id="offer-panel"
        role="tabpanel"
        aria-labelledby={`offer-tab-${shown}`}
        className={`rounded-2xl border p-5 ${current === shown ? 'border-foreground' : 'border-border'}`}
      >
        <OfferHead id={shown} current={current === shown} large />
        <dl className="mt-4 border-t border-border">{list(rows)}</dl>
        <h3 className="mt-6 text-sm font-semibold">Same in every offer</h3>
        <dl className="mt-2 border-t border-border">{list(same)}</dl>
        {actions[shown] && <div className="mt-5 [&_a]:w-full [&_button]:w-full">{actions[shown]}</div>}
      </section>
    </div>
  )
}

// ── The conversion trigger on Send's receipt ─────────────────────────────────

/**
 * The one conversion trigger (PDR-019, #22): after the first payment that needed the Kit on this device,
 * a quiet line under Send's receipt for linked clients who are not Premium and hold no key. Nothing
 * shows until all are known; once shown, it stays for this receipt and never comes back for this Account.
 */
export function OffersHint() {
  const { wallet, chain } = useLoadedWallet()
  const link = useSwissquoteLink(wallet)
  const clientId = link.linked?.clientId ?? null
  const account = wallet.account ?? wallet.address
  const { keyOwner, checked } = useOwnerKinds(chain.account ?? { owners: [] }, wallet.address)
  const [firstTime] = useState(() => !offersHintSeen(account))
  const [premium, setPremium] = useState<{ clientId: string; value: boolean } | null>(null)
  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    getOfferStatus(clientId)
      .then((status) => !cancelled && setPremium({ clientId, value: status.subscription !== null }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [clientId])
  const show = firstTime && checked && !keyOwner && !!clientId && premium?.clientId === clientId && !premium.value
  useEffect(() => {
    if (show) markOffersHintSeen(account)
  }, [show, account])
  if (!show) return null
  return (
    <p className="text-sm text-muted">
      Coming soon: a tap on a security key instead of your passphrase, with your own key or one set up for you with Premium.{' '}
      <Link
        href="/wallet/offers"
        className="inline-flex items-center gap-0.5 font-medium text-accent-ink underline-offset-4 hover:underline max-sm:-my-3 max-sm:min-h-11"
      >
        Offers
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </p>
  )
}
