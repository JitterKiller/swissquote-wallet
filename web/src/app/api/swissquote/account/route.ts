import { connection } from 'next/server'

import { TransferError, getAccountOverview } from '@/server/swissquoteAccount'

/** MOCK Swissquote account: balance, deposit address, treasury balance (PDR-024). */
export async function GET(request: Request) {
  await connection()
  try {
    return Response.json(await getAccountOverview(new URL(request.url).searchParams.get('clientId') ?? undefined))
  } catch (error) {
    const status = error instanceof TransferError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Request failed' }, { status })
  }
}
