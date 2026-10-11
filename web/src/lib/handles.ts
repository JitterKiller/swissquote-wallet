import { api } from './api'

/** `@handle` payments (PDR-010, issue #20). Every call is made on behalf of a linked client. */

export type Visibility = 'clients' | 'contacts' | 'nobody'
export type MyHandle = { handle: string; visibility: Visibility; contacts: number } | null
export type ResolvedHandle = { handle: string; account: `0x${string}`; maskedName: string; verified: true }

export const looksLikeHandle = (value: string) => /^@?[a-z][a-z0-9_]{2,19}$/i.test(value.trim())
export const normalizeHandle = (raw: string) => raw.trim().replace(/^@/, '').toLowerCase()

export const resolveHandle = (clientId: string, handle: string) =>
  api<ResolvedHandle>(`/api/handles/${encodeURIComponent(normalizeHandle(handle))}?clientId=${encodeURIComponent(clientId)}`)

export const getMyHandle = (clientId: string) =>
  api<MyHandle>(`/api/handles/me?clientId=${encodeURIComponent(clientId)}`)

export const claimHandle = (clientId: string, handle: string, visibility: Visibility = 'clients') =>
  api<MyHandle>('/api/handles', { clientId, handle: normalizeHandle(handle), visibility })

export async function setVisibility(clientId: string, visibility: Visibility) {
  const response = await fetch('/api/handles', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId, visibility }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Update failed')
  return data as MyHandle
}

export const addContact = (clientId: string, contactHandle: string) =>
  api<MyHandle>('/api/handles/contacts', { clientId, contactHandle: normalizeHandle(contactHandle) })

/** Payment request link: opens the send flow with the recipient and amount filled in (#12). */
export function paymentRequestUrl(handle: string, amount?: string) {
  const url = new URL('/wallet/send', window.location.origin)
  url.searchParams.set('to', `@${normalizeHandle(handle)}`)
  if (amount) url.searchParams.set('amount', amount)
  return url.toString()
}
