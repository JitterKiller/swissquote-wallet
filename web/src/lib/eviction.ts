import type { MetaTransaction } from 'abstractionkit'
import type { Address, Hex } from 'viem'

import {
  cancelEvictionCall,
  evictionNewOwners,
  evictionTypedData,
  handoverCall,
  readAccount,
  twoFactorCall,
  type AccountState,
  type KitSigner,
} from './account'
import { api } from './api'

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

/** This phone was replaced: the Account no longer lists its Key Safe as an owner. */
export const isEvicted = (state: AccountState | null, keySafe: Address) =>
  !!state?.deployed && !state.owners.some((o) => o.toLowerCase() === keySafe.toLowerCase())
