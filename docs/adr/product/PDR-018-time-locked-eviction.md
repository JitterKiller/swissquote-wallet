# PDR-018: Time-locked eviction — a stolen phone loses by default, not only with a hardware key

- **Status:** Proposed (accepted once the team agrees and spike C5 passes, see ADR-019)
- **Date:** 2026-10-10
- **Amends:** [PDR-014](PDR-014-separation-of-powers.md) (the phone-theft tie), [PDR-015](PDR-015-open-wallet-and-levels.md) (honest comparison), [PDR-017](PDR-017-theft-protection-hardware-key.md) (the hardware key becomes the *fast* eviction, not the only one)
- **Related:** [PDR-001](PDR-001-non-custodial-model.md), [PDR-013](PDR-013-key-management-user-majority.md), [PDR-016](PDR-016-recovery-kit-encrypted-cloud-backup.md), [PDR-019](PDR-019-offer-tiers.md), [ADR-017](../architecture/ADR-017-two-safe-account.md), [ADR-019](../architecture/ADR-019-account-eviction-module.md)

## Context

PDR-014 makes the passkey spend only up to a daily limit, and every other Account action requires 2 user factors. With only 2 factors (phone + Kit), a phone stolen together with its passcode is a **tie**:

- The thief keeps the Key Safe and draws the daily limit **every day**.
- The owner has only the Kit left, which is 1 factor of 2. They cannot move funds, cut the allowance or replace the Key Safe.
- The Key Safe recovery (PDR-004) does not help: the thief cancels it with the passkey alone.

The cap limits the **pace**, not the **total**. At 200 USDC a day, 10,000 USDC are gone in 50 days and the owner cannot stop it.

Only a hardware key (PDR-017) or an optional trusted contact breaks the tie. Most users will have neither, so the default story for a stolen phone would be a slow total loss. A bank cannot ship that default, and the jury's security criterion asks for a recovery that tells the owner from an attacker.

There is no free lunch. When the owner and the thief hold the same number of factors, only **time**, a **third party** or **one more factor** can decide. This record picks **time**, in favour of the factor that is hardest to steal.

## Decision

**Give the Recovery Kit a second, delayed power: evicting the Key Safe from the Account after a delay that only 2 factors can cancel.**

| | Level 0 (everyone) | Level 1 (linked client) | With a hardware key (PDR-017) |
|---|---|---|---|
| Who starts the eviction | The Kit (its guardian key) | The Kit + Swissquote after identity verification (PDR-006) | Kit + key, no delay |
| Delay | **7 days** | **3 days** | None |
| Who can cancel | 2 factors (Face ID + Kit, or Kit + key) | Same | — |
| Loss bound for a stolen phone | ≈ 7 days of limit (≈ 1,400 USDC at the default 200/day) | ≈ 3 days of limit | ≈ 1 day of limit |

- **The thief cannot cancel.** Cancelling is an Account transaction, which needs 2 of the user's factors, and the thief holds only one.
- **When the delay ends**, the stolen Key Safe is replaced by the new phone's Key Safe, and the daily allowance moves to it. The old passkey can no longer spend.
- **Swissquote is never decisive on its own.** At level 0 it plays no part. At level 1 it co-signs with the Kit, exactly like the Key Safe recovery (PDR-004), and it is never an owner (PDR-013).
- **The UI explains it plainly:**
  - "Phone stolen? Open the app on another device, enter your Kit passphrase: the stolen phone is locked out in 7 days (3 days for Swissquote clients, immediately with Theft protection)."
  - Every channel alerts the owner as soon as an eviction starts. If it wasn't them, they cancel with Face ID + the Kit.
- **It replaces nothing:**
  - the Key Safe recovery (PDR-004 / PDR-015) still covers a lost phone without changing the Account;
  - the hardware key stays the instant eviction;
  - a trusted contact can still be added as an extra guardian.

## Consequences

- ✅ The default answer to a stolen phone becomes "locked out after the delay, loss bounded", instead of "drained over time".
- ✅ There is still a reason to upgrade:
  - level 1 shortens the delay and adds an identity check;
  - "Theft protection" makes the eviction immediate and insures the capped loss (PDR-019).

  Swissquote sells speed, comfort and insurance, not the basic fix.
- ✅ Same principle as the time-locked recovery path we plan for Bitcoin (PDR-013, Liana-style miniscript).
- ⚠️ During the delay the thief keeps drawing the daily limit. Spike C5 shows it. A lower limit means a smaller loss.
- ⚠️ **Stolen Kit** (file + cracked passphrase) at level 0: the attacker can start an eviction. The owner must cancel with 2 factors within 7 days. This adds no new risk: today at level 0 a stolen Kit can already recover the Key Safe in 7 days, and Key Safe + Kit is full control. At level 1, Swissquote's identity check stops it.
- ⚠️ **Lost Kit and stolen phone** at the same time: no path without a hardware key or contact. That's the rule of three places.
- ⚠️ Level 1 Account settings (switching to the 3-day module, adding Swissquote) need 2 factors (Face ID + Kit), not one passkey signature.

## Alternatives considered

- **Keep the tie and sell the hardware key as the only answer:** turns basic security into an upsell, a bad message for a bank and for the security score.
- **Swissquote alone as arbiter after a delay:** conditional control, rejected by PDR-013 and PDR-014.
- **Cut the allowance automatically when an eviction starts (Bitkey):** needs a custom contract (open question in the index).
- **Make a trusted contact mandatory:** too much friction for a first wallet (PDR-015).
