'use client'

import { useState } from 'react'
import type { Address } from 'viem'

import { dailyLimitError, LimitPicker, parseDailyLimit, SUGGESTED_LIMIT } from '@/components/account/LimitPicker'
import { LossBound } from '@/components/account/LossBound'
import { useWallet } from '@/components/providers/WalletProvider'
import { Button } from '@/components/ui/button'
import { FactorLabel } from '@/components/ui/factor'
import { Alert, Spinner } from '@/components/ui/feedback'
import { Plate, PlateRow } from '@/components/ui/plate'
import { accountSetupCalls } from '@/lib/account'
import { api } from '@/lib/api'
import { EVICTION_DAYS, type Level } from '@/lib/config'
import { errorMessage, formatUsdcShort } from '@/lib/format'
import { getRecoveryStatus, recoverySetupCalls } from '@/lib/recovery'
import { kitAccounts, kitAddresses, type KitKeys, type RecoveryKitV3 } from '@/lib/recoveryKit'
import { saveLocalKit, toPublicKey, type StoredWallet } from '@/lib/storage'
import { SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'


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
  const [limit, setLimit] = useState(SUGGESTED_LIMIT)
  const [step, setStep] = useState<SendStep | null>(null)
  const [error, setError] = useState<string | null>(null)

  const dailyLimit = parseDailyLimit(limit)
  const limitError = dailyLimitError(limit, dailyLimit)
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
      <LimitPicker id="daily-limit" label="Daily limit" value={limit} onChange={setLimit} error={limitError} suggested />

      <LossBound limit={valid ? dailyLimit : null} level={level} />

      <Plate title="Face ID will approve">
        <dl>
          <PlateRow label={<FactorLabel factors={['phone', 'kit']} tone="hero">Owners</FactorLabel>}>Only you: this phone and your Kit</PlateRow>
          <PlateRow label={<FactorLabel factors={['phone']} tone="hero">Face ID alone</FactorLabel>}>
            Up to <span className="tabular-nums">{valid ? formatUsdcShort(dailyLimit) : '–'}</span> USDC a day
            <span className="block text-xs font-normal text-hero-muted">Starts again at midnight UTC</span>
          </PlateRow>
          <PlateRow label={<FactorLabel factors={['phone', 'kit']} tone="hero">Above your limit</FactorLabel>}>Face ID and your Kit</PlateRow>
          <PlateRow label={<FactorLabel factors={['kit']} tone="hero">New phone</FactorLabel>}>
            {level === 1 ? 'Your Kit and a Swissquote identity check' : 'Your Kit alone'}, after {days} days
          </PlateRow>
          <PlateRow label={<FactorLabel tone="hero">Network fee</FactorLabel>}>Covered by Swissquote</PlateRow>
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
