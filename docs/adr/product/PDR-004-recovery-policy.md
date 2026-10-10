# PDR-004: Recovery policy — Recovery Kit + Swissquote, 2 of 2, delay with owner veto

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-001](PDR-001-non-custodial-model.md), [PDR-005](PDR-005-recovery-kit.md), [PDR-006](PDR-006-identity-verification-before-guardian-approval.md), [ADR-005](../architecture/ADR-005-social-recovery-module.md), [ADR-006](../architecture/ADR-006-recovery-target-verifier-proxy.md)

## Context

The challenge requires a client who has lost access to be able to recover. The recovery must not open an easy path for attackers, and must not give Swissquote control (PDR-001).

## Decision

- **Guardians:** the client's **Recovery Kit** and the **Swissquote Guardian**. **Both** must approve (threshold 2 of 2).
- **Delay:** once approved, a recovery waits **3 minutes in the demo** (at least 3 days in production). During that time the current owner can **cancel** it from their device.
- **Effect:** the owner is replaced by a **new passkey** on the **same wallet** (same address, same funds). The guardians stay in place afterwards.

## Consequences

- ✅ Swissquote alone can never recover a wallet.
- ✅ To succeed, an attacker needs the Recovery Kit, must pass Swissquote's identity check, and must hope the owner does not cancel during the delay.
- ⚠️ Losing both the device and the Recovery Kit means losing the wallet. That is the price of self-custody. Mitigation under consideration: a third guardian, making it 2 of 3 (see the open questions in the index).
- ⚠️ A legitimate recovery takes days in production because of the delay. This is the trade-off for the owner's veto.

## Alternatives considered

- **Swissquote alone can recover**: custodial.
- **Seed-phrase backup**: see PDR-002.
- **Friends-only social recovery**: guardians are unreliable and coordinating them is painful.
- **2 of 3 with a third guardian**: planned as the next step.
