'use client'

import type { MetaTransaction } from 'abstractionkit'
import { CircleCheck, ShieldAlert, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { parseUnits, type Address } from 'viem'

import { Input } from '@/components/ui/field'
import { Spinner } from '@/components/ui/feedback'
import {
  HIGH_VALUE_USDC,
  isLookAlike,
  needsHighValueConfirmation,
  screenRecipient,
  simulateCalls,
  type Screening,
  type Simulation,
} from '@/lib/compliance'
import { USDC_DECIMALS } from '@/lib/config'
import { formatDecimal } from '@/lib/format'
import { cleanAmount, INPUT_DECIMALS } from '@/lib/inputs'

export type ComplianceState = { blocked: boolean; needsConfirmation: boolean; reasons: string[] }

/**
 * Checks shown on the review step, before Face ID (PDR-023, ADR-022; integrated by #12):
 * sanctions screening, simulation with a readable summary, look-alike address warning and a
 * typed confirmation for large payments. Friction only: `blocked` means Swissquote's app will
 * not prepare or sponsor the transfer.
 */
export function ComplianceChecks({
  from,
  to,
  amount,
  balance,
  knownRecipients,
  calls,
  subject = 'payment',
  decimals = USDC_DECIMALS,
  largeAt = HIGH_VALUE_USDC,
  onChange,
}: {
  from: Address
  to: Address | null
  amount: bigint | null
  balance: bigint | null
  knownRecipients: string[]
  calls?: MetaTransaction[]
  /** A payment to a recipient, or an action on an approved dApp's contract (#25). */
  subject?: 'payment' | 'dapp'
  /** The amount's token decimals (a swap from EURC or ETH, ADR-032); USDC by default. */
  decimals?: number
  /** The absolute large-amount threshold in that token, or null for the balance rule only. */
  largeAt?: bigint | null
  onChange: (state: ComplianceState) => void
}) {
  const dapp = subject === 'dapp'
  const party = dapp ? 'Protocol contract' : 'Recipient'
  const key = to && amount ? `${to}:${amount}` : ''
  const [screening, setScreening] = useState<{ key: string; result: Screening | { error: string } } | null>(null)
  const [simulation, setSimulation] = useState<{ key: string; result: Simulation } | null>(null)
  const [typed, setTyped] = useState({ key: '', value: '' })
  const [acknowledged, setAcknowledged] = useState({ key: '', value: false })

  useEffect(() => {
    if (!to) return
    let cancelled = false
    screenRecipient(to)
      .then((result) => !cancelled && setScreening({ key, result }))
      .catch((e) => !cancelled && setScreening({ key, result: { error: e instanceof Error ? e.message : 'Screening failed' } }))
    if (calls?.length) {
      simulateCalls(from, calls).then((result) => !cancelled && setSimulation({ key, result }))
    }
    return () => {
      cancelled = true
    }
    // Calls are rebuilt by the parent on every render: key on recipient and amount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, from])

  const screen = screening?.key === key ? screening.result : null
  const simulated = simulation?.key === key ? simulation.result : null
  const lookAlike = to ? isLookAlike(to, knownRecipients) : null
  const highValue = amount !== null && needsHighValueConfirmation(amount, balance, largeAt)
  // The exact amount, every decimal it has: a Max of 0.499512 is confirmed as 0.499512, not as "0.50".
  const amountText = amount !== null ? formatDecimal(amount, decimals, { round: 'down', group: false }) : ''
  const typedOk = typed.key === key && sameAmount(typed.value, amount, decimals)
  const ackOk = acknowledged.key === key && acknowledged.value

  const sanctioned = !!screen && 'status' in screen && screen.status === 'sanctioned'
  const reasons = [
    sanctioned && `${party} on a sanctions list`,
    simulated && !simulated.ok && `Simulation failed: ${simulated.reason}`,
    lookAlike && 'Recipient looks like a previous counterparty',
    highValue && (dapp ? 'Large amount' : 'Large payment'),
  ].filter(Boolean) as string[]
  const state: ComplianceState = {
    blocked: sanctioned,
    needsConfirmation: !screen || (highValue && !typedOk) || (!!lookAlike && !ackOk),
    reasons,
  }
  const published = JSON.stringify(state)
  useEffect(() => {
    onChange(state)
    // Notify the parent when the outcome changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published])

  if (!to || amount === null) return null

  return (
    <ul className="space-y-2 text-sm">
      <Check
        tone={!screen ? 'pending' : 'error' in screen ? 'warning' : sanctioned ? 'danger' : 'ok'}
        title={
          !screen
            ? `Screening the ${party.toLowerCase()}…`
            : 'error' in screen
              ? `Screening unavailable: ${screen.error}`
              : sanctioned
                ? `${party} is on a sanctions list`
                : `${party} screened: not on sanctions lists`
        }
      >
        {sanctioned &&
          `Swissquote will not prepare or sponsor this ${dapp ? 'action' : 'transfer'}. Contact support if you think this is a mistake.`}
      </Check>

      {calls?.length ? (
        <Check
          tone={!simulated ? 'pending' : simulated.ok ? 'ok' : 'warning'}
          title={
            !simulated
              ? 'Simulating…'
              : simulated.ok
                ? `Simulation: ${dapp ? 'these steps' : 'this transfer'} would succeed`
                : `Simulation failed: ${simulated.reason}`
          }
        >
          {simulated?.summary.map((line) => (
            <span key={line} className="block [overflow-wrap:anywhere] font-mono text-xs">
              {line}
            </span>
          ))}
        </Check>
      ) : null}

      {lookAlike && (
        <Check tone="danger" title="This address looks like one you used before, but it is different">
          <span className="block [overflow-wrap:anywhere] font-mono text-xs">Previous: {lookAlike}</span>
          <span className="block [overflow-wrap:anywhere] font-mono text-xs">This one: {to}</span>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={ackOk} onChange={(e) => setAcknowledged({ key, value: e.target.checked })} />
            I checked every character of this address
          </label>
        </Check>
      )}

      {highValue && (
        <Check tone={typedOk ? 'ok' : 'warning'} title={`Large ${dapp ? 'amount' : 'payment'}: type the amount to confirm`}>
          <Input
            className="mt-2"
            inputMode="decimal"
            aria-label="Type the amount to confirm"
            placeholder={amountText}
            value={typed.key === key ? typed.value : ''}
            onChange={(e) => setTyped({ key, value: cleanAmount(e.target.value, Math.min(decimals, INPUT_DECIMALS)) })}
          />
        </Check>
      )}
    </ul>
  )
}

function Check({ tone, title, children }: { tone: 'ok' | 'warning' | 'danger' | 'pending'; title: string; children?: ReactNode }) {
  const icon = {
    ok: <CircleCheck className="h-4 w-4 text-success" />,
    warning: <TriangleAlert className="h-4 w-4 text-warning" />,
    danger: <ShieldAlert className="h-4 w-4 text-danger" />,
    pending: <Spinner className="h-4 w-4" />,
  }[tone]
  const surface = { ok: 'bg-surface-2', warning: 'bg-warning-soft', danger: 'bg-danger-soft', pending: 'bg-surface-2' }[tone]
  return (
    <li className={`flex gap-3 rounded-xl px-3 py-2.5 ${surface}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="font-medium">{title}</span>
        {children && <span className="mt-1 block text-muted">{children}</span>}
      </span>
    </li>
  )
}

/** The typed confirmation matches the amount, however it is written ("0.5", "0.50"). */
function sameAmount(text: string, amount: bigint | null, decimals: number) {
  if (amount === null || !/^\d*\.?\d+$/.test(text.trim())) return false
  try {
    return parseUnits(text.trim(), decimals) === amount
  } catch {
    return false
  }
}
