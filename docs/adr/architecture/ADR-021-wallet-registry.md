# ADR-021: Wallet registry — EIP-712 statement signed by the passkey, verified with `ox` and on-chain owner checks

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-022](../product/PDR-022-wallet-registry-ownership-proof.md), [ADR-002](ADR-002-passkey-signing-safe-webauthn.md), [ADR-011](ADR-011-no-custom-cryptography.md), [ADR-017](ADR-017-two-safe-account.md), [ADR-020](ADR-020-deployment-vercel-upstash.md)

## Context

PDR-022 needs a proof that a client controls an Account. It must use established libraries (ADR-011) and the async store (ADR-020).

## Decision

- **Statement (EIP-712):**
  - domain `{ name: "Swissquote Wallet Registry", version: "1", chainId }`;
  - type `OwnershipProof { string client; address account; address keySafe; bytes32 nonce; uint64 issuedAt }`.

  Its `hashTypedData` is the WebAuthn challenge.
- **Client** (`web/src/lib/registry.ts`): `linkWallet({ clientId, displayName, wallet })`:
  1. `POST /api/wallets/challenge` returns the nonce and `issuedAt`;
  2. the passkey signs the typed-data hash (Face ID);
  3. `POST /api/wallets` with the public key and the WebAuthn assertion (`authenticatorData`, `clientDataJSON`, `r`, `s`).
- **Server** (`web/src/server/registry.ts`, routes `web/src/app/api/wallets/*`):
  1. Challenge: exists, unused, under 10 minutes old, and issued for the same client and Account.
  2. `WebAuthnP256.verify` (ox) with `userVerificationRequired: true`, plus the **origin** and **rpId** of the request.
  3. Key Safe:
     - if deployed, `isOwner(verifierProxy(x, y))`, where the verifier proxy is `createWebAuthnSignerVerifierAddress` (abstractionkit);
     - otherwise `predictAddress(publicKey) == keySafe`.
  4. Account: equal to the Key Safe (legacy single-Safe wallets, before ADR-017 ships), or `isOwner(keySafe)` on the deployed Account.
  5. Store the entry and mark the challenge used.
- **Store collections:**
  - `wallets` (client id → entry);
  - `walletByAccount` (lowercase Account → client id);
  - `walletChallenges` (nonce → challenge).
- **Server functions for other issues:** `getWalletByClient(clientId)`, `getWalletByAccount(account)` (#19, #20, #21, #23).
- **Endpoints:**
  - `POST /api/wallets/challenge`;
  - `POST /api/wallets`;
  - `GET /api/wallets/me?clientId=`;
  - `DELETE /api/wallets/me?clientId=`.

  All are **MOCK-authenticated**: the client id is given by the caller until the mock Swissquote session (#21) provides it.

## Consequences

- ✅ Only established libraries: viem (EIP-712), ox (WebAuthn), abstractionkit (verifier proxy address).
- ✅ The origin and rpId checks stop a proof signed on another site from being replayed here.
- ⚠️ The endpoints trust the caller's client id (mock). In production, this comes from the authenticated e-banking session.
- ⚠️ Checking the Account owners needs the Account deployed. Before ADR-017 ships, the Account is the legacy wallet itself.

## Alternatives considered

- **EIP-1271 on the Key Safe:** the 4337 Safe has no EIP-1271 fallback handler configured in our setup.
- **Kit ECDSA signature:** the Kit is for rare operations (PDR-016), and a proof should cost one Face ID.
