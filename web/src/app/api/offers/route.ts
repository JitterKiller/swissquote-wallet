import { connection } from 'next/server'

import type { OfferAction } from '@/lib/offers'
import { OfferError, changeOffer, getOfferStatus } from '@/server/offers'

/**
 * MOCK Premium "Theft protection" (PDR-019, ADR-039): the caller's subscription (GET), then
 * subscribe, order the security key or end it (POST). No payment, nothing ships. MOCK auth:
 * the client id comes from the request, as for the other Swissquote endpoints.
 */
export async function GET(request: Request) {
  await connection()
  return run(() => getOfferStatus(new URL(request.url).searchParams.get('clientId') ?? undefined))
}

export async function POST(request: Request) {
  return run(async () => changeOffer((await request.json()) as { clientId?: string; action?: OfferAction }))
}

async function run(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn())
  } catch (error) {
    if (!(error instanceof OfferError)) console.error(error)
    const status = error instanceof OfferError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Offer request failed' }, { status })
  }
}
