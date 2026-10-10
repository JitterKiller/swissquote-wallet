import { connection } from 'next/server'

import { getWalletByClient, unlinkWallet } from '@/server/registry'

/** The caller's registry entry. MOCK auth: `?clientId=` stands in for the e-banking session. */
export async function GET(request: Request) {
  await connection()
  const clientId = new URL(request.url).searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'clientId is required' }, { status: 400 })
  const wallet = await getWalletByClient(clientId)
  return wallet ? Response.json(wallet) : Response.json({ error: 'No linked wallet' }, { status: 404 })
}

/** Unlink: deletes the entry (PDR-022). */
export async function DELETE(request: Request) {
  const clientId = new URL(request.url).searchParams.get('clientId')
  if (!clientId) return Response.json({ error: 'clientId is required' }, { status: 400 })
  return Response.json({ unlinked: await unlinkWallet(clientId) })
}
