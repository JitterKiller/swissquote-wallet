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
 * An eviction started on THIS (new) device (#15): the new passkey is persisted before anything is
 * sent, so a reload during the delay keeps it. Public data only.
 */
export type LocalEviction = {
  account: `0x${string}`
  oldKeySafe: `0x${string}`
  newKeySafe: `0x${string}`
  name: string
  credentialId: string
  publicKey: { x: string; y: string }
  level?: Level
  startTx?: string
  executeAfter?: number
  /** Old phone's daily limit (USDC base units) to hand over to the new phone. */
  dailyLimit?: string
  finalizeTx?: string
  /** The Account's security key (verifier proxy), when it has one: Kit + key lock the old phone out at once (#17). */
  keyProxy?: `0x${string}`
}

/** This device's record of the Account's security key: public data only (credential id, public key, proxy). */
export type SecurityKeyRecord = {
  account: `0x${string}`
  credentialId: string
  publicKey: { x: string; y: string }
  proxy: `0x${string}`
  addedAt: number
  /** `demo`: another phone plays the key on `/wallet/key`, reached through the MOCK relay (ADR-043). Default: a FIDO2 key. */
  kind?: 'fido2' | 'demo'
}

/**
 * MOCK, on the phone that PLAYS the security key (`/wallet/key`, ADR-043): which credential it holds and
 * for which Account. Public data only; the private key stays in this phone's authenticator.
 */
export type DemoKeyRecord = {
  account: `0x${string}`
  label: string
  credentialId: string
  publicKey: { x: string; y: string }
  proxy: `0x${string}`
  addedAt: number
}

const WALLET_KEY = 'sq-wallet:v1'
// Left on devices by the legacy Key Safe recovery (removed in #33, ADR-042): cleared with the wallet.
const RECOVERY_KEY = 'sq-recovery:v1'
// The only secret stored client-side, and always encrypted (ADR-018).
const KIT_KEY = 'sq-kit:v3'
const EVICTION_KEY = 'sq-eviction:v1'
const SECURITY_KEY_KEY = 'sq-security-key:v1'
// On a phone that plays a demo key (ADR-043). Not cleared with the wallet: it belongs to the key, not to a wallet.
const DEMO_KEY_KEY = 'sq-demo-key:v1'
// The Account whose first Kit payment already showed the Offers line on this device (#22): a convenience, public.
const OFFERS_HINT_KEY = 'sq-offers-hint:v1'
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

export const loadLocalEviction = () => read<LocalEviction>(EVICTION_KEY)
export const saveLocalEviction = (eviction: LocalEviction) => write(EVICTION_KEY, eviction)
export function clearLocalEviction() {
  try {
    window.localStorage.removeItem(EVICTION_KEY)
  } catch {}
}

/** Encrypted Kit copy, so a large payment only asks for the passphrase (PDR-016). */
export const loadLocalKit = () => read<RecoveryKitV3>(KIT_KEY)

export const loadSecurityKey = () => read<SecurityKeyRecord>(SECURITY_KEY_KEY)
export const saveSecurityKey = (key: SecurityKeyRecord) => write(SECURITY_KEY_KEY, key)

export const loadDemoKey = () => read<DemoKeyRecord>(DEMO_KEY_KEY)
export const saveDemoKey = (key: DemoKeyRecord) => write(DEMO_KEY_KEY, key)
export function clearDemoKey() {
  try {
    window.localStorage.removeItem(DEMO_KEY_KEY)
  } catch {}
}

export function offersHintSeen(account: string) {
  try {
    return window.localStorage.getItem(OFFERS_HINT_KEY) === account.toLowerCase()
  } catch {
    return false
  }
}

export function markOffersHintSeen(account: string) {
  try {
    window.localStorage.setItem(OFFERS_HINT_KEY, account.toLowerCase())
  } catch {}
}
export const saveLocalKit = (kit: RecoveryKitV3) => write(KIT_KEY, kit)

/** Last successful "test your Kit" (ms), for the periodic reminder. */
export const loadKitTestedAt = () => read<number>(KIT_TESTED_KEY)
/** Fired on this tab when the last Kit test changes (#9): the Overview reminder and the Security row follow it. */
export const KIT_TESTED_EVENT = 'sq-kit-tested'
export function saveKitTestedAt(at = Date.now()) {
  write(KIT_TESTED_KEY, at)
  window.dispatchEvent(new Event(KIT_TESTED_EVENT))
}

export function clearAll() {
  try {
    window.localStorage.removeItem(WALLET_KEY)
    window.localStorage.removeItem(RECOVERY_KEY)
    window.localStorage.removeItem(KIT_KEY)
    window.localStorage.removeItem(KIT_TESTED_KEY)
    window.localStorage.removeItem(EVICTION_KEY)
    window.localStorage.removeItem(SECURITY_KEY_KEY)
    window.localStorage.removeItem(OFFERS_HINT_KEY)
  } catch {}
}
