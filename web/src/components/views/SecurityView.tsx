'use client'

import { ArrowUpRight, FastForward, TriangleAlert } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import type { Address } from 'viem'

import { formatDuration, nextReset } from '@/components/account/AllowanceMeter'
import { KitTest } from '@/components/account/KitTest'
import { LevelUpgrade } from '@/components/account/LevelUpgrade'
import { LimitChange } from '@/components/account/LimitChange'
import { SecurityKeyAdd } from '@/components/account/SecurityKeyAdd'
import { daysUntilKitTest, kitTestDue, kitTestedLabel, skipKitTestInterval, useKitTestedAt } from '@/components/account/useKitTest'
import { useOwnerKinds } from '@/components/account/useOwnerKinds'
import { LossBound, lossBound } from '@/components/account/LossBound'
import { chainLevel, useSwissquoteKeys, type SwissquoteKeys } from '@/components/account/useSwissquoteKeys'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { Button, ButtonLink } from '@/components/ui/button'
import { FactorSquare, type Factor } from '@/components/ui/factor'
import { Badge, Skeleton } from '@/components/ui/feedback'
import { useBlockNumber } from '@/components/ui/live'
import { PageHeader } from '@/components/ui/page'
import { Plate } from '@/components/ui/plate'
import type { AccountState } from '@/lib/account'
import { EVICTION_DAYS, EVICTION_DELAY_IS_DEMO, EVICTION_DELAY_SECONDS, EXPLORER_URL, RECOVERY_DELAY_LABEL, type Level } from '@/lib/config'
import { getPendingEviction } from '@/lib/eviction'
import { formatDelay, formatUsdc, shortAddress } from '@/lib/format'
import { useNow } from '@/lib/hooks'

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/** "(3 min in this demo)" while the testnet delays are on. */
const demoDelay = (level: Level) => (EVICTION_DELAY_IS_DEMO ? ` (${Math.round(EVICTION_DELAY_SECONDS[level] / 60)} min in this demo)` : '')

/** A placeholder that says what it is to a screen reader. */
const Loading = () => (
  <>
    <span aria-hidden>…</span>
    <span className="sr-only">Loading</span>
  </>
)

/**
 * Security (#26, ADR-034, surface brief web-src-components-views-securityview-tsx): a proof, not a
 * settings list. The Account's owners as the chain reports them, "Swissquote · not an owner", the
 * worst case as an amount, then who can do what (PDR-013, PDR-014, PDR-018). Two rules change here,
 * each in a panel under its row: the daily limit (#13, ADR-035), the level (#21, ADR-036) and the
 * security key (#17, ADR-038).
 */
export function SecurityView() {
  const { wallet, chain } = useLoadedWallet()
  const { keys, retry } = useSwissquoteKeys()
  const state = wallet.account ? chain.account : null
  // The level the chain enforces: level 1 when Swissquote's guardian guards the lock-out (as the eviction API reads it).
  const level: Level = state ? chainLevel(state, keys) : 0
  const limit = state?.allowance?.amount ?? null
  // Who is who among the owners (#17): the security key changes the worst case and the lock-out.
  const kinds = useOwnerKinds(state ?? { owners: [] }, wallet.address)
  const hasKey = !!kinds.keyOwner

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <PageHeader title="Security" description="Who can move your money, read live onchain." />
        {!wallet.account ? (
          <LegacyRecovery keys={keys} />
        ) : !state ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <OwnersPlate account={wallet.account} state={state} level={level} keys={keys} kinds={kinds} onRetry={retry} />
            <LossBound limit={limit} level={level} withKey={hasKey} roomy />
          </div>
        )}
      </div>

      {state && (
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
          <PowersMatrix limit={limit} level={level} hasKey={hasKey} />
          <Scenarios limit={limit} level={level} hasKey={hasKey} />
        </div>
      )}

      {state ? (
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
          {/* useSearchParams: kept inside a Suspense boundary for prerendering (Next docs). */}
          <Suspense fallback={null}>
            <AccountRules state={state} level={level} keys={keys} keyOwner={kinds.keyOwner} onRetryKeys={retry} />
          </Suspense>
          <div className="space-y-8">
            <ThisPhone />
            <ForgetWallet />
          </div>
        </div>
      ) : (
        <div className="max-w-2xl space-y-8">
          <ThisPhone />
          <ForgetWallet />
        </div>
      )}
    </div>
  )
}

