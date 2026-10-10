import { randomUUID } from 'node:crypto'
import { connection } from 'next/server'

import { guardianAccount, relayerAddress } from '@/server/guardian'
import { store } from '@/server/store'

/**
 * Deployment check (ADR-020): which store is used, a write/read round trip, and the
 * guardian and relayer addresses. Open it right after a deployment.
 */
export async function GET() {
  await connection()
  try {
    const probe = randomUUID()
    await store().set('health', 'probe', probe)
    const readBack = await store().get<string>('health', 'probe')
    return Response.json({
      ok: readBack === probe,
      store: store().kind,
      guardianFromEnv: Boolean(process.env.SWISSQUOTE_GUARDIAN_PRIVATE_KEY),
      guardian: (await guardianAccount()).address,
      relayer: await relayerAddress(),
    })
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Store unavailable' },
      { status: 500 },
    )
  }
}
