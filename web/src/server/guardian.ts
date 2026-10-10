import {
  Erc7677Paymaster,
  SafeMultiChainSigAccountV1 as SafeAccount,
  type MetaTransaction,
} from 'abstractionkit'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { BUNDLER_URL, CHAIN_ID, NODE_URL, PAYMASTER_URL } from '@/lib/config'
import { isDeployed } from '@/lib/wallet'

import { store } from './store'

/**
 * Swissquote Guardian (MOCK HSM).
 *
 * In production this key lives in an HSM and only signs after the identity
 * checks pass. Here it comes from SWISSQUOTE_GUARDIAN_PRIVATE_KEY (always set it
 * on Vercel, ADR-020) or is generated once and kept in the store. It must stay
 * stable: wallets register its address as a guardian.
 */
let cachedKey: `0x${string}` | undefined

async function guardianKey(): Promise<`0x${string}`> {
  const fromEnv = process.env.SWISSQUOTE_GUARDIAN_PRIVATE_KEY as `0x${string}` | undefined
  if (fromEnv) return fromEnv
  if (cachedKey) return cachedKey
  // setIfAbsent: two first requests racing still end up with one key.
  await store().setIfAbsent('config', 'guardianKey', generatePrivateKey())
  cachedKey = (await store().get<`0x${string}`>('config', 'guardianKey')) ?? undefined
  if (!cachedKey) throw new Error('Guardian key unavailable')
  return cachedKey
}

export async function guardianAccount() {
  return privateKeyToAccount(await guardianKey())
}

/**
 * Relayer: a Swissquote operations Safe owned by the guardian key. It submits
 * recovery transactions (anyone may call the module with valid guardian
 * signatures) through sponsored UserOps, so there is no ETH to manage.
 */
export async function relayerAddress() {
  return SafeAccount.createAccountAddress([(await guardianAccount()).address])
}

export async function relay(calls: MetaTransaction[]): Promise<string> {
  const owner = await guardianAccount()
  const address = (await relayerAddress()) as `0x${string}`
  const account = (await isDeployed(address))
    ? new SafeAccount(address)
    : SafeAccount.initializeNewAccount([owner.address])

  let userOp = await account.createUserOperation(calls, NODE_URL, BUNDLER_URL)
  userOp = (
    await new Erc7677Paymaster(PAYMASTER_URL).createPaymasterUserOperation(account, userOp, BUNDLER_URL)
  ).userOperation
  userOp.signature = account.signUserOperation(userOp, [await guardianKey()], CHAIN_ID)

  const receipt = await (await account.sendUserOperation(userOp, BUNDLER_URL)).included()
  if (!receipt) throw new Error('Relayer: timed out waiting for inclusion')
  if (!receipt.success) throw new Error('Relayer: transaction reverted')
  return receipt.receipt.transactionHash
}
