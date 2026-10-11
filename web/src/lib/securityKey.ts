import { SafeMultiChainSigAccountV1 as SafeAccount, webauthnSignatureFromAssertion, type MetaTransaction } from 'abstractionkit'
import { WebAuthnP256 } from 'ox'
import type { Address, Hex } from 'viem'

import { api } from './api'
import { DEMO_ANY_AUTHENTICATOR } from './config'
import type { SecurityKeyRecord } from './storage'

/**
 * The security key (#17, PDR-017, ADR-038): a WebAuthn credential that becomes the Account's third
 * owner through Safe's WebAuthn verifier proxy (as the passkey does for the Key Safe, ADR-002). With
 * the Kit it signs Account transactions as an EIP-1271 contract signature: the spike C4b proved the
 * immediate lock-out on Base Sepolia.
 */

export type NewSecurityKey = { credentialId: string; publicKey: { x: bigint; y: bigint }; proxy: Address }

/** The key's verifier proxy: the address that becomes an owner of the Account. */
export const keyProxyAddress = (x: bigint, y: bigint) => SafeAccount.createWebAuthnSignerVerifierAddress(x, y) as Address

/** Deploys the verifier proxy (a security operation, sponsored); a no-op address check is up to the caller. */
export const deployKeyProxyCall = (key: Pick<NewSecurityKey, 'publicKey'>): MetaTransaction =>
  SafeAccount.createDeployWebAuthnVerifierMetaTransaction(key.publicKey.x, key.publicKey.y)

/**
 * Registers a key. Production asks for a roaming authenticator; the demo accepts any
 * (DEMO_ANY_AUTHENTICATOR), but never the authenticator that holds this phone's passkey: it is excluded,
 * so the phone can't become its own second factor (PDR-017). The key is discoverable, so a new device
 * can find it even without its credential id.
 */
export async function createSecurityKey(label: string, phoneCredentialId: string): Promise<NewSecurityKey> {
  const credential = await WebAuthnP256.createCredential({
    name: `${label} · security key`,
    rp: { id: window.location.hostname, name: 'SQure' },
    excludeCredentialIds: [phoneCredentialId],
    authenticatorSelection: {
      ...(DEMO_ANY_AUTHENTICATOR ? {} : { authenticatorAttachment: 'cross-platform' as const }),
      residentKey: 'required',
      userVerification: 'required',
    },
  })
  const x = BigInt(credential.publicKey.x)
  const y = BigInt(credential.publicKey.y)
  return { credentialId: credential.id, publicKey: { x, y }, proxy: keyProxyAddress(x, y) }
}

/**
 * The key's approval of an Account transaction: a WebAuthn assertion over the Safe digest, encoded as
 * the verifier proxy's contract signature. Without `credentialId`, the authenticator offers its keys.
 */
export async function signWithSecurityKey(digest: Hex, credentialId?: string): Promise<Hex> {
  const { metadata, signature } = await WebAuthnP256.sign({
    ...(credentialId ? { credentialId } : {}),
    challenge: digest,
    rpId: window.location.hostname,
    userVerification: 'required',
  })
  return SafeAccount.createWebAuthnSignature(
    webauthnSignatureFromAssertion({
      authenticatorData: metadata.authenticatorData,
      clientDataJSON: metadata.clientDataJSON,
      signature: { r: BigInt(signature.r), s: BigInt(signature.s) },
    }),
  ) as Hex
}

/** A key prompt that failed, in words: the authenticator holding this phone's passkey is refused on purpose. */
export function keyErrorMessage(error: unknown) {
  const name = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  if (/InvalidStateError|excluded|already registered/i.test(name)) return 'This device can’t be your key: it already holds this wallet’s passkey. Use another device.'
  if (/NotAllowedError|not allowed|AbortError|timed out/i.test(name)) return 'The key didn’t answer. Try again, and approve on the key.'
  return error instanceof Error ? error.message : String(error)
}

/** The Account's key in Swissquote's directory (public data), so a new device can ask for the right credential. */
export const registerSecurityKey = (record: SecurityKeyRecord) => api<SecurityKeyRecord>('/api/security-keys', record)
export const findSecurityKey = (account: Address) =>
  api<SecurityKeyRecord>(`/api/security-keys?account=${encodeURIComponent(account)}`).catch(() => null)
