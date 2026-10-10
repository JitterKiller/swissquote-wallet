# PDR-001: Non-custodial model — Swissquote is a guardian, never a custodian

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-004](PDR-004-recovery-policy.md), [PDR-006](PDR-006-identity-verification-before-guardian-approval.md), [ADR-005](../architecture/ADR-005-social-recovery-module.md)

## Context

The challenge asks for the self-custody wallet Swissquote could launch: "their keys, their control", with a recovery mechanism that does not give Swissquote unintended control over client funds. Under Swiss law, whether a service counts as custody depends on its **power of disposal** over the assets.

## Decision

- Only the client's passkey can move funds.
- Swissquote holds one **guardian** key. It can only take part in a recovery, together with another guardian, after a delay the client can veto.
- No admin keys, no co-signer Swissquote controls on its own, no upgrade keys held by Swissquote.

## Consequences

- ✅ Legal argument: Swissquote has no power of disposal, so this is not custody. That means no balance-sheet exposure, no crypto custody capital charges, and nothing in the bankruptcy estate. Swissquote acts as a software provider and a recovery guardian.
- ✅ Clients keep control, even if Swissquote disappears.
- ⚠️ Swissquote cannot freeze or claw back funds. Compliance features must add **friction, not a veto**.
- ⚠️ If a client loses every recovery factor, Swissquote cannot help on its own.

## Alternatives considered

- **Custodial account** (status quo): exactly what clients leave Swissquote to avoid.
- **Swissquote co-signs every transaction** (2-of-2 "collaborative custody"): Swissquote could censor transactions, which arguably amounts to control.
- **MPC with Swissquote holding enough shares to sign**: custody in disguise.
