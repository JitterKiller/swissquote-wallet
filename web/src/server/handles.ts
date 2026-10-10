import { isSanctioned } from './compliance'
import { getWalletByClient } from './registry'
import { store } from './store'

/**
 * `@handle` directory (PDR-010, issue #20). Only linked clients (registry, ADR-021) can claim
 * or resolve a handle. Privacy by design: exact match only, no listing or search, rate-limited,
 * and a hidden handle answers exactly like a missing one. Never written on-chain.
 */

export type Visibility = 'clients' | 'contacts' | 'nobody'

type HandleEntry = {
  handle: string
  clientId: string
  visibility: Visibility
  contacts: string[] // client ids allowed to resolve when visibility = 'contacts'
  createdAt: number
}

export type ResolvedHandle = { handle: string; account: string; maskedName: string; verified: true }

const HANDLE = /^[a-z][a-z0-9_]{2,19}$/
const RESERVED = new Set([
  'swissquote', 'support', 'admin', 'help', 'security', 'official', 'sq', 'wallet', 'bank',
  'team', 'info', 'root', 'system', 'yuh', 'postfinance', 'finma', 'compliance',
])
const RESOLVES_PER_MINUTE = 30

export class HandleError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

/** "@Adam" → "adam" */
export const normalizeHandle = (raw: string) => raw.trim().replace(/^@/, '').toLowerCase()

async function linkedClient(clientId?: string) {
  if (!clientId) throw new HandleError('Sign in with Swissquote first', 401)
  const wallet = await getWalletByClient(clientId)
  if (!wallet) throw new HandleError('Link your wallet to your Swissquote account first', 403)
  return wallet
}

export async function claimHandle(input: { clientId?: string; handle?: string; visibility?: Visibility }) {
  await linkedClient(input.clientId)
  const handle = normalizeHandle(input.handle ?? '')
  if (!HANDLE.test(handle)) {
    throw new HandleError('3 to 20 characters: lowercase letters, digits and _, starting with a letter')
  }
  if (RESERVED.has(handle)) throw new HandleError('This handle is reserved')
  const clientId = input.clientId as string
  const previous = await store().get<string>('handleByClient', clientId)
  if (previous === handle) return getMyHandle(clientId)

  const entry: HandleEntry = {
    handle,
    clientId,
    visibility: input.visibility ?? 'clients',
    contacts: [],
    createdAt: Date.now(),
  }
  // Atomic: two clients claiming the same handle at once cannot both get it.
  if (!(await store().setIfAbsent('handles', handle, entry))) throw new HandleError('This handle is taken', 409)
  if (previous) {
    const old = await store().get<HandleEntry>('handles', previous)
    if (old) entry.contacts = old.contacts
    await store().set('handles', handle, entry)
    await store().delete('handles', previous)
  }
  await store().set('handleByClient', clientId, handle)
  return getMyHandle(clientId)
}

export async function getMyHandle(clientId?: string) {
  await linkedClient(clientId)
  const handle = await store().get<string>('handleByClient', clientId as string)
  const entry = handle ? await store().get<HandleEntry>('handles', handle) : null
  return entry ? { handle: entry.handle, visibility: entry.visibility, contacts: entry.contacts.length } : null
}

export async function setVisibility(clientId: string | undefined, visibility: Visibility) {
  await linkedClient(clientId)
  if (!['clients', 'contacts', 'nobody'].includes(visibility)) throw new HandleError('Invalid visibility')
  const handle = await store().get<string>('handleByClient', clientId as string)
  const entry = handle ? await store().get<HandleEntry>('handles', handle) : null
  if (!entry) throw new HandleError('No handle yet', 404)
  await store().set('handles', entry.handle, { ...entry, visibility })
  return getMyHandle(clientId)
}

export async function releaseHandle(clientId?: string) {
  await linkedClient(clientId)
  const handle = await store().get<string>('handleByClient', clientId as string)
  if (handle) await store().delete('handles', handle)
  await store().delete('handleByClient', clientId as string)
  return { released: Boolean(handle) }
}

/** Lets the owner of a handle with "contacts" visibility allow another client (by their handle). */
export async function addContact(clientId: string | undefined, contactHandle: string) {
  await linkedClient(clientId)
  const mine = await store().get<string>('handleByClient', clientId as string)
  const entry = mine ? await store().get<HandleEntry>('handles', mine) : null
  if (!entry) throw new HandleError('Claim your handle first', 404)
  const contact = await store().get<HandleEntry>('handles', normalizeHandle(contactHandle))
  if (!contact) throw new HandleError('No such handle', 404)
  if (!entry.contacts.includes(contact.clientId)) entry.contacts.push(contact.clientId)
  await store().set('handles', entry.handle, entry)
  return getMyHandle(clientId)
}

/** Exact-match resolution for a linked client. Hidden, missing and sanctioned all look alike. */
export async function resolveHandle(resolverClientId: string | undefined, raw: string): Promise<ResolvedHandle> {
  await linkedClient(resolverClientId)
  const minute = Math.floor(Date.now() / 60_000)
  if ((await store().increment(`handle-resolve:${resolverClientId}:${minute}`, 120)) > RESOLVES_PER_MINUTE) {
    throw new HandleError('Too many lookups, try again in a minute', 429)
  }
  const notFound = new HandleError('No Swissquote client with this handle', 404)
  const entry = await store().get<HandleEntry>('handles', normalizeHandle(raw))
  if (!entry) throw notFound
  const isOwner = entry.clientId === resolverClientId
  const allowed =
    isOwner ||
    entry.visibility === 'clients' ||
    (entry.visibility === 'contacts' && entry.contacts.includes(resolverClientId as string))
  if (!allowed) throw notFound
  const owner = await getWalletByClient(entry.clientId)
  if (!owner) throw notFound
  if (await isSanctioned(owner.account)) throw new HandleError('This recipient is not available', 403)
  return { handle: entry.handle, account: owner.account, maskedName: owner.maskedName, verified: true }
}
