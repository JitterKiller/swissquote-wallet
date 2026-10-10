import { connection } from 'next/server'

import { HandleError, getMyHandle } from '@/server/handles'

/** The caller's own handle and visibility. MOCK auth (`?clientId=`). */
export async function GET(request: Request) {
  await connection()
  try {
    return Response.json(await getMyHandle(new URL(request.url).searchParams.get('clientId') ?? undefined))
  } catch (error) {
    const status = error instanceof HandleError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status })
  }
}
