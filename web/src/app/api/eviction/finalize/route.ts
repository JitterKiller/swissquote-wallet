import { isAddress } from 'viem'

import { finalizeEvictionCall, readAccount } from '@/lib/account'
import { publicClient } from '@/lib/wallet'
import { relay } from '@/server/guardian'
import { getEviction, notifyClient, saveEviction } from '@/server/store'

/**
 * Finalize an eviction once the on-chain delay is over (ADR-019). The module lets anyone
 * call it; the Swissquote relayer does, so the new phone needs no gas. Always sponsored.
 * The new phone then moves the daily allowance to itself (`handoverCall`, new Key Safe + Kit).
 */
export async function POST(request: Request) {
  try {
    const { account } = (await request.json()) as { account?: string }
    if (!account || !isAddress(account)) return fail('Invalid Account address')

    const state = await readAccount(account)
    if (!state.evictionModule || !state.pendingEviction) return fail('No pending eviction', 409)
    const now = (await publicClient.getBlock()).timestamp
    const executeAfter = BigInt(state.pendingEviction.executeAfter)
    if (executeAfter > now) return fail(`The delay is not over yet (${executeAfter - now} s left)`, 409)

    const finalizeTx = await relay([finalizeEvictionCall(account, state.evictionModule)])
    const record = await getEviction(account)
    if (record) await saveEviction({ ...record, status: 'finalized', finalizeTx })
    await notifyClient(account, 'Your phone was replaced. The old phone is no longer an owner of your Account.')
    return Response.json({ txHash: finalizeTx, owners: (await readAccount(account)).owners })
  } catch (error) {
    console.error(error)
    return fail(error instanceof Error ? error.message : 'Finalization failed', 500)
  }
}

function fail(error: string, status = 400) {
  return Response.json({ error }, { status })
}
