'use client'

import { useState } from 'react'
import { formatUnits, parseUnits, type Address } from 'viem'

import { DaySquares } from '@/components/account/DaySquares'
import { useWallet } from '@/components/providers/WalletProvider'
import { Button } from '@/components/ui/button'
import { Alert, Badge, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Plate, PlateRow } from '@/components/ui/plate'
import { accountSetupCalls } from '@/lib/account'
import { api } from '@/lib/api'
import {
  EVICTION_DAYS,
  EVICTION_DELAY_IS_DEMO,
  EVICTION_DELAY_SECONDS,
  SUGGESTED_DAILY_LIMIT,
  USDC_DECIMALS,
  type Level,
} from '@/lib/config'
import { errorMessage, formatUsdc, formatUsdcShort } from '@/lib/format'
import { getRecoveryStatus, recoverySetupCalls } from '@/lib/recovery'
import { kitAccounts, kitAddresses, type KitKeys, type RecoveryKitV3 } from '@/lib/recoveryKit'
import { saveLocalKit, toPublicKey, type StoredWallet } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

const PRESETS = ['100', '250', '500', '1000']
const SUGGESTED = formatUnits(SUGGESTED_DAILY_LIMIT, USDC_DECIMALS)
const MAX_LIMIT = parseUnits('1000000', USDC_DECIMALS)

export type AccountActivation = { account: Address; dailyLimit: bigint; txHash: string }

/**
 * Last step of the protect flow (issue #10, PDR-020, ADR-017): the user picks a daily limit,
 * then one sponsored Key Safe UserOp deploys and configures the Account: owners [Key Safe, Kit
 * owner key], threshold 2, the Allowance Module with this phone as delegate, and the eviction
 * module with the Kit guardian key (+ Swissquote at level 1).
 */
export function AccountSetupStep({
  wallet,
  kit,
  keys,
  level,
  onActivated,
}: {
  wallet: StoredWallet
  kit: RecoveryKitV3
  keys: KitKeys
  level: Level
  onActivated: (result: AccountActivation) => void
}) {
  const { setWallet, refresh } = useWallet()
  const [limit, setLimit] = useState(SUGGESTED)
  const [step, setStep] = useState<SendStep | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dailyLimit = parseLimit(limit)
  const limitError =
    limit && dailyLimit === null
      ? 'Enter a valid amount.'
      : dailyLimit !== null && dailyLimit > MAX_LIMIT
        ? 'Choose at most 1,000,000 USDC.'
        : null
  const valid = dailyLimit !== null && dailyLimit > 0n && !limitError
  const days = EVICTION_DAYS[level]

  async function activate() {
    if (!valid || dailyLimit === null) return
    setError(null)
    try {
      setStep('preparing')
      const accounts = kitAccounts(keys)
      const { owner, guardian } = kitAddresses(kit)
      if (owner !== accounts.owner.address || guardian !== accounts.guardian.address) {
        throw new Error('The Recovery Kit does not match. Start the protection again.')
      }
      const [{ guardian: swissquote }, legacy] = await Promise.all([
        api<{ guardian: Address }>('/api/guardian'),
        getRecoveryStatus(wallet.address),
      ])
      const setup = await accountSetupCalls(
        {
          keySafe: wallet.address,
          kitOwner: owner,
          kitGuardian: guardian,
          dailyLimit,
          level,
          swissquoteGuardian: level === 1 ? swissquote : undefined,
        },
        accounts.owner,
      )
      const { txHash } = await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls: [
          // Transitional (ADR-026): the Key Safe keeps the legacy recovery, with the same Kit
          // guardian key, until the eviction flow replaces it (#15, #33).
          ...(legacy.guardians.length === 0 ? recoverySetupCalls(wallet.address, guardian, swissquote) : []),
          ...setup,
        ],
        onStep: setStep,
      })
      saveLocalKit(kit)
      setWallet({ ...wallet, account: kit.account, level, dailyLimit: dailyLimit.toString() })
      refresh()
      onActivated({ account: kit.account, dailyLimit, txHash })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  return (
    <div className="space-y-5">
      <Field
        label="Daily limit"
        htmlFor="daily-limit"
        error={limitError}
      >
        <div className="relative">
          <Input
            id="daily-limit"
            inputMode="decimal"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(',', '.'))}
            className="h-[60px] border-[1.5px] border-foreground pr-28 font-mono !text-5xl font-semibold tabular-nums tracking-tight"
            autoComplete="off"
          />
          <span className="token pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">USDC / day</span>
        </div>
      </Field>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Suggested limits">
        {PRESETS.map((preset) => {
          const selected = limit === preset
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => setLimit(preset)}
              className={`h-9 rounded-lg border px-3.5 font-mono text-sm tabular-nums transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
                selected
                  ? 'border-transparent bg-accent font-semibold text-accent-fg'
                  : 'border-border bg-surface text-foreground hover:bg-surface-2'
              }`}
            >
              {Number(preset).toLocaleString('en-US')}
              {preset === SUGGESTED && (
                <span className={`ml-1.5 font-sans text-[11px] ${selected ? 'text-accent-fg' : 'text-muted'}`}>suggested</span>
              )}
            </button>
          )
        })}
      </div>

      <section className="rounded-2xl bg-accent-soft p-4" aria-label="Worst case if your phone is stolen">
        <p className="text-sm text-foreground/75">If your phone is stolen, a thief can take at most</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
            {valid ? formatUsdc(dailyLimit * BigInt(days + 1)) : '–'} <span className="font-sans text-lg">USDC</span>
          </p>
          <DaySquares days={days} today />
        </div>
        <p className="mt-2 text-sm text-foreground/75">
          <span className="font-mono tabular-nums">{valid ? formatUsdc(dailyLimit) : '–'}</span> today, then again after each of the{' '}
          {days} daily resets until your Kit locks them out{level === 1 ? ' with a Swissquote identity check.' : '.'}
          {EVICTION_DELAY_IS_DEMO && (
            <span className="ml-2 inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
              <Badge tone="warning">Demo</Badge>
              {Math.round(EVICTION_DELAY_SECONDS[level] / 60)} min on testnet
            </span>
          )}
        </p>
      </section>

      <Plate title="Face ID will approve" className="!mt-16">
        <dl>
          <PlateRow label="Account owners">
            This phone + your Kit · <span className="tabular-nums">2 of 2</span>
          </PlateRow>
          <PlateRow label="Face ID alone">
            Up to <span className="tabular-nums">{valid ? formatUsdcShort(dailyLimit) : '–'}</span> USDC a day
            <span className="block text-xs font-normal text-hero-muted">Resets at 00:00 UTC</span>
          </PlateRow>
          <PlateRow label="New phone">
            {level === 1 ? 'Kit + Swissquote identity check' : 'Kit alone'}, after {days} days
          </PlateRow>
          <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
        </dl>
      </Plate>

      <Button size="lg" className="w-full" disabled={!valid || step !== null} onClick={activate}>
        {step ? (
          <>
            <Spinner /> {SEND_STEP_LABEL[step]}
          </>
        ) : (
          'Activate protection'
        )}
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-center text-xs text-muted">
        You can change your limit later with your Kit.
        {level === 0 && ' Swissquote client? Link your account later to shorten the delay to 3 days.'}
      </p>
    </div>
  )
}

/** One square per day of exposure, the first day fully lit: the bound drawn to scale. */
function parseLimit(value: string): bigint | null {
  if (!value || !/^\d*\.?\d*$/.test(value)) return null
  try {
    return parseUnits(value, USDC_DECIMALS)
  } catch {
    return null
  }
}
