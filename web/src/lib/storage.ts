import type { WebauthnPublicKey } from 'abstractionkit'

/**
 * Local persistence of PUBLIC wallet data only (credential id, public key,
 * address). Nothing secret is stored: the private key never leaves the
 * authenticator. In production this would also be registered with the
 * Swissquote backend so the wallet can be found again from a new device.
 */

export type StoredWallet = {
  name: string
  credentialId: string
  publicKey: { x: string; y: string }
  address: `0x${string}`
  createdAt: number
}

export type Activity = {
  kind: 'send'
  to: string
  amount: string
  txHash: string
  at: number
}

const WALLET_KEY = 'sq-wallet:v1'
const ACTIVITY_KEY = 'sq-activity:v1'

export function toPublicKey(stored: StoredWallet): WebauthnPublicKey {
  return { x: BigInt(stored.publicKey.x), y: BigInt(stored.publicKey.y) }
}

export function serializePublicKey(publicKey: WebauthnPublicKey) {
  return { x: '0x' + publicKey.x.toString(16), y: '0x' + publicKey.y.toString(16) }
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable (private mode…): the app still works for this session.
  }
}

export const loadWallet = () => read<StoredWallet>(WALLET_KEY)
export const saveWallet = (wallet: StoredWallet) => write(WALLET_KEY, wallet)

export const loadActivity = () => read<Activity[]>(ACTIVITY_KEY) ?? []
export const saveActivity = (activity: Activity[]) => write(ACTIVITY_KEY, activity)

export function clearAll() {
  try {
    window.localStorage.removeItem(WALLET_KEY)
    window.localStorage.removeItem(ACTIVITY_KEY)
  } catch {}
}
