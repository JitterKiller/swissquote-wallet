import type { MetaTransaction } from 'abstractionkit'
import type { Address } from 'viem'

import {
  allowanceTransferCall,
  setDailyLimitCall,
  tokenTransferCall,
  twoFactorCall,
  type AccountState,
  type KeyApprover,
  type KitSigner,
  type SecondFactor,
} from './account'
import { toPublicKey, type StoredWallet } from './storage'
import { sendCalls, type SendStep } from './wallet'

/**
 * Spending from the Account (PDR-014, ADR-017, issue #12). Tokens leave the Account, never the phone:
 *  - within the daily allowance: Face ID alone (Allowance Module, the Key Safe is the delegate);
 *  - above it: Face ID + the Kit (one 2-factor Account transaction).
 * Both are one sponsored Key Safe UserOp.
 */

export type SpendRoute = 'limit' | 'kit' | 'insufficient'

export type AccountWallet = StoredWallet & { account: Address }

/** Which factors a payment of `amount` needs today. */
export function spendRoute(account: Pick<AccountState, 'allowance'> | null, balance: bigint | null, amount: bigint): SpendRoute {
  if (balance !== null && amount > balance) return 'insufficient'
  return amount <= (account?.allowance?.remaining ?? 0n) ? 'limit' : 'kit'
}

export function limitSpendCalls(params: {
  account: Address
  keySafe: Address
  to: Address
  amount: bigint
  token?: Address
}): MetaTransaction[] {
  return [allowanceTransferCall(params)]
}

/** Above the limit: Face ID + the Kit, or Face ID + the security key (ADR-043). */
export async function kitSpendCalls(
  params: { account: Address; keySafe: Address; to: Address; amount: bigint; token?: Address } & SecondFactor,
): Promise<MetaTransaction[]> {
  const { account, keySafe, to, amount, token } = params
  const call = tokenTransferCall({ to, amount, token })
  return [await twoFactorCall(params.key ? { account, keySafe, call, key: params.key } : { account, keySafe, call, kit: params.kit })]
}

/** Funds that reached the phone's Key Safe (before the Account existed) moved to the Account. */
export function sweepToAccountCalls(account: Address, amount: bigint): MetaTransaction[] {
  return [{ ...tokenTransferCall({ to: account, amount }), value: 0n }]
}

/** Send `amount` USDC from the Account: Face ID alone, or Face ID + the unlocked Kit owner key or the security key. */
export async function spend(params: {
  wallet: AccountWallet
  to: Address
  amount: bigint
  kit?: KitSigner
  key?: KeyApprover
  onStep?: (step: SendStep) => void
}) {
  const { wallet, to, amount, kit, key, onStep } = params
  const base = { account: wallet.account, keySafe: wallet.address, to, amount }
  const calls = key ? await kitSpendCalls({ ...base, key }) : kit ? await kitSpendCalls({ ...base, kit }) : limitSpendCalls(base)
  return sendCalls({ address: wallet.address, credentialId: wallet.credentialId, publicKey: toPublicKey(wallet), calls, onStep })
}

/** New daily limit (PDR-020, issue #13): phone + Kit (or phone + key, ADR-043), from the Key Safe. */
export async function limitChangeCalls(
  params: { account: Address; keySafe: Address; dailyLimit: bigint; token?: Address } & SecondFactor,
): Promise<MetaTransaction[]> {
  const { account, keySafe, dailyLimit, token } = params
  const call = setDailyLimitCall({ keySafe, dailyLimit, token })
  return [await twoFactorCall(params.key ? { account, keySafe, call, key: params.key } : { account, keySafe, call, kit: params.kit })]
}
