import { randomInt, randomUUID } from 'node:crypto'

import { isAddress, isHex, type Address, type Hex } from 'viem'

import { readAccount } from '@/lib/account'
import { PAIRING_TTL_MS, REQUEST_TTL_MS, type KeyPairing, type KeyRequestLine, type KeySignRequest, type RelayedCall } from '@/lib/keyRelay'

import { store } from './store'

/**
 * MOCK: the relay between the wallet and the demo security key on another phone (ADR-043). It stands in
 * for the USB or NFC link of a real FIDO2 key. Records hold public data only (`keyPairings` by code,
 * `keyRequests` by the key's verifier proxy, one request at a time). The relay can't sign anything: the
 * key signs on its own device, and its signature alone never moves funds (any 2 of the Account's owners).
 */

const PAIRINGS = 'keyPairings'
const REQUESTS = 'keyRequests'
// No 0/O or 1/I/L: the code is read off one phone and typed on another.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export class KeyRelayError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

/** A request body, read field by field. */
type Input = Record<string, unknown>

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const text = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max

function address(value: unknown, what: string): Address {
  if (typeof value !== 'string' || !isAddress(value)) throw new KeyRelayError(`Invalid ${what}`)
  return value
}

export async function createPairing(input: Input): Promise<KeyPairing> {
  const account = address(input.account, 'Account address')
  if (!text(input.label, 60) || !text(input.excludeCredentialId, 512)) throw new KeyRelayError('Invalid pairing')
  const now = Date.now()
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
    const pairing: KeyPairing = {
      code,
      account,
      label: input.label as string,
      excludeCredentialId: input.excludeCredentialId as string,
      createdAt: now,
      expiresAt: now + PAIRING_TTL_MS,
    }
    const existing = await store().get<KeyPairing>(PAIRINGS, code)
    if (existing && existing.expiresAt > now) continue
    await store().set(PAIRINGS, code, pairing)
    return pairing
  }
  throw new KeyRelayError('Could not create a pairing code, try again', 503)
}

export async function getPairing(code: string): Promise<KeyPairing> {
  const pairing = await store().get<KeyPairing>(PAIRINGS, code.trim().toUpperCase())
  if (!pairing) throw new KeyRelayError('No pairing with this code. Check it on the wallet.', 404)
  if (pairing.expiresAt < Date.now() && !pairing.key) throw new KeyRelayError('This code expired. Start again on the wallet.', 410)
  return pairing
}

export async function registerKey(input: Input) {
  if (typeof input.code !== 'string') throw new KeyRelayError('Invalid code')
  const pairing = await getPairing(input.code)
  const credentialId = input.credentialId
  const publicKey = input.publicKey as { x?: unknown; y?: unknown } | undefined
  if (!text(credentialId, 512) || !text(publicKey?.x, 80) || !text(publicKey?.y, 80) || !/^\d+$/.test(`${publicKey!.x}${publicKey!.y}`)) {
    throw new KeyRelayError('Invalid key')
  }
  if (pairing.key && pairing.key.credentialId !== credentialId) throw new KeyRelayError('Another key already answered this code', 409)
  const next: KeyPairing = { ...pairing, key: { credentialId: credentialId as string, publicKey: { x: publicKey!.x as string, y: publicKey!.y as string } } }
  await store().set(PAIRINGS, pairing.code, next)
  return next
}

function relayedCall(value: unknown): RelayedCall {
  const call = value as Partial<RelayedCall> | undefined
  if (!call || typeof call !== 'object') throw new KeyRelayError('Invalid call')
  const to = address(call.to, 'call target')
  if (typeof call.data !== 'string' || !isHex(call.data) || call.data.length > 40_000) throw new KeyRelayError('Invalid call data')
  if (typeof call.value !== 'string' || !/^\d+$/.test(call.value)) throw new KeyRelayError('Invalid call value')
  if (call.operation !== 0 && call.operation !== 1) throw new KeyRelayError('Invalid call operation')
  return { to, value: call.value, data: call.data as Hex, operation: call.operation }
}

export async function createRequest(input: Input): Promise<KeySignRequest> {
  const proxy = address(input.proxy, 'key')
  const account = address(input.account, 'Account address')
  const call = relayedCall(input.call)
  if (typeof input.nonce !== 'string' || !/^\d+$/.test(input.nonce)) throw new KeyRelayError('Invalid nonce')
  if (!text(input.title, 80)) throw new KeyRelayError('Invalid title')
  const lines = (Array.isArray(input.lines) ? input.lines : []) as Partial<KeyRequestLine>[]
  const optional = (value: unknown, max: number) => value === undefined || text(value, max)
  const valid = (line: Partial<KeyRequestLine>) =>
    !!line && text(line.label, 40) && optional(line.figure, 80) && optional(line.value, 120) && optional(line.note, 120) && !!(line.figure || line.value)
  if (lines.length > 8 || !lines.every(valid)) throw new KeyRelayError('Invalid description')
  // Only a key that is an owner of this Account gets its requests.
  const { owners } = await readAccount(account)
  if (!owners.some((o) => same(o, proxy))) throw new KeyRelayError('This key is not an owner of the Account', 409)
  const now = Date.now()
  const request: KeySignRequest = {
    id: randomUUID(),
    proxy,
    account,
    call,
    nonce: input.nonce as string,
    title: input.title as string,
    lines: lines.map(({ label, figure, value, note }) => ({ label, figure, value, note }) as KeyRequestLine),
    createdAt: now,
    expiresAt: now + REQUEST_TTL_MS,
    status: 'waiting',
  }
  await store().set(REQUESTS, proxy.toLowerCase(), request)
  return request
}

/** The key's current request (`id` omitted: only a waiting one), or one by id for the wallet that asked. */
export async function getRequest(proxyInput: string, id?: string | null): Promise<KeySignRequest | null> {
  const proxy = address(proxyInput, 'key')
  const request = await store().get<KeySignRequest>(REQUESTS, proxy.toLowerCase())
  if (!request || request.expiresAt < Date.now()) return null
  if (id) return request.id === id ? request : null
  return request.status === 'waiting' ? request : null
}

export async function markSeen(input: Input) {
  const request = await getRequest(address(input.proxy, 'key'), String(input.id ?? ''))
  if (!request) throw new KeyRelayError('This request expired', 410)
  if (request.seenAt) return request
  const next = { ...request, seenAt: Date.now() }
  await store().set(REQUESTS, request.proxy.toLowerCase(), next)
  return next
}

export async function answerRequest(input: Input) {
  const request = await getRequest(address(input.proxy, 'key'), String(input.id ?? ''))
  if (!request) throw new KeyRelayError('This request expired', 410)
  if (request.status !== 'waiting') throw new KeyRelayError('This request was already answered', 409)
  let next: KeySignRequest
  if (input.refused === true) next = { ...request, status: 'refused' }
  else if (typeof input.signature === 'string' && isHex(input.signature) && input.signature.length < 4_000)
    next = { ...request, status: 'signed', signature: input.signature }
  else throw new KeyRelayError('Invalid answer')
  await store().set(REQUESTS, request.proxy.toLowerCase(), next)
  return next
}
