import {
  webauthnSignatureFromAssertion,
  type WebauthnPublicKey,
  type WebauthnSignatureData,
} from 'abstractionkit'
import { Hex, WebAuthnP256 } from 'ox'

/**
 * Passkeys (WebAuthn, P-256).
 *
 * The private key is generated inside the device's secure hardware (Secure
 * Enclave / TPM) and never leaves it. Touch ID / Face ID only unlocks it.
 * We only ever see the public key (stored as the Safe owner) and signatures.
 */

export type Passkey = {
  credentialId: string
  publicKey: WebauthnPublicKey
}

export async function createPasskey(userName: string): Promise<Passkey> {
  const credential = await WebAuthnP256.createCredential({
    name: userName,
    rp: { id: window.location.hostname, name: 'SQure' },
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  })
  return {
    credentialId: credential.id,
    publicKey: {
      x: BigInt(credential.publicKey.x),
      y: BigInt(credential.publicKey.y),
    },
  }
}

/**
 * Biometric prompt → raw WebAuthn assertion over `challenge`, for proofs checked by
 * the backend (registry, ADR-021) rather than on-chain.
 */
export async function assertWithPasskey(credentialId: string, challenge: Hex.Hex) {
  const { metadata, signature } = await WebAuthnP256.sign({
    credentialId,
    challenge,
    rpId: window.location.hostname,
    userVerification: 'required',
  })
  return {
    authenticatorData: metadata.authenticatorData,
    clientDataJSON: metadata.clientDataJSON,
    signature: { r: signature.r, s: signature.s },
  }
}

/** Biometric prompt → WebAuthn assertion over `challenge` (a UserOp hash). */
export async function signWithPasskey(
  credentialId: string,
  challenge: Uint8Array,
): Promise<WebauthnSignatureData> {
  const { metadata, signature } = await WebAuthnP256.sign({
    credentialId,
    challenge: Hex.fromBytes(challenge),
    rpId: window.location.hostname,
    userVerification: 'required',
  })
  return webauthnSignatureFromAssertion({
    authenticatorData: metadata.authenticatorData,
    clientDataJSON: metadata.clientDataJSON,
    signature: { r: BigInt(signature.r), s: BigInt(signature.s) },
  })
}
