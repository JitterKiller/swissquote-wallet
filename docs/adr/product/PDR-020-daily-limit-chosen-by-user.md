# PDR-020: The daily limit is chosen by the user, with the same rules at every level

- **Status:** Accepted
- **Date:** 2026-10-10
- **Amends:** [PDR-014](PDR-014-separation-of-powers.md) (no defaults per level), [PDR-015](PDR-015-open-wallet-and-levels.md) (no limit per level), [PDR-017](PDR-017-theft-protection-hardware-key.md) (no "higher daily limit" perk)
- **Related:** [PDR-018](PDR-018-time-locked-eviction.md), [PDR-019](PDR-019-offer-tiers.md), [ADR-017](../architecture/ADR-017-two-safe-account.md)

## Context

PDR-015 set default limits per level (200 USDC a day at level 0, 1,000 at level 1), and PDR-017 offered a higher limit as a perk. Combined with the eviction delays of PDR-018, a linked client could lose more than a level 0 user in absolute terms: 1,000 × 3 days = 3,000, against 200 × 7 days = 1,400.

A spending limit is a personal setting that depends on someone's spending habits. It is not a product tier.

## Decision

- **The user chooses the daily limit, at any level**, when setting up the wallet. No level or offer sets or unlocks a limit.
- **The setup screen suggests a starting value** (500 USDC a day, the same for everyone). It shows the user's own loss bound: "If your phone is stolen, a thief can take at most about *limit × days*". The days are 7 at level 0, 3 at level 1, and about 1 with a hardware key (PDR-018).
- **Changing the limit, up or down, needs 2 factors.** `setAllowance` can only be called by the Account (ADR-017).
- **The offers (PDR-019) sell delay, insurance, comfort and assistance**, never a limit.

## Consequences

- ✅ One rule for everyone, simple to explain.
- ✅ The loss bound is the user's own trade-off, shown as an amount.
- ⚠️ Lowering the limit in a hurry, for example right after noticing a theft, also needs 2 factors. The eviction (PDR-018) is the answer to a theft.
- ⚠️ A high limit means a high loss bound. The UI must make that visible.

## Alternatives considered

- **Defaults per level (PDR-015):** inconsistent loss bounds, and it mixes a product tier with a personal setting.
- **Higher limit as a Premium perk (PDR-017):** sells more risk, not more protection.
