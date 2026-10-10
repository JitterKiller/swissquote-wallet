# ADR-005: Recovery mechanism — Candide Social Recovery Module v0.0.1

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-004](../product/PDR-004-recovery-policy.md), [ADR-006](ADR-006-recovery-target-verifier-proxy.md), [ADR-007](ADR-007-swissquote-guardian-and-relayer.md)

## Context

PDR-004 requires guardians, a threshold, a delay and cancellation by the owner, all enforced on-chain, without writing our own security-critical contract.

## Decision

- **Module:** Candide's audited, already-deployed Social Recovery Module. The demo uses `SocialRecoveryModuleGracePeriodSelector.After3Minutes` (`0x949d01d424bE050D09C16025dd007CB59b3A8c66`). Production would use `After3Days` (`0x38275826E1933303E508433dD5f289315Da2541c`) or longer. The choice is the constant `RECOVERY_MODULE_ADDRESS` in `web/src/lib/config.ts`.
- **Setup** is one passkey-signed UserOp: `enableModule` + `addGuardianWithThreshold(kit, 1)` + `addGuardianWithThreshold(swissquote, 2)`.
- **Recovery:**
  1. Each guardian signs the EIP-712 `ExecuteRecovery` message (domain "Social Recovery Module", version `0.0.1`).
  2. `multiConfirmRecovery(..., execute = true)` records both approvals and starts the delay.
  3. After the delay, `finalizeRecovery`. Anyone can call it.
- **Cancel:** `cancelRecovery()`, called by the Safe itself in a passkey-signed UserOp.
- Shared helpers live in `web/src/lib/recovery.ts`.

## Consequences

- ⚠️ **Gotcha:** the deployed module is **v0.0.1**, and abstractionkit targets it. The `main` branch of `candidelabs/candide-contracts` is v0.2.0, with a different ABI (for example an extra `_nonce` argument). Never copy ABIs from GitHub `main`.
- The delay is fixed per module deployment. Changing it means a different module address, so existing wallets must be set up again.
- Only one recovery can be pending at a time. Replacing it requires more approvals. A guardian cannot become an owner.

## Alternatives considered

- **Writing our own module**: audit risk.
- **Zodiac Delay modifier + a custom flow** (the Safe Recovery Hub pattern): more moving parts.
