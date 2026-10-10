# PDR-002: Passkeys instead of seed phrases

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [ADR-001](../architecture/ADR-001-safe-smart-account.md), [ADR-002](../architecture/ADR-002-passkey-signing-safe-webauthn.md), [PDR-004](PDR-004-recovery-policy.md)

## Context

Seed phrases are the biggest source of bad UX and of lost funds in self-custody. Bank clients expect to authenticate with Face ID or Touch ID.

## Decision

The wallet is created and every transaction is signed with a **passkey** (Face ID / Touch ID / Windows Hello). Users never see a seed phrase.

## Consequences

- ✅ The private key is generated in the device's secure hardware and cannot be extracted. Biometric data never leaves the device. Swissquote only ever sees the public key.
- ✅ Wallet creation takes a few seconds and one biometric prompt.
- ⚠️ A passkey is bound to the domain it was created on (its rpId). The demo domain must be chosen early, and the mobile app must be linked to the same domain.
- ⚠️ Synced passkeys (iCloud Keychain / Google Password Manager) survive the loss of a device, but they trust the Apple or Google account. Device-bound passkeys don't sync, so recovery is needed. Both cases belong in the threat model.
- Passkeys sign with P-256, not Ethereum's curve, so a smart account is required (ADR-001, ADR-002).

## Alternatives considered

- **Seed phrase**: poor UX, and the main reason users lose funds.
- **Seed phrase split with SLIP-39 / Shamir**: better, but the user still has to manage the shares.
- **MPC with a share on the device**: complex, and hard to demonstrate.
- **Third-party embedded wallets**: adds trust in another provider.
