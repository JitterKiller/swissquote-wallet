# PDR-007: Prototype scope — real on-chain, mocked banking

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [ADR-008](../architecture/ADR-008-mock-backend.md)

## Context

Time is limited. The challenge allows mocking banking infrastructure, compliance providers and key-share servers, provided the distinction is clearly documented and the architecture remains credible.

## Decision

- **Real** (Base Sepolia testnet): passkeys, the Safe smart account, the ERC-4337 bundler and paymaster, USDC transfers, the Social Recovery Module (guardians, delay, cancel, finalize), and EIP-712 guardian signatures.
- **Mocked:** the Swissquote banking account, KYC / video identification, the guardian HSM, notifications, and postal mail.
- Every mock is labelled **MOCK**: in code comments, and in the UI with a badge wherever the user would see it. The README has a "Real vs mocked" table.

## Consequences

- ✅ The demo signs and sends real transactions, and every security property is enforced on-chain.
- ⚠️ The README table must stay up to date whenever a mock is added or replaced.
