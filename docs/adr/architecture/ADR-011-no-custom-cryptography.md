# ADR-011: No custom cryptography

- **Status:** Accepted
- **Date:** 2026-10-10

## Context

The challenge explicitly asks teams to use established cryptographic libraries and SDKs rather than implementing their own. Homemade crypto is also the easiest way to lose the security score.

## Decision

Every cryptographic primitive comes from:

- **Audited contracts:** Safe, the Safe passkey (WebAuthn) module, Candide's Social Recovery Module;
- **Established libraries:** `abstractionkit`, `ox` (WebAuthn), `viem` (ECDSA, EIP-712, hashing).

## Consequences

- Any new cryptographic need starts with finding an existing library or contract, recorded in a new ADR.
- Our own code stays limited to orchestration (UserOps, flows, UI) and policy (mock KYC checks).
