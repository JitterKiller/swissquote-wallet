import { screenAddress } from '@/server/compliance'
import { store } from '@/server/store'

/** Sanctions screening of one address (PDR-023, ADR-022). Address only, no personal data. */
export async function POST(request: Request) {
  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  const minute = Math.floor(Date.now() / 60_000)
  if ((await store().increment(`screen:${ip}:${minute}`, 120)) > 60) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }
  try {
    const { address } = (await request.json()) as { address?: string }
    return Response.json(await screenAddress(address ?? ''))
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Screening failed' }, { status: 400 })
  }
}
