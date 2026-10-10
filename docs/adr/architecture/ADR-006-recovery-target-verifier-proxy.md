# ADR-006: Recovery target — the new passkey's verifier proxy, deployed in the request UserOp

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [ADR-002](ADR-002-passkey-signing-safe-webauthn.md), [ADR-005](ADR-005-social-recovery-module.md), [ADR-007](ADR-007-swissquote-guardian-and-relayer.md), [ADR-009](ADR-009-client-storage-public-data-only.md)

## Context

After a recovery, the Safe must accept signatures from the **new** passkey. The Safe verifies a contract owner by calling `isValidSignature` on that owner's address, so the new passkey's verifier proxy must exist on-chain before it signs anything.

## Decision

- `newOwners = [createWebAuthnSignerVerifierAddress(x', y')]` and `newThreshold = 1`.
- The relayer puts `createDeployWebAuthnVerifierMetaTransaction(x', y')` and `multiConfirmRecovery` in the **same UserOp**. Deploying the proxy through the factory is idempotent.
- The new device saves the new passkey's public key **before** sending the request (ADR-009).
- Once finalized, the new device signs with `isInit = false` through its proxy.

## Consequences

- ✅ The new device needs no on-chain action before taking control.
- ✅ Covered end to end by `npm run e2e:recovery`, where the new passkey signs a transaction after recovery.
