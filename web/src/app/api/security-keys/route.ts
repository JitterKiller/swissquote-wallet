import { connection } from 'next/server'
import { isAddress } from 'viem'

import { readAccount } from '@/lib/account'
import { keyProxyAddress } from '@/lib/securityKey'
import type { SecurityKeyRecord } from '@/lib/storage'
import { store } from '@/server/store'

/**
 * Directory of security keys (#17, ADR-038): public data only (credential id, public key, verifier
 * proxy), keyed by the Account, so "Phone lost or stolen?" on a new device asks for the right key. A key
 * is listed only once it is an owner on-chain and its proxy matches its public key.
 */
export async function GET(request: Request) {
  await connection()
  const account = new URL(request.url).searchParams.get('account')
  if (!account || !isAddress(account)) return Response.json({ error: 'Invalid Account address' }, { status: 400 })
  const record = await store().get<SecurityKeyRecord>('securityKeys', account.toLowerCase())
  return record ? Response.json(record) : Response.json({ error: 'No security key' }, { status: 404 })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<SecurityKeyRecord>
    const { account, credentialId, publicKey, proxy } = body
    if (!account || !isAddress(account) || !proxy || !isAddress(proxy) || !credentialId || !publicKey?.x || !publicKey?.y) {
      return Response.json({ error: 'Invalid security key' }, { status: 400 })
    }
    if (keyProxyAddress(BigInt(publicKey.x), BigInt(publicKey.y)).toLowerCase() !== proxy.toLowerCase()) {
      return Response.json({ error: 'The proxy does not match this public key' }, { status: 400 })
    }
    const { owners } = await readAccount(account)
    const isOwner = (address: string) => owners.some((o) => o.toLowerCase() === address.toLowerCase())
    if (!isOwner(proxy)) return Response.json({ error: 'This key is not an owner of the Account' }, { status: 409 })
    // First record wins while its key is still an owner: nobody can point a new device at another credential.
    const existing = await store().get<SecurityKeyRecord>('securityKeys', account.toLowerCase())
    if (existing && isOwner(existing.proxy) && existing.credentialId !== credentialId) {
      return Response.json({ error: 'A key is already registered for this Account' }, { status: 409 })
    }
    const record: SecurityKeyRecord = { account, credentialId, publicKey: { x: publicKey.x, y: publicKey.y }, proxy, addedAt: Date.now() }
    await store().set('securityKeys', account.toLowerCase(), record)
    return Response.json(record)
  } catch (error) {
    console.error(error)
    return Response.json({ error: error instanceof Error ? error.message : 'Could not save the key' }, { status: 500 })
  }
}