// ── The owners, live ─────────────────────────────────────────────────────────

function OwnersPlate({
  account,
  state,
  level,
  keys,
  kinds,
  onRetry,
}: {
  account: Address
  state: AccountState
  level: Level
  keys: SwissquoteKeys
  kinds: ReturnType<typeof useOwnerKinds>
  onRetry: () => void
}) {
  const { wallet } = useLoadedWallet()
  const { live } = useBlockNumber()
  const now = useNow()

  const keySafe = wallet.address
  const { kitOwner, keyOwner, unknown } = kinds
  const pending = getPendingEviction(state, keySafe)
  const lockOutIn = pending ? Math.max(0, pending.executeAfter - Math.floor(now / 1000)) : null
  const verdict =
    keys.status === 'ok'
      ? state.owners.some((o) => same(o, keys.guardian) || same(o, keys.treasury))
        ? 'owner'
        : 'not-owner'
      : keys.status

  return (
    <Plate
     
      title={
        <span className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 ${live ? 'bg-success' : 'bg-hero-muted'}`} aria-hidden />
          Owners of your Account · live onchain
        </span>
      }
    >
      <ul>
        <OwnerRow factor="phone" name="This phone" role="Face ID · its Key Safe" address={keySafe}>
          {lockOutIn !== null && (
            <span className="mt-1 block font-medium text-hero-fg">
              Being locked out · <span className="font-mono tabular-nums">{formatDelay(lockOutIn)}</span> left
            </span>
          )}
        </OwnerRow>
        <OwnerRow factor="kit" name="Recovery Kit" role="Your passphrase · its owner key" address={kitOwner} />
        {unknown.map((owner) => (
          <OwnerRow key={owner} factor={null} name="Another owner" role="Not added by this app" address={owner} />
        ))}
        {keyOwner ? (
          <OwnerRow factor="key" name="Security key" role="Kept at home · with your Kit, locks a lost phone out as soon as you act" address={keyOwner} />
        ) : (
          <li className="flex items-center gap-3 border-t border-hero-2 py-3">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 ring-[1.5px] ring-inset ring-accent/40" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-hero-muted">Security key</span>
              <span className="block text-xs text-hero-muted">A third owner you keep at home</span>
            </span>
            <span className="token text-hero-muted">Not added</span>
          </li>
        )}
      </ul>

      <div className="flex flex-col gap-0.5 border-t border-hero-2 py-3 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <span className="text-hero-muted">Above your daily limit</span>
        <span className="font-medium sm:text-right">
          <span className="font-mono tabular-nums">
            {state.threshold} of {state.owners.length}
          </span>{' '}
          needed · {unknown.length ? 'check the owners' : state.owners.length === 2 ? 'both yours' : 'all yours'}
        </span>
      </div>

      <div className="border-t border-hero-2 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-sm font-medium">Swissquote</span>
          <span aria-live="polite" className="text-xl font-semibold tracking-tight">
            {verdict === 'not-owner' ? 'Not an owner' : verdict === 'owner' ? 'Listed as an owner' : verdict === 'error' ? 'Not checked' : <Loading />}
          </span>
        </div>
        {verdict === 'not-owner' && keys.status === 'ok' && (
          <p className="mt-1 text-sm text-hero-muted">
            {level === 1 ? 'Checks your identity before a lock-out, and cannot start one alone.' : 'Pays your network fees.'} Its keys (
            <span className="font-mono">{shortAddress(keys.guardian)}</span>, <span className="font-mono">{shortAddress(keys.treasury)}</span>) are not
            among the owners: it can never move your money.
          </p>
        )}
        {verdict === 'owner' && (
          <p className="mt-1 flex gap-2 text-sm font-medium text-hero-fg">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />A Swissquote key is among this Account’s owners. This app never
            sets that up: don’t keep money here, and contact support.
          </p>
        )}
        {verdict === 'error' && (
          <p className="mt-1 text-sm text-hero-muted">
            Couldn’t load Swissquote’s keys to compare.{' '}
            <button type="button" onClick={onRetry} className="font-medium text-hero-fg underline underline-offset-4">
              Try again
            </button>
          </p>
        )}
        <a
          href={`${EXPLORER_URL}/address/${account}#readProxyContract`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-hero-fg underline-offset-4 hover:underline"
        >
          Verify the owners on Basescan <ArrowUpRight className="h-3.5 w-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </Plate>
  )
}

function OwnerRow({
  factor,
  name,
  role,
  address,
  children,
}: {
  factor: Factor | null
  name: string
  role: string
  address: Address | null
  children?: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 border-t border-hero-2 py-3 first:border-t-0 first:pt-0">
      {factor ? <FactorSquare factor={factor} tone="hero" /> : <span aria-hidden className="h-2.5 w-2.5 shrink-0 bg-hero-muted" />}
      <span className="min-w-0 flex-1 text-xs text-hero-muted">
        <span className="block text-sm font-medium text-hero-fg">{name}</span>
        {role}
        {children}
      </span>
      {address ? (
        <AddressPill address={address} tone="hero" />
      ) : (
        <span className="token text-hero-muted">
          <Loading />
        </span>
      )}
    </li>
  )
}

// ── Who can do what ──────────────────────────────────────────────────────────

/**
 * One answer in the matrix: who acts (factor squares), in a few words. `span` covers the factors that act
 * together, and `party` names them in the phone list ("Phone + Kit", "Any two").
 */
type Cell = { factors: Factor[]; text: string; spoken: string; span?: 2 | 3; party?: string }

const NEVER: Cell = { factors: [], text: 'never', spoken: 'never' }
const NOT_NEEDED: Cell = { factors: [], text: '—', spoken: 'not needed' }
const TOGETHER: Cell = { factors: ['phone', 'kit'], text: 'together', spoken: 'yes, the phone and the Kit together', span: 2, party: 'Phone + Kit' }
// With a security key the Account has three owners and still needs two: any two of them act together.
const ANY_TWO: Cell = {
  factors: ['phone', 'kit', 'key'],
  text: 'any two',
  spoken: 'yes, any two of the phone, the Kit and the key',
  span: 3,
  party: 'Phone, Kit, key:',
}

/** Powers × parties (PDR-014): what each one can do, enforced by the Account's contracts. A table from 640px, a list on phones. */
function PowersMatrix({ limit, level, hasKey }: { limit: bigint | null; level: Level; hasKey: boolean }) {
  const days = EVICTION_DAYS[level]
  const parties = hasKey ? ['Phone', 'Kit', 'Key', 'Swissquote'] : ['Phone', 'Kit', 'Swissquote']
  const kitLockOut: Cell =
    level === 1 ? { factors: ['kit'], text: 'starts it', spoken: 'starts it' } : { factors: ['kit'], text: 'alone', spoken: 'yes, alone' }
  const swissquoteLockOut: Cell = level === 1 ? { factors: [], text: 'checks ID', spoken: 'checks your identity first' } : NOT_NEEDED
  const rows: { power: string; detail?: string; cells: Cell[] }[] = [
    {
      power: `Spend up to ${limit !== null ? formatUsdc(limit) : '…'} USDC a day`,
      cells: [{ factors: ['phone'], text: 'alone', spoken: 'yes, Face ID alone' }, NOT_NEEDED, ...(hasKey ? [NOT_NEEDED] : []), NEVER],
    },
    { power: 'Pay more, swap, lend, change a rule', cells: [hasKey ? ANY_TWO : TOGETHER, NEVER] },
    {
      power: 'Lock out a lost or stolen phone',
      detail: hasKey
        ? `After ${days} days${demoDelay(level)} with the Kit, or as soon as you act with the Kit and the key`
        : `After ${days} days${demoDelay(level)}`,
      cells: hasKey
        ? [NOT_NEEDED, kitLockOut, { factors: ['key'], text: '+ Kit, at once', spoken: 'with the Kit, at once' }, swissquoteLockOut]
        : [NOT_NEEDED, kitLockOut, swissquoteLockOut],
    },
    { power: 'Stop a lock-out', cells: [hasKey ? ANY_TWO : TOGETHER, NEVER] },
  ]
  // Each cell's party, for the phone list: a cell spanning columns names the factors acting together.
  const withParties = (cells: Cell[]) => {
    let column = 0
    return cells.map((cell) => {
      const party = cell.party ?? parties[column]
      column += cell.span ?? 1
      return { cell, party }
    })
  }

  return (
    <section aria-labelledby="powers-title">
      <h2 id="powers-title" className="text-lg font-semibold tracking-tight">
        Who can do what
      </h2>
      <p className="mt-1 text-sm text-muted">Enforced by your Account’s contracts onchain, not by a promise.</p>

      <table className="mt-4 w-full border-collapse text-sm max-sm:hidden">
        <caption className="sr-only">Who can do what with your Account</caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="py-2 pr-3 font-normal">
              <span className="sr-only">Power</span>
            </th>
            <PartyHeader factor="phone">Phone</PartyHeader>
            <PartyHeader factor="kit">Kit</PartyHeader>
            {hasKey && <PartyHeader factor="key">Key</PartyHeader>}
            <PartyHeader factor={null}>Swissquote</PartyHeader>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.power} className="border-b border-border">
              <th scope="row" className="py-3 pr-3 text-left align-top font-normal">
                {row.power}
                {row.detail && <span className="mt-0.5 block text-xs text-muted">{row.detail}</span>}
              </th>
              {row.cells.map((cell, i) => (
                <td key={i} colSpan={cell.span} className="px-2 py-3 align-top">
                  <CellText cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="mt-4 border-t border-border sm:hidden">
        {rows.map((row) => (
          <li key={row.power} className="border-b border-border py-3">
            <p className="text-sm font-medium">{row.power}</p>
            {row.detail && <p className="text-xs text-muted">{row.detail}</p>}
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {withParties(row.cells)
                .filter(({ cell }) => cell !== NOT_NEEDED)
                .map(({ cell, party }) => (
                  <span key={party} className={`inline-flex items-center gap-1.5 ${cell.factors.length ? '' : 'text-muted'}`}>
                    {cell.factors.map((f) => (
                      <FactorSquare key={f} factor={f} size="sm" />
                    ))}
                    {party} {cell.text}
                  </span>
                ))}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm text-muted">
        {hasKey
          ? 'Swissquote holds no owner key, so it cannot move or take your money. Any two of your three factors act together: keep them in three places, the phone in your pocket, the key at home, the passphrase in your head.'
          : 'Swissquote holds no owner key, so it cannot move or take your money, and nobody can raise your limit without your Kit.'}
      </p>
    </section>
  )
}

function PartyHeader({ factor, children }: { factor: Factor | null; children: ReactNode }) {
  return (
    <th scope="col" className="px-2 py-2 font-medium">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {factor && <FactorSquare factor={factor} size="sm" />}
        {children}
      </span>
    </th>
  )
}

function CellText({ cell }: { cell: Cell }) {
  return (
    <>
      <span aria-hidden className={`inline-flex items-center gap-1.5 whitespace-nowrap ${cell.factors.length ? '' : 'text-muted'}`}>
        {cell.factors.length > 0 && (
          <span className="inline-flex gap-1">
            {cell.factors.map((f) => (
              <FactorSquare key={f} factor={f} size="sm" />
            ))}
          </span>
        )}
        {cell.text}
      </span>
      <span className="sr-only">{cell.spoken}</span>
    </>
  )
}

/** The threat model in four lines, with the worst case as an amount. */
function Scenarios({ limit, level, hasKey }: { limit: bigint | null; level: Level; hasKey: boolean }) {
  const days = EVICTION_DAYS[level]
  const bound = limit !== null ? formatUsdc(hasKey ? limit : lossBound(limit, level)) : '…'
  const items: { title: string; body: ReactNode }[] = [
    {
      title: 'Your phone is stolen, unlocked',
      body: hasKey ? (
        <>
          From a new device, your Kit and your security key lock the phone out as soon as you act: the thief takes at most{' '}
          <span className="font-mono tabular-nums text-foreground">{bound}</span> USDC if you act before the next daily reset, and each reset
          adds one more day of your limit. They cannot stop it.
        </>
      ) : (
        <>
          The thief can take at most <span className="font-mono tabular-nums text-foreground">{bound}</span> USDC, then your Kit locks the phone
          out. They cannot stop it.
        </>
      ),
    },
    ...(hasKey
      ? [
          {
            title: 'Someone takes your phone and your key',
            body: 'Together they are two of your three factors: they could move everything. Keep the key at home, apart from the phone, and the passphrase in your head.',
          },
        ]
      : []),
    {
      title: 'You lose your phone',
      body: `On a new phone, “Phone lost or stolen?” with your Kit. Same Account, same money, after ${days} days${demoDelay(level)}.`,
    },
    {
      title: 'Someone gets your Kit',
      body:
        level === 1
          ? 'Useless without your passphrase. With it, Swissquote’s identity check still stops a lock-out.'
          : 'Useless without your passphrase. With it, they can only start a lock-out: you get an alert and stop it with Face ID and your Kit.',
    },
    {
      title: 'Swissquote is hacked or closes',
      body:
        level === 1
          ? 'Nothing moves, and you keep paying. Locking out a lost phone needs Swissquote’s check; if Swissquote closes, the app first moves you back to the 7-day lock-out with your Kit alone.'
          : 'Nothing moves. Swissquote is not an owner, and your phone and Kit keep working without it.',
    },
  ]
  return (
    <section aria-labelledby="scenarios-title">
      <h2 id="scenarios-title" className="text-lg font-semibold tracking-tight">
        If something goes wrong
      </h2>
      <ul className="mt-4 border-t border-border">
        {items.map((item) => (
          <li key={item.title} className="border-b border-border py-3">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 text-sm text-muted">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Rules (limit, lock-out delay, security key) ──────────────────────────────

type RulePanel = 'limit' | 'level' | 'key' | 'kit'

function AccountRules({
  state,
  level,
  keys,
  keyOwner,
  onRetryKeys,
}: {
  state: AccountState
  level: Level
  keys: SwissquoteKeys
  keyOwner: Address | null
  onRetryKeys: () => void
}) {
  const now = useNow(30_000)
  const allowance = state.allowance
  const days = EVICTION_DAYS[level]
  // "Change" beside the Overview's Face ID meter (?change=limit) and the level call on /swissquote
  // (?change=level) land here with that panel open. The router's search params, not window.location:
  // on a client navigation the URL updates after this renders.
  const searchParams = useSearchParams()
  const router = useRouter()
  const asked = searchParams.get('change')
  // ?change=level only means something at level 0 (a reload or a back after the upgrade must not reopen it).
  const wanted: RulePanel | null =
    asked === 'limit' || asked === 'kit' || (asked === 'level' && level === 0) || (asked === 'key' && !keyOwner) ? (asked as RulePanel) : null
  const [open, setOpen] = useState<RulePanel | null>(wanted)
  const [done, setDone] = useState(false)
  // Next keeps this page alive while hidden (Activity): follow the link's ?change= on each visit.
  const [seen, setSeen] = useState(asked)
  if (asked !== seen) {
    setSeen(asked)
    if (wanted) {
      setOpen(wanted)
      setDone(false)
    }
  }
  // Closing a panel (Cancel, Done) gives focus back to the control that opened it.
  const limitOpener = useRef<HTMLButtonElement>(null)
  const levelOpener = useRef<HTMLButtonElement>(null)
  const keyOpener = useRef<HTMLButtonElement>(null)
  const kitOpener = useRef<HTMLButtonElement>(null)
  const last = useRef<RulePanel | null>(null)
  // The Recovery Kit row (#9): when this device last opened the Kit file with its passphrase.
  const kitTestedAt = useKitTestedAt()
  const kitDue = kitTestDue(kitTestedAt, now)
  useEffect(() => {
    if (open === null && last.current) ({ limit: limitOpener, level: levelOpener, key: keyOpener, kit: kitOpener })[last.current].current?.focus()
    last.current = open
  }, [open])
  // A panel is a transient task: close it when the page is hidden, so coming back never shows a stale
  // form or receipt (a link with ?change= reopens it). Next's guide on preserving UI state.
  useLayoutEffect(
    () => () => {
      last.current = null
      setOpen(null)
      setSeen(null)
    },
    [],
  )

  const close = () => {
    setOpen(null)
    // Drop ?change= so a reload doesn't reopen a finished task.
    if (asked) router.replace('/wallet/security', { scroll: false })
  }
  const openPanel = (panel: RulePanel) => {
    setDone(false)
    setOpen(panel)
  }

  return (
    <section aria-labelledby="rules-title">
      <h2 id="rules-title" className="text-lg font-semibold tracking-tight">
        Rules of your Account
      </h2>
      <p className="mt-1 text-sm text-muted">Changing any of them takes Face ID and your Kit.</p>
      <ul className="mt-4 border-t border-border">
        <RuleRow
          name="Daily limit"
          value={
            <>
              <span className="font-mono tabular-nums">{allowance ? formatUsdc(allowance.amount) : '…'}</span> USDC a day
            </>
          }
          detail={
            allowance && (
              <>
                <span className="font-mono tabular-nums">{formatUsdc(allowance.spent)}</span> spent today · resets in{' '}
                {formatDuration(nextReset(allowance.resetsAt, now) - now)}
              </>
            )
          }
          control={
            <RuleControl
              ref={limitOpener}
              label="Change"
              open={open === 'limit'}
              done={done}
              disabled={!allowance}
              onOpen={() => openPanel('limit')}
              onCancel={close}
            />
          }
          panel={open === 'limit' && <LimitChange state={state} level={level} onClose={close} onChanged={() => setDone(true)} />}
        />
        <RuleRow
          name="Lock-out delay"
          value={`${days} days${demoDelay(level)}`}
          detail={
            level === 1
              ? 'Level 1: your Kit and a Swissquote identity check.'
              : 'Level 0: your Kit alone. Linked clients: 3 days, your Kit plus a Swissquote identity check.'
          }
          // At level 1 the row keeps the panel only to show its receipt.
          control={
            level === 0 || open === 'level' ? (
              <RuleControl
                ref={levelOpener}
                label="Upgrade to level 1"
                open={open === 'level'}
                done={done}
                onOpen={() => openPanel('level')}
                onCancel={close}
              />
            ) : null
          }
          panel={open === 'level' && <LevelUpgrade state={state} keys={keys} onRetryKeys={onRetryKeys} onClose={close} onChanged={() => setDone(true)} />}
        />
        <RuleRow
          name="Security key"
          value={keyOwner ? 'Added' : 'None'}
          detail={
            keyOwner ? (
              <>
                A third owner, kept at home. With your Kit, it locks a stolen phone out at once.
                <span className="mt-1.5 flex">
                  <AddressPill address={keyOwner} />
                </span>
              </>
            ) : (
              'A third owner you keep at home. With your Kit, it locks a stolen phone out at once.'
            )
          }
          control={
            !keyOwner || open === 'key' ? (
              <RuleControl ref={keyOpener} label="Add a key" open={open === 'key'} done={done} onOpen={() => openPanel('key')} onCancel={close} />
            ) : null
          }
          panel={open === 'key' && <SecurityKeyAdd state={state} level={level} onClose={close} onChanged={() => setDone(true)} />}
        />
        <RuleRow
          name="Recovery Kit"
          value={
            kitDue ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                {kitTestedLabel(kitTestedAt, now)} <Badge tone="warning">Due</Badge>
              </span>
            ) : (
              kitTestedLabel(kitTestedAt, now)
            )
          }
          detail={
            kitDue || kitTestedAt === null ? (
              'Check that you still have the file and its passphrase, before you need them.'
            ) : (
              <>
                Next test in {daysUntilKitTest(kitTestedAt, now)} days: the file from your cloud drive, with its passphrase.
                {open !== 'kit' && (
                  <span className="mt-1 flex">
                    <Button variant="ghost" size="sm" className="-ml-3 max-sm:h-11" onClick={() => skipKitTestInterval(kitTestedAt)}>
                      <FastForward className="h-4 w-4" /> Demo: skip 90 days
                    </Button>
                  </span>
                )}
              </>
            )
          }
          control={<RuleControl ref={kitOpener} label="Test" open={open === 'kit'} done={done} onOpen={() => openPanel('kit')} onCancel={close} />}
          panel={open === 'kit' && <KitTest onClose={close} onTested={() => setDone(true)} />}
        />
      </ul>
    </section>
  )
}

/** A rule's control: the opener, or "Cancel" while its panel is open (hidden once the receipt shows). */
function RuleControl({
  ref,
  label,
  open,
  done,
  disabled = false,
  onOpen,
  onCancel,
}: {
  ref: Ref<HTMLButtonElement>
  label: string
  open: boolean
  done: boolean
  disabled?: boolean
  onOpen: () => void
  onCancel: () => void
}) {
  if (open) {
    return done ? null : (
      <Button variant="secondary" size="sm" className="max-sm:h-11" onClick={onCancel}>
        Cancel
      </Button>
    )
  }
  return (
    <Button ref={ref} variant="secondary" size="sm" className="max-sm:h-11" disabled={disabled} onClick={onOpen}>
      {label}
    </Button>
  )
}

/** A rule: its value, then either a working control (and the panel it opens) or a "Soon" slot. */
function RuleRow({
  name,
  value,
  detail,
  action,
  control,
  panel,
}: {
  name: string
  value: ReactNode
  detail?: ReactNode
  action?: string | null
  control?: ReactNode
  panel?: ReactNode
}) {
  return (
    <li className="scroll-mt-20 border-b border-border py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-sm text-muted">{name}</p>
          <p className="mt-0.5 font-medium">{value}</p>
          {detail && <p className="mt-0.5 text-sm text-muted">{detail}</p>}
        </div>
        {control ? (
          <span className="shrink-0">{control}</span>
        ) : (
          action && (
            <span className="flex shrink-0 items-center gap-2">
              <Badge>Soon</Badge>
              <Button variant="secondary" size="sm" disabled>
                {action}
              </Button>
            </span>
          )
        )}
      </div>
      {panel && <div className="mt-4">{panel}</div>}
    </li>
  )
}

// ── This phone, and forgetting it ────────────────────────────────────────────

function ThisPhone() {
  const { wallet, chain } = useLoadedWallet()
  const state = wallet.account ? chain.account : null
  const owner = state ? state.owners.some((o) => same(o, wallet.address)) : null
  const lockOut = state ? getPendingEviction(state, wallet.address) : null
  return (
    <section aria-labelledby="phone-title">
      <h2 id="phone-title" className="text-lg font-semibold tracking-tight">
        This phone
      </h2>
      <dl className="mt-4 border-t border-border text-sm">
        <PhoneRow label="Passkey">{wallet.name}</PhoneRow>
        <PhoneRow label="Stored in">This device’s secure hardware</PhoneRow>
        <PhoneRow label="Credential">
          <span className="font-mono text-xs">{shortAddress(wallet.credentialId)}</span>
        </PhoneRow>
        {!wallet.account && (
          <PhoneRow label="Wallet">
            <AddressPill address={wallet.address} />
          </PhoneRow>
        )}
        <PhoneRow label="Status">
          {wallet.account ? (
            owner === null ? (
              <span className="text-muted">
                <Loading />
              </span>
            ) : lockOut ? (
              <Badge tone="danger">Being locked out</Badge>
            ) : owner ? (
              <Badge tone="success">Owner of your Account</Badge>
            ) : (
              <Badge tone="danger">No longer an owner</Badge>
            )
          ) : chain.deployed === null ? (
            <span className="text-muted">
              <Loading />
            </span>
          ) : chain.deployed ? (
            <Badge tone="success">Active onchain</Badge>
          ) : (
            <Badge>Activates with the first transaction</Badge>
          )}
        </PhoneRow>
      </dl>
    </section>
  )
}

function PhoneRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

function ForgetWallet() {
  const { wallet, forget } = useLoadedWallet()
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  return (
    <section aria-labelledby="forget-title" className="rounded-2xl border border-danger/30 p-5">
      <h2 id="forget-title" className="font-semibold">
        Forget this wallet on this device
      </h2>
      <p className="mt-1 text-sm text-muted">
        {wallet.account
          ? 'Removes it and the encrypted copy of your Kit from this browser. Your money stays in your Account; to use it here again, you go through “Phone lost or stolen?” with your Kit file and wait the lock-out delay.'
          : 'Removes it from this browser. Your money stays onchain; to use it here again, you need your Recovery Kit and Swissquote’s identity check.'}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {confirming ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                forget()
                router.replace('/wallet/welcome')
              }}
            >
              Forget this wallet
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Forget…
          </Button>
        )}
      </div>
    </section>
  )
}

// ── Wallets protected before the Account (legacy Key Safe recovery, until #33) ─

function LegacyRecovery({ keys }: { keys: SwissquoteKeys }) {
  const { chain } = useLoadedWallet()
  const status = chain.recovery
  const swissquoteGuardian = keys.status === 'ok' ? keys.guardian : null
  const protectedWallet = !!status && status.guardians.length > 0

  return (
    <section aria-labelledby="legacy-title" className="max-w-2xl">
      <h2 id="legacy-title" className="text-lg font-semibold tracking-tight">
        Recovery
      </h2>
      {status === null ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : protectedWallet ? (
        <>
          <p className="mt-1 text-sm text-muted">This wallet was protected before Accounts: your Kit and Swissquote can move it to a new phone.</p>
          <ul className="mt-4 border-t border-border">
            {status.guardians.map((g) => {
              const isSwissquote = same(g, swissquoteGuardian)
              return (
                <li key={g} className="flex items-center gap-3 border-b border-border py-3">
                  {isSwissquote ? <span aria-hidden className="h-2.5 w-2.5 shrink-0" /> : <FactorSquare factor="kit" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{isSwissquote ? 'Swissquote' : 'Recovery Kit'}</span>
                    <span className="block text-xs text-muted">{isSwissquote ? 'Signs only after an identity check' : 'Kept by you'}</span>
                  </span>
                  <AddressPill address={g} />
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-sm text-muted">
            {status.threshold} of {status.guardians.length} approvals, then {RECOVERY_DELAY_LABEL} during which you can cancel from this device.
          </p>
          <ButtonLink href="/wallet/welcome/protect" className="mt-4">
            Create your Account
          </ButtonLink>
          <p className="mt-2 text-xs text-muted">Adds a daily limit and a lock-out the thief cannot cancel.</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">If you lose this phone, you lose this wallet. Protect it with a Recovery Kit and a daily limit.</p>
          <ButtonLink href="/wallet/welcome/protect" className="mt-4">
            Protect your wallet
          </ButtonLink>
        </>
      )}
    </section>
  )
}
