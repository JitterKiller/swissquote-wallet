import type { Address, Hex } from 'viem'

import type { AccountCall } from './account'
import { api } from './api'

/**
 * MOCK: the channel to the demo security key (ADR-043). In the demo another phone plays the user's FIDO2
 * key on `/wallet/key`, with its own Face ID. A real key talks to the phone over USB or NFC; here
 * Swissquote's backend relays the pairing and each signing request (`server/keyRelay.ts`). It carries
 * public data only: the key signs on its own device, and one key signature never moves funds alone.
 */

export const PAIRING_TTL_MS = 10 * 60_000
export const REQUEST_TTL_MS = 3 * 60_000

/** "Add a security key" on the wallet: the code the demo key types, then the key it registered. */
export type KeyPairing = {
  code: string
  account: Address
  label: string
  /** The wallet's own passkey: the key's authenticator refuses to hold it (PDR-017). */
  excludeCredentialId: string
  createdAt: number
  expiresAt: number
  key?: { credentialId: string; publicKey: { x: string; y: string } }
}

/** One row of a request on the demo key's screen: a label, the figure (mono), the words, what it does. */
export type KeyRequestLine = { label: string; figure?: string; value?: string; note?: string }

/** The SafeTx the key approves, as JSON. The key reads the nonce onchain and computes the digest itself. */
export type RelayedCall = { to: Address; value: string; data: Hex; operation: 0 | 1 }

/** One signing request, addressed to the key by its verifier proxy. One at a time per key. */
export type KeySignRequest = {
  id: string
  proxy: Address
  account: Address
  call: RelayedCall
  nonce: string
  /** What the wallet shows its owner, for the demo key's screen (a real key has none). */
  title: string
  lines: KeyRequestLine[]
  createdAt: number
  expiresAt: number
  seenAt?: number
  status: 'waiting' | 'signed' | 'refused'
  signature?: Hex
}

export class KeyRefusedError extends Error {
  constructor() {
    super('Your key refused this request. Nothing was signed.')
  }
}

const relay = '/api/key-relay'

const pause = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Cancelled', 'AbortError'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Cancelled', 'AbortError'))
    })
  })

export const toRelayedCall = (call: AccountCall): RelayedCall => ({
  to: call.to,
  value: (call.value ?? 0n).toString(),
  data: call.data,
  operation: call.operation ?? 0,
})

export const fromRelayedCall = (call: RelayedCall): AccountCall => ({ to: call.to, value: BigInt(call.value), data: call.data, operation: call.operation })

// ── The wallet ──────────────────────────────────────────────────────────────

export const startPairing = (input: { account: Address; label: string; excludeCredentialId: string }) =>
  api<KeyPairing>(relay, { action: 'pair', ...input })

export const getPairing = (code: string) => api<KeyPairing>(`${relay}?code=${encodeURIComponent(code)}`)

/** Polls until the demo key registered a credential on this pairing. */
export async function waitForPairing(code: string, signal?: AbortSignal): Promise<NonNullable<KeyPairing['key']>> {
  for (;;) {
    const pairing = await getPairing(code)
    if (pairing.key) return pairing.key
    await pause(1_200, signal)
  }
}

/**
 * Asks the demo key to sign one Account transaction, then waits for its answer. `onSeen` fires once
 * the key shows the request.
 */
export async function requestKeySignature(
  input: { proxy: Address; account: Address; call: AccountCall; nonce: bigint; title: string; lines: KeyRequestLine[] },
  options: { signal?: AbortSignal; onSeen?: () => void } = {},
): Promise<Hex> {
  const { id } = await api<KeySignRequest>(relay, {
    action: 'request',
    proxy: input.proxy,
    account: input.account,
    call: toRelayedCall(input.call),
    nonce: input.nonce.toString(),
    title: input.title,
    lines: input.lines,
  })
  let seen = false
  for (;;) {
    await pause(1_000, options.signal)
    const { request } = await api<{ request: KeySignRequest | null }>(`${relay}?proxy=${input.proxy}&id=${id}`)
    if (!request) throw new Error('The request to your key expired. Try again.')
    if (request.seenAt && !seen) {
      seen = true
      options.onSeen?.()
    }
    if (request.status === 'refused') throw new KeyRefusedError()
    if (request.status === 'signed' && request.signature) return request.signature
  }
}

// ── The demo key ────────────────────────────────────────────────────────────

export const registerOnPairing = (code: string, key: NonNullable<KeyPairing['key']>) => api<KeyPairing>(relay, { action: 'register', code, ...key })

/** The request waiting for this key, if any. */
export const currentRequest = (proxy: Address) => api<{ request: KeySignRequest | null }>(`${relay}?proxy=${proxy}`).then((r) => r.request)

export const markSeen = (proxy: Address, id: string) => api<{ request: KeySignRequest | null }>(relay, { action: 'seen', proxy, id })

export const answerRequest = (proxy: Address, id: string, answer: { signature: Hex } | { refused: true }) =>
  api<{ request: KeySignRequest | null }>(relay, { action: 'answer', proxy, id, ...answer })
