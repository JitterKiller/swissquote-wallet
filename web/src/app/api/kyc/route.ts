import { randomUUID } from 'node:crypto'
import { isAddress } from 'viem'

import { notifyClient, updateDb, type KycSession } from '@/server/store'

/**
 * MOCK identity verification before the Swissquote Guardian signs a recovery.
 *
 * Production: video identification with liveness check against the KYC record
 * (FINMA Circular 2016/7), e-banking login with existing 2FA, optional code
 * sent by post. The verdict comes from the KYC provider server-side; here the
 * demo UI picks the outcome to show both the legitimate and the attacker path.
 */
export async function POST(request: Request) {
  const { wallet, outcome } = (await request.json()) as { wallet?: string; outcome?: string }
  if (!wallet || !isAddress(wallet)) {
    return Response.json({ error: 'Invalid wallet address' }, { status: 400 })
  }

  const session: KycSession = {
    id: randomUUID(),
    wallet: wallet.toLowerCase(),
    status: outcome === 'match' ? 'verified' : 'failed',
    createdAt: Date.now(),
    used: false,
  }
  updateDb((db) => {
    db.kycSessions[session.id] = session
  })

  if (session.status === 'failed') {
    notifyClient(
      wallet,
      'A recovery attempt on your wallet failed identity verification. Your funds are safe.',
    )
  }
  return Response.json({ sessionId: session.id, status: session.status })
}
