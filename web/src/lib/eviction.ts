import type { MetaTransaction } from 'abstractionkit'
import type { Address, Hex } from 'viem'

import {
  accountExecCall,
  cancelEvictionCall,
  encodeSafeSignatures,
  evictionNewOwners,
  evictionTypedData,
  handoverCall,
  readAccount,
  senderSignature,
  twoFactorCall,
  type AccountState,
  type KitSigner,
} from './account'
import { api } from './api'
import { errorChain } from './format'
import { publicClient } from './wallet'

/**
 * "Phone lost or stolen?" (PDR-018, PDR-021, ADR-019, issues #15 and #16).
 *
 * New device: the Kit guardian key signs "replace the old phone by this one", the backend relays it
 * (Swissquote co-signs at level 1 after an identity check), the delay runs on-chain, then anyone
 * finalizes and the new phone takes over the daily allowance with the Kit (handover).
 * Current device: during the delay, phone + Kit (2 factors) can cancel; a thief holding only the
 * phone cannot (GS020).
 *
 * `post` defaults to the app's API client; scripts pass an absolute-URL client.
 */

type Post = <T>(path: string, body?: unknown) => Promise<T>

export type EvictionLevel = 0 | 1

/** Level 1 when the Swissquote guardian guards this Account: the backend then needs an identity check. */
export function evictionLevel(state: Pick<AccountState, 'guardians'>, swissquoteGuardian: Address): EvictionLevel {
  return state.guardians.some((g) => g.toLowerCase() === swissquoteGuardian.toLowerCase()) ? 1 : 0
}

/** Start the time-locked eviction of `oldKeySafe` in favour of `newKeySafe` (the new phone's Key Safe). */
export async function startEviction(params: {
  account: Address
  oldKeySafe: Address
  newKeySafe: Address
  guardian: KitSigner
  kycSessionId?: string
  post?: Post
  token?: Address
}) {
  const { account, oldKeySafe, newKeySafe, guardian, kycSessionId, post = api, token } = params
  const state = await readAccount(account, { keySafe: oldKeySafe, token })
  if (!state.deployed || !state.evictionModule) throw new Error('This Account has no lock-out set up.')
  if (state.pendingEviction) throw new Error('A lock-out is already in progress for this Account.')
  const newOwners = evictionNewOwners(state.owners, oldKeySafe, newKeySafe)
  const guardianSignature = (await guardian.signTypedData(await evictionTypedData(account, state.evictionModule, newOwners))) as Hex
  const result = await post<{ txHash: string; executeAfter: number; level: EvictionLevel }>('/api/eviction', {
    account,
    newOwners,
    guardianSignature,
    kycSessionId,
  })
  // The old phone's limit, to hand over unchanged to the new phone.
  return { ...result, newOwners, dailyLimit: state.allowance?.amount ?? null }
}

/** After the delay: anyone may finalize; the Swissquote relayer does, so the new phone needs no gas. */
export const finalizeEviction = (account: Address, post: Post = api) =>
  post<{ txHash: string; owners: Address[] }>('/api/eviction/finalize', { account })

/** New phone + Kit: move the daily allowance from the evicted Key Safe to the new one (sent by the new Key Safe). */
export async function handoverCalls(params: {
  account: Address
  oldKeySafe: Address
  newKeySafe: Address
  dailyLimit: bigint
  kit: KitSigner
  token?: Address
}): Promise<MetaTransaction[]> {
  const { account, oldKeySafe, newKeySafe, dailyLimit, kit, token } = params
  return [await twoFactorCall({ account, keySafe: newKeySafe, call: handoverCall({ oldKeySafe, newKeySafe, dailyLimit, token }), kit })]
}

/** Current phone + Kit: cancel a pending eviction (sent by the current Key Safe). */
export async function cancelEvictionCalls(params: {
  account: Address
  keySafe: Address
  evictionModule: Address
  kit: KitSigner
}): Promise<MetaTransaction[]> {
  const { account, keySafe, evictionModule, kit } = params
  return [await twoFactorCall({ account, keySafe, call: cancelEvictionCall(evictionModule), kit })]
}

/**
 * Demo (#16): what a thief holding only the phone would send to cancel, the Account transaction with
 * the Key Safe's approval alone. The Account needs 2 signatures, so it refuses (Safe error GS020).
 */
export function thiefCancelCalls(params: { account: Address; keySafe: Address; evictionModule: Address }): MetaTransaction[] {
  const { account, keySafe, evictionModule } = params
  return [accountExecCall(account, cancelEvictionCall(evictionModule), encodeSafeSignatures([senderSignature(keySafe)]))]
}

/**
 * Why the Account refuses `call` when `from` sends it alone: the Safe's revert reason (e.g. "GS020"),
 * read with eth_call. The bundler only reports "execution reverted" without the inner reason.
 */
export async function safeRevertReason(from: Address, call: MetaTransaction): Promise<string | null> {
  try {
    await publicClient.call({ account: from, to: call.to as Address, data: call.data as Hex })
    return null
  } catch (error) {
    return /GS0\d\d/.exec(errorChain(error))?.[0] ?? null
  }
}

/** The pending eviction that would lock THIS phone out (its Key Safe is not among the new owners), if any (#16). */
export function getPendingEviction(state: AccountState | null, keySafe: Address) {
  const pending = state?.pendingEviction
  if (!pending || pending.newOwners.some((o) => o.toLowerCase() === keySafe.toLowerCase())) return null
  return pending
}

/** This phone was replaced: the Account no longer lists its Key Safe as an owner. */
export const isEvicted = (state: AccountState | null, keySafe: Address) =>
  !!state?.deployed && !state.owners.some((o) => o.toLowerCase() === keySafe.toLowerCase())
