import { getAddress, isAddress } from 'viem'

import { store } from './store'

/**
 * Sanctions screening (PDR-023, ADR-022). Friction, never a veto: Swissquote's app and
 * sponsorship refuse to facilitate a transfer to a sanctioned address; nothing is blocked
 * on-chain.
 *
 * MOCK list for the demo, plus `SANCTIONS_EXTRA_ADDRESSES` (comma-separated) and, when
 * `CHAINALYSIS_API_KEY` is set, Chainalysis' free sanctions API (cached 24 h).
 */

/** MOCK: test addresses standing in for SECO / OFAC / EU / UN listings (see README). */
export const MOCK_SANCTIONED_ADDRESSES = [
  '0x000000000000000000000000000000000000bad1',
  '0x000000000000000000000000000000000000bad2',
]

export type Screening = {
  address: string
  status: 'clear' | 'sanctioned'
  source: 'mock-list' | 'chainalysis'
  list?: string
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function mockList() {
  const extra = (process.env.SANCTIONS_EXTRA_ADDRESSES ?? '').split(',').map((a) => a.trim()).filter(Boolean)
  return new Set([...MOCK_SANCTIONED_ADDRESSES, ...extra].map((a) => a.toLowerCase()))
}

async function chainalysis(address: string): Promise<Screening | null> {
  const key = process.env.CHAINALYSIS_API_KEY
  if (!key) return null
  const cached = await store().get<Screening & { at: number }>('sanctionsCache', address)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached
  const response = await fetch(`https://public.chainalysis.com/api/v1/address/${address}`, {
    headers: { 'X-API-Key': key, accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`Chainalysis screening failed (${response.status})`)
  const { identifications = [] } = (await response.json()) as { identifications?: { name?: string }[] }
  const result: Screening = {
    address,
    status: identifications.length ? 'sanctioned' : 'clear',
    source: 'chainalysis',
    list: identifications[0]?.name,
  }
  await store().set('sanctionsCache', address, { ...result, at: Date.now() })
  return result
}

export async function screenAddress(address: string): Promise<Screening> {
  if (!isAddress(address)) throw new Error('Invalid address')
  const normalized = getAddress(address)
  const lower = normalized.toLowerCase()
  const result: Screening = mockList().has(lower)
    ? { address: normalized, status: 'sanctioned', source: 'mock-list', list: 'MOCK sanctions list' }
    : ((await chainalysis(lower)) ?? { address: normalized, status: 'clear', source: 'mock-list' })
  await store().append('compliance', { ...result, at: Date.now() })
  return { ...result, address: normalized }
}

export async function isSanctioned(address: string) {
  return (await screenAddress(address)).status === 'sanctioned'
}
