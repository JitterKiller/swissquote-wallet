import { parseUnits, type Address } from 'viem'

import { allowanceTransferCall } from './account'
import { api } from './api'
import { USDC_DECIMALS } from './config'
import { toPublicKey, type StoredWallet } from './storage'
import { sendCalls, usdcTransfer, type SendStep } from './wallet'

/** Transfers between the (MOCK) Swissquote account and the wallet (PDR-024, ADR-025). */

export type AccountOverview = { balance: string; depositAddress: Address; treasury: string }

export const getAccountOverview = (clientId: string) =>
  api<AccountOverview>(`/api/swissquote/account?clientId=${encodeURIComponent(clientId)}`)

/** Swissquote account → wallet: Swissquote sends on-chain USDC to the client's Account. */
export const moveToWallet = (clientId: string, amount: string) =>
  api<{ txHash: string; balance: string }>('/api/swissquote/withdraw', { clientId, amount })

/**
 * Wallet → Swissquote account: Face ID sends USDC to the deposit address (from the Account's daily
 * limit when the wallet has an Account, ADR-017), then Swissquote credits the verified transfer.
 */
export async function moveToSwissquote(params: {
  clientId: string
  wallet: StoredWallet & { account?: Address }
  amount: string
  depositAddress: Address
  onStep?: (step: SendStep) => void
}) {
  const { clientId, wallet, amount, depositAddress, onStep } = params
  const value = parseUnits(amount, USDC_DECIMALS)
  const calls = wallet.account
    ? [allowanceTransferCall({ account: wallet.account, to: depositAddress, amount: value, keySafe: wallet.address })]
    : [usdcTransfer(depositAddress, amount)]
  const { txHash } = await sendCalls({
    address: wallet.address,
    credentialId: wallet.credentialId,
    publicKey: toPublicKey(wallet),
    calls,
    onStep,
  })
  const credit = await api<{ credited: string; balance: string }>('/api/swissquote/deposit', { clientId, txHash })
  return { txHash, ...credit }
}
