'use client'

import { Gauge, ShieldCheck, Smartphone, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { formatUnits, parseUnits, type Address } from 'viem'

import { useWallet } from '@/components/providers/WalletProvider'
import { Button } from '@/components/ui/button'
import { Alert, Badge, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
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
import { errorMessage, formatUsdcShort } from '@/lib/format'
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
    <div className="space-y-6">
      <Field
        label="Daily limit"
        htmlFor="daily-limit"
        error={limitError}
        hint="Resets every day at 00:00 UTC. You can change it later with your Kit."
      >
        <div className="relative">
          <Input
            id="daily-limit"
            inputMode="decimal"
            value={limit}
            onChange={(e) => setLimit(e.target.value.replace(',', '.'))}
            className="h-14 pr-20 text-2xl font-semibold tabular-nums"
            autoComplete="off"
          />
          <span className="absolute right-2 top-2 rounded-lg bg-surface-2 px-2.5 py-2 text-sm font-medium">USDC</span>
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
              className={`h-9 rounded-full border px-3.5 text-sm tabular-nums transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.97] ${
                selected
                  ? 'border-accent bg-accent-soft font-medium text-accent'
                  : 'border-border bg-surface text-foreground hover:bg-surface-2'
              }`}
            >
              {Number(preset).toLocaleString('en-US')}
              {preset === SUGGESTED && <span className="ml-1 text-xs text-muted">· suggested</span>}
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl bg-surface-2 p-4 sm:p-5">
        <p className="text-sm text-muted">If your phone is stolen, a thief can take at most about</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
          {valid ? formatUsdcShort(dailyLimit * BigInt(days)) : '–'} <span className="text-lg text-muted">USDC</span>
        </p>
        <p className="mt-1 text-sm text-muted">
          {valid ? formatUsdcShort(dailyLimit) : '–'} a day × {days} days, until your Kit locks them out
          {level === 1 ? ' with a Swissquote identity check.' : '.'}
        </p>
        {EVICTION_DELAY_IS_DEMO && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <Badge tone="warning">Demo</Badge>
            On this testnet the lock-out takes {Math.round(EVICTION_DELAY_SECONDS[level] / 60)} minutes.
          </p>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <p className="text-sm font-medium">Face ID will approve</p>
        <ul className="space-y-2.5 text-sm">
          <ReviewRow icon={<ShieldCheck className="h-4 w-4" />}>
            Your Account: this phone and your Kit, both needed for anything above the limit
          </ReviewRow>
          <ReviewRow icon={<Gauge className="h-4 w-4" />}>
            Up to {valid ? formatUsdcShort(dailyLimit) : '–'} USDC a day with Face ID alone
          </ReviewRow>
          <ReviewRow icon={<Smartphone className="h-4 w-4" />}>
            {level === 1
              ? `A new phone with your Kit and a Swissquote identity check, after ${days} days`
              : `A new phone with your Kit alone, after ${days} days`}
          </ReviewRow>
          <ReviewRow icon={<Sparkles className="h-4 w-4" />}>Network fee covered by Swissquote</ReviewRow>
        </ul>
        {level === 0 && (
          <p className="text-xs text-muted">Swissquote client? Link your account later to shorten the delay to 3 days.</p>
        )}
      </div>

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
    </div>
  )
}

function ReviewRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
      <span>{children}</span>
    </li>
  )
}

function parseLimit(value: string): bigint | null {
  if (!value || !/^\d*\.?\d*$/.test(value)) return null
  try {
    return parseUnits(value, USDC_DECIMALS)
  } catch {
    return null
  }
}
