import type { WebauthnPublicKey } from 'abstractionkit'

import type { Level } from './config'
import type { RecoveryKitV3 } from './recoveryKit'

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
  /** Block at creation (decimal string): start of the on-chain history scan. */
  createdBlock?: string
  /** The Account Safe holding the funds (ADR-017), set once protection is activated. */
  account?: `0x${string}`
  level?: Level
  /** Daily limit chosen at setup, USDC base units (decimal string). The chain is the source of truth. */
  dailyLimit?: string
}

/**
 * A recovery started on THIS (new) device: the new passkey must be persisted
 * before anything is sent, otherwise a reload would lose its public key.
 */
export type LocalRecovery = {
  wallet: `0x${string}`
  name: string
  credentialId: string
  publicKey: { x: string; y: string }
  newOwner: `0x${string}`
  requestTx?: string
  /** The Account of a v3 Kit, restored once the recovery completes. */
  account?: `0x${string}`
}

const WALLET_KEY = 'sq-wallet:v1'
const RECOVERY_KEY = 'sq-recovery:v1'
// The only secret stored client-side, and always encrypted (ADR-018).
const KIT_KEY = 'sq-kit:v3'
const KIT_TESTED_KEY = 'sq-kit-tested:v1'

export function toPublicKey(stored: { publicKey: { x: string; y: string } }): WebauthnPublicKey {
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

export const loadLocalRecovery = () => read<LocalRecovery>(RECOVERY_KEY)
export const saveLocalRecovery = (recovery: LocalRecovery) => write(RECOVERY_KEY, recovery)
export function clearLocalRecovery() {
  try {
    window.localStorage.removeItem(RECOVERY_KEY)
  } catch {}
}

/** Encrypted Kit copy, so a large payment only asks for the passphrase (PDR-016). */
export const loadLocalKit = () => read<RecoveryKitV3>(KIT_KEY)
export const saveLocalKit = (kit: RecoveryKitV3) => write(KIT_KEY, kit)

/** Last successful "test your Kit" (ms), for the periodic reminder. */
export const loadKitTestedAt = () => read<number>(KIT_TESTED_KEY)
export const saveKitTestedAt = (at = Date.now()) => write(KIT_TESTED_KEY, at)

export function clearAll() {
  try {
    window.localStorage.removeItem(WALLET_KEY)
    window.localStorage.removeItem(RECOVERY_KEY)
    window.localStorage.removeItem(KIT_KEY)
    window.localStorage.removeItem(KIT_TESTED_KEY)
  } catch {}
}
