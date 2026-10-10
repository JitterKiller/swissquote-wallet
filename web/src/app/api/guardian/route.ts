import { connection } from 'next/server'

import { guardianAccount, relayerAddress } from '@/server/guardian'

/** Public info: the Swissquote Guardian address wallets register at setup. */
export async function GET() {
  await connection()
  return Response.json({ guardian: (await guardianAccount()).address, relayer: await relayerAddress() })
}
