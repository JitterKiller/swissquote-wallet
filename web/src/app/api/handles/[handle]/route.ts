import { connection } from 'next/server'

import { HandleError, resolveHandle } from '@/server/handles'

/**
 * Resolve one exact handle → Account + masked verified name (PDR-010). Only linked clients;
 * MOCK auth: `?clientId=` stands in for the e-banking session.
 */
export async function GET(request: Request, ctx: RouteContext<'/api/handles/[handle]'>) {
  await connection()
  const { handle } = await ctx.params
  try {
    const clientId = new URL(request.url).searchParams.get('clientId') ?? undefined
    return Response.json(await resolveHandle(clientId, decodeURIComponent(handle)))
  } catch (error) {
    if (!(error instanceof HandleError)) console.error(error)
    const status = error instanceof HandleError ? error.status : 500
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status })
  }
}
