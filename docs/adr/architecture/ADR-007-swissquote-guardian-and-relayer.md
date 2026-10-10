# ADR-007: Swissquote Guardian key and relayer (mock HSM)

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-006](../product/PDR-006-identity-verification-before-guardian-approval.md), [ADR-005](ADR-005-social-recovery-module.md), [ADR-006](ADR-006-recovery-target-verifier-proxy.md), [ADR-008](ADR-008-mock-backend.md)

## Context

The Swissquote Guardian must sign recovery approvals on the server, after its checks pass (PDR-006). Someone also has to submit the recovery transactions, because the new device owns nothing on-chain yet.

## Decision

- **Guardian key:** read from `SWISSQUOTE_GUARDIAN_PRIVATE_KEY`. If that is unset, a key is generated once and stored in `web/.data/db.json`. The guardian signs the EIP-712 message on the server (`web/src/server/guardian.ts`).
- **Relayer:** a Swissquote "operations" Safe owned by the guardian key. It submits the request (`multiConfirmRecovery` plus the proxy deployment) and the `finalizeRecovery` call as **sponsored UserOps**.

## Consequences

- ✅ There is no ETH to manage, and the recovery flow is gasless for the client.
- ⚠️ Each machine has its **own** guardian key unless the environment variable is shared. A wallet protected through one backend can only be recovered through that backend, so the team must share the key and the demo must use a fixed one.
- Production: the key lives in an HSM, the relayer key is separate from the guardian key (separation of duties), and actions are audit-logged.

## Alternatives considered

- **Relayer as a plain account (EOA) funded with ETH**: means topping it up from faucets.
- **New device submits the transactions itself**: it has no account or gas yet.
