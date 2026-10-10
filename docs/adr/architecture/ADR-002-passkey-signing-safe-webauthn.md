# ADR-002: Passkey signing through Safe's WebAuthn signer

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-002](../product/PDR-002-passkeys-instead-of-seed-phrases.md), [ADR-001](ADR-001-safe-smart-account.md), [ADR-006](ADR-006-recovery-target-verifier-proxy.md)

## Context

Passkeys sign with P-256 (secp256r1). Ethereum only verifies secp256k1 natively, so passkey signatures have to be checked by a contract.

## Decision

- **WebAuthn ceremonies** run through **`ox`**: `WebAuthnP256.createCredential` (resident key and user verification required) and `WebAuthnP256.sign` (with the credential ID). The rpId is `window.location.hostname`.
- **Signature adaptation** uses `abstractionkit`'s `fromSafeWebauthn` and `webauthnSignatureFromAssertion`. `expectedSigners: [publicKey]` is passed to `createUserOperation` so gas is estimated for a WebAuthn signature.
- **Deployment UserOp** (`isInit = true`): the Safe uses Safe's **shared WebAuthn signer**. The same op deploys the passkey's **deterministic verifier proxy** and swaps it in as owner.
- **Later UserOps** (`isInit = false`) are verified through that proxy.
- **Verification** uses Base's RIP-7212 P-256 precompile, with the FCL contract verifier as fallback (abstractionkit defaults).

## Consequences

- A passkey's Safe owner address is `createWebAuthnSignerVerifierAddress(x, y)`. Recovery relies on this (ADR-006).
- ⚠️ Since `ox` 1.x, key coordinates and signature values are hex strings. Convert them to `bigint` before handing them to abstractionkit.
- ⚠️ Passkeys are bound to the domain (rpId) they were created on.
- ✅ Tested against real Chrome WebAuthn output (virtual authenticator) and verified on-chain (ADR-012).

## Alternatives considered

- **viem's WebAuthn account**: tied to Coinbase Smart Wallet (rejected in ADR-001).
- **Raw `navigator.credentials`**: more parsing code (DER signatures, COSE keys) to write and maintain ourselves.
