import { decryptKeystoreJson, encryptKeystoreJson, isKeystoreJson } from 'ethers/wallet'
import { getAddress, isAddress, isHex, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

import { CHAIN_ID } from './config'
import { loadLocalKit } from './storage'

/**
 * Recovery Kit.
 *
 * v3 (PDR-016, ADR-018, ADR-019), the target design: two keys generated on the
 * device, each encrypted with the user's passphrase as an Ethereum keystore V3
 * (scrypt + AES-128-CTR + MAC, via ethers):
 *  - owner key: an owner of the Account (co-signs large payments and settings),
 *  - guardian key: the Account's eviction guardian (starts a time-locked eviction).
 * Copies: the user's iCloud Drive / Google Drive, and the app (`storage.ts`).
 * The passphrase is never stored or sent.
 *
 * v1 (legacy, until the eviction UI ships): a plain JSON guardian key for the
 * Key Safe recovery (PDR-005, superseded).
 */

export type RecoveryKit = {
  type: 'swissquote-wallet-recovery-kit'
  version: 1
  chainId: number
  wallet: `0x${string}`
  guardianAddress: `0x${string}`
  guardianKey: `0x${string}`
  createdAt: string
}

export function createRecoveryKit(wallet: `0x${string}`): RecoveryKit {
  const guardianKey = generatePrivateKey()
  return {
    type: 'swissquote-wallet-recovery-kit',
    version: 1,
    chainId: Number(CHAIN_ID),
    wallet,
    guardianAddress: privateKeyToAccount(guardianKey).address,
    guardianKey,
    createdAt: new Date().toISOString(),
  }
}

export function parseRecoveryKit(text: string): RecoveryKit {
  let kit: Partial<RecoveryKit>
  try {
    kit = JSON.parse(text)
  } catch {
    throw new Error('This is not a valid Recovery Kit file.')
  }
  if (
    kit.type !== 'swissquote-wallet-recovery-kit' ||
    !kit.wallet ||
    !isAddress(kit.wallet) ||
    !kit.guardianKey ||
    !isHex(kit.guardianKey)
  ) {
    throw new Error('This is not a valid Recovery Kit file.')
  }
  if (kit.chainId !== Number(CHAIN_ID)) throw new Error('This Recovery Kit is for another network.')
  const address = privateKeyToAccount(kit.guardianKey).address
  return { ...(kit as RecoveryKit), guardianAddress: address }
}

export function downloadRecoveryKit(kit: RecoveryKit) {
  const blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `swissquote-recovery-kit-${kit.wallet.slice(2, 8).toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Kit v3 ──────────────────────────────────────────────────────────────────

export const KIT_PASSPHRASE_MIN_LENGTH = 12

type Keystore = { address: string; crypto?: unknown; Crypto?: unknown } & Record<string, unknown>

export type RecoveryKitV3 = {
  type: 'swissquote-wallet-recovery-kit'
  version: 3
  chainId: number
  account: Address
  keySafe: Address
  ownerKeystore: Keystore
  guardianKeystore: Keystore
  createdAt: string
}

/** Private keys, in memory only (never persisted in clear). */
export type KitKeys = { owner: Hex; guardian: Hex }
export type KitAccounts = { owner: PrivateKeyAccount; guardian: PrivateKeyAccount }

export class KitPassphraseError extends Error {
  constructor() {
    super('Wrong Kit passphrase.')
    this.name = 'KitPassphraseError'
  }
}

export const createKitKeys = (): KitKeys => ({ owner: generatePrivateKey(), guardian: generatePrivateKey() })

export const kitAccounts = (keys: KitKeys): KitAccounts => ({
  owner: privateKeyToAccount(keys.owner),
  guardian: privateKeyToAccount(keys.guardian),
})

/** Why a passphrase is refused, or null. The strength indicator itself is UI. */
export function passphraseIssue(passphrase: string): string | null {
  if (passphrase.length < KIT_PASSPHRASE_MIN_LENGTH) return `Use at least ${KIT_PASSPHRASE_MIN_LENGTH} characters.`
  if (/^\d+$/.test(passphrase)) return 'Use words, not only digits, and never your phone passcode.'
  return null
}

/** Encrypts both keys (about 1–2 s each in a browser: deliberately slow to attack). */
export async function encryptKit(
  keys: KitKeys,
  passphrase: string,
  meta: { account: Address; keySafe: Address },
): Promise<RecoveryKitV3> {
  const issue = passphraseIssue(passphrase)
  if (issue) throw new Error(issue)
  const accounts = kitAccounts(keys)
  const [ownerKeystore, guardianKeystore] = await Promise.all([
    encryptKeystoreJson({ address: accounts.owner.address, privateKey: keys.owner }, passphrase),
    encryptKeystoreJson({ address: accounts.guardian.address, privateKey: keys.guardian }, passphrase),
  ])
  return {
    type: 'swissquote-wallet-recovery-kit',
    version: 3,
    chainId: Number(CHAIN_ID),
    account: getAddress(meta.account),
    keySafe: getAddress(meta.keySafe),
    ownerKeystore: JSON.parse(ownerKeystore),
    guardianKeystore: JSON.parse(guardianKeystore),
    createdAt: new Date().toISOString(),
  }
}

/** Public addresses of the two keys, readable without the passphrase. */
export const kitAddresses = (kit: RecoveryKitV3) => ({
  owner: getAddress(`0x${kit.ownerKeystore.address.replace(/^0x/, '')}`),
  guardian: getAddress(`0x${kit.guardianKeystore.address.replace(/^0x/, '')}`),
})

/** Decrypts both keys. Throws KitPassphraseError on a wrong passphrase. */
export async function decryptKit(kit: RecoveryKitV3, passphrase: string): Promise<KitAccounts> {
  try {
    const [owner, guardian] = await Promise.all([
      decryptKeystoreJson(JSON.stringify(kit.ownerKeystore), passphrase),
      decryptKeystoreJson(JSON.stringify(kit.guardianKeystore), passphrase),
    ])
    return { owner: privateKeyToAccount(owner.privateKey as Hex), guardian: privateKeyToAccount(guardian.privateKey as Hex) }
  } catch (error) {
    if (error instanceof Error && /incorrect password/i.test(error.message)) throw new KitPassphraseError()
    throw error
  }
}

/** Reads a Kit file: v3 (target design) or v1 (legacy Key Safe recovery). */
export function parseKitFile(text: string): { version: 3; kit: RecoveryKitV3 } | { version: 1; kit: RecoveryKit } {
  let raw: Omit<Partial<RecoveryKitV3>, 'version'> & { version?: number }
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('This is not a valid Recovery Kit file.')
  }
  if (raw.version === 1) return { version: 1, kit: parseRecoveryKit(text) }
  if (
    raw.type !== 'swissquote-wallet-recovery-kit' ||
    raw.version !== 3 ||
    !raw.account || !isAddress(raw.account) ||
    !raw.keySafe || !isAddress(raw.keySafe) ||
    !raw.ownerKeystore || !isKeystoreJson(JSON.stringify(raw.ownerKeystore)) ||
    !raw.guardianKeystore || !isKeystoreJson(JSON.stringify(raw.guardianKeystore))
  ) {
    throw new Error('This is not a valid Recovery Kit file.')
  }
  if (raw.chainId !== Number(CHAIN_ID)) throw new Error('This Recovery Kit is for another network.')
  return { version: 3, kit: raw as RecoveryKitV3 }
}

/**
 * Unlocks the Kit for a 2-factor action: from a picked file (`file`, e.g. on a new
 * device) or from the encrypted copy stored on this device. Shared interface used by
 * send, limit settings, eviction and the security key (issues #12, #13, #15, #16, #17).
 */
export async function unlockKit(passphrase: string, file?: RecoveryKitV3 | string): Promise<KitAccounts> {
  let kit: RecoveryKitV3 | null
  if (typeof file === 'string') {
    const parsed = parseKitFile(file)
    if (parsed.version !== 3) throw new Error('This is an old Recovery Kit (v1): it cannot sign for the Account.')
    kit = parsed.kit
  } else {
    kit = file ?? loadLocalKit()
  }
  if (!kit) throw new Error('No Recovery Kit on this device: pick your Kit file.')
  return decryptKit(kit, passphrase)
}

export const kitFileName = (kit: RecoveryKitV3) => `swissquote-recovery-kit-${kit.account.toLowerCase()}.json`

/** Browser download; the UI then asks the user to save it to iCloud Drive / Google Drive. */
export function downloadKit(kit: RecoveryKitV3) {
  const blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = kitFileName(kit)
  a.click()
  URL.revokeObjectURL(url)
}
