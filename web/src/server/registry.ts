import { randomBytes } from 'node:crypto'

import { SafeMultiChainSigAccountV1 as SafeAccount } from 'abstractionkit'
import { WebAuthnP256 } from 'ox'
import { getAddress, isAddress, isHex, parseAbi, toHex, type Address, type Hex } from 'viem'

import {
  ownershipChallenge,
  type RegisterWalletRequest,
  type RegisteredWallet,
} from '@/lib/registry'
import { isDeployed, predictAddress, publicClient } from '@/lib/wallet'

import { store } from './store'

/**
 * Wallet registry (PDR-022, ADR-021). Swissquote's record of which Account belongs to
 * which linked client, with the passkey-signed proof kept as travel-rule evidence.
 */

const CHALLENGE_TTL_MS = 10 * 60 * 1000
const safeAbi = parseAbi(['function isOwner(address owner) view returns (bool)'])

type Challenge = { clientId: string; account: Address; keySafe: Address; issuedAt: string; used: boolean }

type WalletEntry = RegisteredWallet & {
  publicKey: { x: string; y: string }
  proof: { nonce: Hex; issuedAt: string; assertion: RegisterWalletRequest['assertion'] }
}

export class RegistryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

/** "Adam Meier" → "Adam M." */
export function maskName(name: string) {
  const [first, ...rest] = name.trim().split(/\s+/)
  const last = rest.at(-1)
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}

function toPublic(entry: WalletEntry): RegisteredWallet {
  const { clientId, displayName, maskedName, account, keySafe, level, registeredAt, updatedAt } = entry
  return { clientId, displayName, maskedName, account, keySafe, level, registeredAt, updatedAt }
}

export async function getWalletByClient(clientId: string): Promise<RegisteredWallet | null> {
  const entry = await store().get<WalletEntry>('wallets', clientId)
  return entry ? toPublic(entry) : null
}

export async function getWalletByAccount(account: string): Promise<RegisteredWallet | null> {
  const clientId = await store().get<string>('walletByAccount', account.toLowerCase())
  return clientId ? getWalletByClient(clientId) : null
}

export async function createChallenge(input: { clientId?: string; account?: string; keySafe?: string }) {
  const { clientId, account, keySafe } = input
  if (!clientId || !account || !isAddress(account) || !keySafe || !isAddress(keySafe)) {
    throw new RegistryError('clientId, account and keySafe are required')
  }
  const nonce = toHex(randomBytes(32))
  const issuedAt = String(Math.floor(Date.now() / 1000))
  const challenge: Challenge = {
    clientId,
    account: getAddress(account),
    keySafe: getAddress(keySafe),
    issuedAt,
    used: false,
  }
  await store().set('walletChallenges', nonce, challenge)
  return { nonce, issuedAt }
}

/**
 * Verifies the proof and stores the entry. `origin` is this server's own origin: the
 * passkey must have signed on it (its rpId is the origin's hostname).
 */
export async function registerWallet(request: RegisterWalletRequest, origin: string): Promise<RegisteredWallet> {
  const { clientId, displayName, account, keySafe, publicKey, nonce, assertion } = request
  if (!clientId || !displayName?.trim()) throw new RegistryError('clientId and displayName are required')
  if (!isAddress(account) || !isAddress(keySafe)) throw new RegistryError('Invalid account or Key Safe address')
  if (!publicKey?.x || !publicKey?.y || !isHex(nonce) || !assertion?.authenticatorData || !assertion.clientDataJSON) {
    throw new RegistryError('Missing public key, nonce or passkey assertion')
  }

  // 1. Single-use, fresh challenge issued for this client, Account and Key Safe.
  const challenge = await store().get<Challenge>('walletChallenges', nonce)
  if (
    !challenge ||
    challenge.used ||
    challenge.clientId !== clientId ||
    challenge.account !== getAddress(account) ||
    challenge.keySafe !== getAddress(keySafe) ||
    Date.now() - Number(challenge.issuedAt) * 1000 > CHALLENGE_TTL_MS
  ) {
    throw new RegistryError('Unknown, used or expired challenge', 403)
  }

  // 2. Passkey signature over the EIP-712 statement, signed on this origin.
  const x = BigInt(publicKey.x)
  const y = BigInt(publicKey.y)
  const signed = WebAuthnP256.verify({
    challenge: ownershipChallenge({ clientId, account, keySafe, nonce, issuedAt: BigInt(challenge.issuedAt) }),
    publicKey: { prefix: 4, x: toHex(x, { size: 32 }), y: toHex(y, { size: 32 }) },
    signature: assertion.signature,
    metadata: {
      authenticatorData: assertion.authenticatorData,
      clientDataJSON: assertion.clientDataJSON,
      userVerificationRequired: true,
    },
    origin,
    rpId: new URL(origin).hostname,
  })
  if (!signed) throw new RegistryError('Invalid passkey signature', 403)

  // 3. On-chain: this passkey controls the Key Safe, and the Key Safe owns the Account.
  if (await isDeployed(keySafe)) {
    const verifier = SafeAccount.createWebAuthnSignerVerifierAddress(x, y) as Address
    const owns = await publicClient.readContract({ address: keySafe, abi: safeAbi, functionName: 'isOwner', args: [verifier] })
    if (!owns) throw new RegistryError('This passkey does not own the Key Safe', 403)
  } else if (predictAddress({ x, y }).toLowerCase() !== keySafe.toLowerCase()) {
    throw new RegistryError('The Key Safe address does not match this passkey', 403)
  }
  if (getAddress(account) !== getAddress(keySafe)) {
    if (!(await isDeployed(account))) throw new RegistryError('The Account is not deployed yet', 409)
    const owns = await publicClient.readContract({ address: account, abi: safeAbi, functionName: 'isOwner', args: [keySafe] })
    if (!owns) throw new RegistryError('The Key Safe is not an owner of this Account', 403)
  }

  // 4. Store (one record per key) and burn the challenge.
  const now = Date.now()
  const previous = await store().get<WalletEntry>('wallets', clientId)
  const entry: WalletEntry = {
    clientId,
    displayName: displayName.trim(),
    maskedName: maskName(displayName),
    account: getAddress(account),
    keySafe: getAddress(keySafe),
    level: 1,
    registeredAt: previous?.registeredAt ?? now,
    updatedAt: now,
    publicKey,
    proof: { nonce, issuedAt: challenge.issuedAt, assertion },
  }
  await store().set('walletChallenges', nonce, { ...challenge, used: true })
  if (previous && previous.account !== entry.account) {
    await store().delete('walletByAccount', previous.account.toLowerCase())
  }
  await store().set('wallets', clientId, entry)
  await store().set('walletByAccount', entry.account.toLowerCase(), clientId)
  return toPublic(entry)
}

export async function unlinkWallet(clientId: string) {
  const entry = await store().get<WalletEntry>('wallets', clientId)
  if (!entry) return false
  await store().delete('walletByAccount', entry.account.toLowerCase())
  await store().delete('wallets', clientId)
  return true
}
