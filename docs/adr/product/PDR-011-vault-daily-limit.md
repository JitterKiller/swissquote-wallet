# PDR-011: Vault with a daily limit — protect funds, not only access

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-001](PDR-001-non-custodial-model.md), [PDR-004](PDR-004-recovery-policy.md), [PDR-005](PDR-005-recovery-kit.md), [PDR-009](PDR-009-feature-priorities.md), [ADR-013](../architecture/ADR-013-vault-allowance-module.md)

## Context

The wallet's Safe has a single owner, the passkey. Whoever obtains a passkey signature can empty the wallet at once:

- a thief who steals the phone after watching its passcode (the passcode can replace Face ID for passkeys);
- someone who takes over the iCloud or Google account a synced passkey lives in;
- a compromised front-end (XSS, malicious dependency) that makes the user sign a draining transaction behind an ordinary Face ID prompt.

Recovery (PDR-004) gives access back after a delay of at least 3 days in production, but it does not protect the funds in the meantime. PDR-001 forbids a Swissquote veto, so the protection has to be a rule the client sets for themselves.

## Decision

- **Two pockets:**
  - **Spending:** the existing wallet. Passkey only, instant.
  - **Vault:** savings.
- From the Vault, the passkey alone can move up to a **daily limit** set by the client (demo: 1,000 USDC per 24 hours), to the Spending pocket or directly to a recipient.
- Moving more than the limit, **changing the limit** or changing the Vault's owners requires a **second factor held by the client**.
  - Demo: the Recovery Kit.
  - Production: a passkey on a second device, or a hardware key.
- Swissquote has **no role** in the Vault: no key, no veto (PDR-001).
- UI copy: "Vault: up to 1,000 USDC a day with Face ID. More needs your second factor."
- Implementation: ADR-013.

## Consequences

- ✅ Stolen unlocked phone: the thief can take at most the Spending balance, plus one daily limit per day until the recovery revokes the old passkey.
- ✅ Familiar to bank clients (card and e-banking limits). Precedents in crypto: Argent's daily transfer limit, Bitkey's Mobile Pay.
- ✅ Consistent with PDR-001: the limit is the client's own rule, enforced by the contract.
- ✅ Answers the "compromised phone" row of the threat model with a mechanism, not just alerts.
- ⚠️ Large transfers need the second factor. More friction, by design.
- ⚠️ In the demo the Recovery Kit doubles as the second factor, so it leaves offline storage more often. Production should use a separate factor.
- ⚠️ Second factor lost: the Vault stays reachable at the pace of the daily limit, never locked but slow. Rotating the second factor needs a follow-up decision.
- ⚠️ If the spike in ADR-013 fails, the vault becomes a residual-risk row with its planned mitigation in the threat-model slide (PDR-009 cut line).

## Alternatives considered

- **Swissquote co-signs above the limit:** a Swissquote veto, rejected by PDR-001.
- **Limit enforced off-chain by the paymaster refusing to sponsor:** bypassed by an attacker who sends ETH to the Safe and pays the gas.
- **Time-locked withdrawals that the owner can cancel:** cancelling needs a key the thief does not have, and adds contracts (see ADR-013).
- **No vault, rely on recovery:** the funds are gone before the recovery completes.
