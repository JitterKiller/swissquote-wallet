import { isAddress } from 'viem'

import { getRecoveryStatus, recoveryModule } from '@/lib/recovery'
import { relay } from '@/server/guardian'
import { notifyClient } from '@/server/store'

/**
 * Finalize a recovery once the delay is over. The module lets anyone call
 * this; the Swissquote relayer does it so the new device needs no gas.
 */
export async function POST(request: Request) {
  try {
    const { wallet } = (await request.json()) as { wallet?: string }
    if (!wallet || !isAddress(wallet)) {
      return Response.json({ error: 'Invalid wallet address' }, { status: 400 })
    }
    const { pending } = await getRecoveryStatus(wallet)
    if (!pending) return Response.json({ error: 'No pending recovery' }, { status: 409 })
    if (pending.executeAfter > Math.floor(Date.now() / 1000)) {
      return Response.json({ error: 'The recovery delay is not over yet' }, { status: 409 })
    }

    const txHash = await relay([recoveryModule.createFinalizeRecoveryMetaTransaction(wallet)])
    await notifyClient(wallet, 'Your wallet was recovered to a new device. The previous passkey was removed.')
    return Response.json({ txHash })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Finalization failed'
    return Response.json({ error: message }, { status: 500 })
  }
}
