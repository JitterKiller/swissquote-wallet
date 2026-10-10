# PDR-006: Identity verification before Swissquote approves a recovery

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-004](PDR-004-recovery-policy.md), [ADR-007](../architecture/ADR-007-swissquote-guardian-and-relayer.md), [ADR-008](../architecture/ADR-008-mock-backend.md)

## Context

A bonus criterion asks for a recovery flow that tells a legitimate user apart from an attacker who has compromised their phone or email. Swissquote's unique asset is its **KYC record** of every client.

## Decision

The Swissquote Guardian approves a recovery only if all of the following hold:

1. **Identity verification passed.** In production: video identification with a liveness check against the KYC record (FINMA Circular 2016/7), e-banking login with the existing 2FA, and optionally a code sent by post. Email or SMS is **never** enough.
2. The **Recovery Kit signature** is valid, and the Kit is a registered guardian of that wallet.
3. **No recovery is already pending.**

The client is alerted on every channel (push, email, SMS, e-banking) for every attempt, successful or not.

**Demo:** KYC is mocked. The UI offers "Start video identification" (legitimate) and "Demo: simulate an attacker" (verification fails, Swissquote refuses to sign).

## Consequences

- ✅ An attacker with the phone, the email and the SIM still fails the liveness check. Even with the Kit, the owner can still cancel during the delay.
- ✅ Builds on a regulatory process Swiss banks already run.
- ⚠️ Mocked in the prototype (PDR-007). The mock endpoints have no authentication.

## Alternatives considered

- **Email or SMS one-time codes**: defeated by SIM swap or email takeover.
- **Security questions**: weak.
- **No Swissquote involvement**: loses the bank's main advantage.
