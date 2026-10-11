'use client'

import { ArrowUpRight, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import type { Address } from 'viem'

import { formatDuration, nextReset } from '@/components/account/AllowanceMeter'
import { LossBound, lossBound } from '@/components/account/LossBound'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { Button, ButtonLink } from '@/components/ui/button'
import { FactorSquare, type Factor } from '@/components/ui/factor'
import { Badge, Skeleton } from '@/components/ui/feedback'
import { useBlockNumber } from '@/components/ui/live'
import { PageHeader } from '@/components/ui/page'
import { Plate } from '@/components/ui/plate'
import type { AccountState } from '@/lib/account'
import { api } from '@/lib/api'
import { EVICTION_DAYS, EVICTION_DELAY_IS_DEMO, EVICTION_DELAY_SECONDS, EXPLORER_URL, RECOVERY_DELAY_LABEL, type Level } from '@/lib/config'
import { evictionLevel, getPendingEviction } from '@/lib/eviction'
import { formatDelay, formatUsdc, shortAddress } from '@/lib/format'
import { useNow } from '@/lib/hooks'
import { kitAddresses } from '@/lib/recoveryKit'
import { loadLocalKit } from '@/lib/storage'

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

type SwissquoteKeys = { status: 'loading' } | { status: 'error' } | { status: 'ok'; guardian: Address; treasury: Address }

/** Swissquote's own addresses (guardian key, treasury): the level comes from them, and they must not be owners. */
function useSwissquoteKeys() {
  const [keys, setKeys] = useState<SwissquoteKeys>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    api<{ guardian: Address; relayer: Address }>('/api/guardian')
      .then(({ guardian, relayer }) => !cancelled && setKeys({ status: 'ok', guardian, treasury: relayer }))
      .catch(() => !cancelled && setKeys({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [attempt])
  const retry = () => {
    setKeys({ status: 'loading' })
    setAttempt((a) => a + 1)
  }
  return { keys, retry }
}

/**
 * Security (#26, ADR-034, surface brief web-src-components-views-securityview-tsx): a proof, not a
 * settings list. The Account's owners as the chain reports them, "Swissquote · not an owner", the
 * worst case as an amount, then who can do what (PDR-013, PDR-014, PDR-018). Nothing here is signed:
 * the limit change (#13), the security key (#17) and the level upgrade (#21) are marked "Soon".
 */
export function SecurityView() {
  const { wallet, chain } = useLoadedWallet()
  const { keys, retry } = useSwissquoteKeys()
  const state = wallet.account ? chain.account : null
  // The level the chain enforces: level 1 when Swissquote's guardian guards the lock-out (as the eviction API reads it).
  const level: Level = state
    ? keys.status === 'ok'
      ? evictionLevel(state, keys.guardian)
      : state.guardians.length > 1
        ? 1
        : 0
    : 0
  const limit = state?.allowance?.amount ?? null

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <PageHeader title="Security" description="Who can move your money, read live onchain." />
        {!wallet.account ? (
          <LegacyRecovery keys={keys} />
        ) : !state ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <OwnersPlate account={wallet.account} state={state} level={level} keys={keys} onRetry={retry} />
            <LossBound limit={limit} level={level} roomy />
          </div>
        )}
      </div>

      {state && (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
          <PowersMatrix limit={limit} level={level} />
          <Scenarios limit={limit} level={level} />
        </div>
      )}

      {state ? (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10">
          <AccountRules state={state} level={level} />
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
  onRetry,
}: {
  account: Address
  state: AccountState
  level: Level
  keys: SwissquoteKeys
  onRetry: () => void
}) {
  const { wallet } = useLoadedWallet()
  const { live } = useBlockNumber()
  const now = useNow()
  const [localKit] = useState(() => loadLocalKit())

  const keySafe = wallet.address
  const others = state.owners.filter((o) => !same(o, keySafe))
  const fromKit = localKit ? kitAddresses(localKit).owner : null
  // The protect flow creates the Account with [Key Safe, Kit owner]: without a local Kit copy, the other owner is the Kit.
  const kitOwner = others.find((o) => same(o, fromKit)) ?? (others.length === 1 ? others[0] : null)
  const unknown = others.filter((o) => !same(o, kitOwner))
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
      seal={false}
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
        <li className="flex items-center gap-3 border-t border-hero-2 py-3">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 ring-1 ring-inset ring-hero-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-hero-muted">Security key</span>
            <span className="block text-xs text-hero-muted">A third owner you keep at home</span>
          </span>
          <Badge tone="hero">Soon</Badge>
        </li>
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

const PARTIES = ['Phone', 'Kit', 'Swissquote'] as const

/** One answer in the matrix: who acts (factor squares), in a few words; `span: 2` when the phone and the Kit act together. */
type Cell = { factors: Factor[]; text: string; spoken: string; span?: 2 }

const NEVER: Cell = { factors: [], text: 'never', spoken: 'never' }
const NOT_NEEDED: Cell = { factors: [], text: '—', spoken: 'not needed' }
const TOGETHER: Cell = { factors: ['phone', 'kit'], text: 'together', spoken: 'yes, the phone and the Kit together', span: 2 }

/** Powers × parties (PDR-014): what each one can do, enforced by the Account's contracts. A table from 640px, a list on phones. */
function PowersMatrix({ limit, level }: { limit: bigint | null; level: Level }) {
  const days = EVICTION_DAYS[level]
  const rows: { power: string; detail?: string; cells: Cell[] }[] = [
    {
      power: `Spend up to ${limit !== null ? formatUsdc(limit) : '…'} USDC a day`,
      cells: [{ factors: ['phone'], text: 'alone', spoken: 'yes, Face ID alone' }, NOT_NEEDED, NEVER],
    },
    { power: 'Pay more, swap, lend, change a rule', cells: [TOGETHER, NEVER] },
    {
      power: 'Lock out a lost or stolen phone',
      detail: `After ${days} days${demoDelay(level)}`,
      cells:
        level === 1
          ? [NOT_NEEDED, { factors: ['kit'], text: 'starts it', spoken: 'starts it' }, { factors: [], text: 'checks ID', spoken: 'checks your identity first' }]
          : [NOT_NEEDED, { factors: ['kit'], text: 'alone', spoken: 'yes, alone' }, NOT_NEEDED],
    },
    { power: 'Stop a lock-out', cells: [TOGETHER, NEVER] },
  ]
  // Each cell's party, for the phone list: a cell spanning two columns is "Phone + Kit".
  const withParties = (cells: Cell[]) => {
    let column = 0
    return cells.map((cell) => {
      const party = cell.span === 2 ? 'Phone + Kit' : PARTIES[column]
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
        Swissquote holds no owner key, so it cannot move or take your money, and nobody can raise your limit without your Kit.
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
function Scenarios({ limit, level }: { limit: bigint | null; level: Level }) {
  const days = EVICTION_DAYS[level]
  const bound = limit !== null ? formatUsdc(lossBound(limit, level)) : '…'
  const items: { title: string; body: ReactNode }[] = [
    {
      title: 'Your phone is stolen, unlocked',
      body: (
        <>
          The thief can take at most <span className="font-mono tabular-nums text-foreground">{bound}</span> USDC, then your Kit locks the phone
          out. They cannot stop it.
        </>
      ),
    },
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

function AccountRules({ state, level }: { state: AccountState; level: Level }) {
  const now = useNow(30_000)
  const allowance = state.allowance
  const days = EVICTION_DAYS[level]
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
          action="Change"
        />
        <RuleRow
          name="Lock-out delay"
          value={`${days} days${demoDelay(level)}`}
          detail={
            level === 1
              ? 'Level 1: your Kit and a Swissquote identity check.'
              : 'Level 0: your Kit alone. Linked clients: 3 days, your Kit plus a Swissquote identity check.'
          }
          action={level === 0 ? 'Upgrade to level 1' : null}
        />
        <RuleRow
          name="Security key"
          value="None"
          detail="A third owner you keep at home. With your Kit, it locks a stolen phone out at once."
          action="Add a key"
        />
      </ul>
    </section>
  )
}

function RuleRow({ name, value, detail, action }: { name: string; value: ReactNode; detail?: ReactNode; action: string | null }) {
  return (
    <li className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm text-muted">{name}</p>
        <p className="mt-0.5 font-medium">{value}</p>
        {detail && <p className="mt-0.5 text-sm text-muted">{detail}</p>}
      </div>
      {action && (
        <span className="flex shrink-0 items-center gap-2">
          <Badge>Soon</Badge>
          <Button variant="secondary" size="sm" disabled>
            {action}
          </Button>
        </span>
      )}
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
                router.replace('/welcome')
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
          <ButtonLink href="/welcome/protect" className="mt-4">
            Create your Account
          </ButtonLink>
          <p className="mt-2 text-xs text-muted">Adds a daily limit and a lock-out the thief cannot cancel.</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">If you lose this phone, you lose this wallet. Protect it with a Recovery Kit and a daily limit.</p>
          <ButtonLink href="/welcome/protect" className="mt-4">
            Protect your wallet
          </ButtonLink>
        </>
      )}
    </section>
  )
}
