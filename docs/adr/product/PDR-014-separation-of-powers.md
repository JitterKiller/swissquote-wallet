# PDR-014: Separation of powers — the passkey is no longer root

- **Status:** Accepted, amended by [PDR-018](PDR-018-time-locked-eviction.md) (the phone-theft tie is broken by a time-locked eviction), [PDR-020](PDR-020-daily-limit-chosen-by-user.md) (limit chosen by the user) and [PDR-021](PDR-021-one-flow-lost-or-stolen-phone.md) (one flow for a lost or stolen phone)
- **Date:** 2026-10-10
- **Supersedes:** [PDR-011](PDR-011-vault-daily-limit.md) (two pockets: the whole account is now protected)
- **Amends:** [PDR-004](PDR-004-recovery-policy.md) (that recovery now protects the Key Safe), [PDR-009](PDR-009-feature-priorities.md) (build order below)
- **Related:** [PDR-001](PDR-001-non-custodial-model.md), [PDR-013](PDR-013-key-management-user-majority.md), [PDR-015](PDR-015-open-wallet-and-levels.md), [PDR-016](PDR-016-recovery-kit-encrypted-cloud-backup.md), [PDR-017](PDR-017-theft-protection-hardware-key.md), [ADR-017](../architecture/ADR-017-two-safe-account.md)

## Context

Today the Safe has a single owner, the passkey, and that owner is **root**:

- In the deployed Candide recovery module (v0.0.1), `cancelRecovery`, `addGuardianWithThreshold`, `revokeGuardianWithThreshold` and `changeThreshold` only check `msg.sender == wallet`. One passkey signature is enough for each.
- The passkey can also disable the recovery module or add its own key as an owner.
- Our Safe (L2 v1.4.1) does not run transaction guards on module transactions, and every UserOp goes through the 4337 module. A blocking guard would need Safe 1.5.0 and custom Solidity.

So recovery protects against **loss** of the phone, not **theft**. Whoever can produce a passkey signature can empty the wallet and cancel every recovery, forever. That includes a thief who watched the phone's passcode, someone who took over the iCloud or Google account holding a synced passkey, and a compromised front-end that makes the user sign something else. PDR-011's vault had the same flaw: its owners included the Spending Safe, so a thief could draw the daily limit indefinitely and the owner could not stop it.

## Decision

**Three powers, held by different parties:**

| Power | Who | Examples |
|---|---|---|
| Spend daily | **1 factor**: Face ID, up to a daily limit | Pay 50 USDC |
| Administer | **2 of the user's own factors** | Large payment, change the limit, replace a factor, cancel a recovery, touch guardians |
| Arbitrate | Third parties (guardians), after a delay, only when the user has fewer than 2 factors, cancellable with 2 factors | Optional trusted contact |

**Structure** (implementation: ADR-017):

- **Account:** the address that receives and holds **all** funds. Its owners are **only the user's factors**: the Key Safe (phone passkey), the Recovery Kit (PDR-016) and, optionally, a hardware key (PDR-017). Threshold 2. **Swissquote is never an owner.**
- **Key Safe:** the current passkey Safe, recycled. It holds no funds. It counts as one owner of the Account and holds the daily allowance. It keeps its current recovery (PDR-004, PDR-015) for device loss.
- **Daily limit:** chosen by the user, changed only with 2 factors. Defaults per level are in PDR-015.
- **Above the limit, or any setting:** Face ID + the Kit passphrase, or Face ID + a hardware key tap.
- **Breaking a tie after phone theft:** the hardware key (immediate eviction, PDR-017) or an optional trusted contact as Account guardian (after a delay). Without either, the app shows the residual risk.
- **Rule of three places:** phone in the pocket, hardware key at home, Kit passphrase in the user's head. The app says so at setup.

**Scenarios:**

| Scenario | 2 factors (phone + Kit) | 3 factors (+ hardware key) |
|---|---|---|
| Phone lost | Key Safe recovery (PDR-004 / PDR-015). The Account does not change. | Same, or Kit + key at once |
| Phone stolen and unlocked | Thief limited to the daily limit. Cannot change rules or block anything on the Account. **Tie**: the drain is capped but ongoing, unless a trusted contact arbitrates. | Kit + key **evict the thief immediately**. Loss ≈ one day's limit. |
| Kit lost (forgotten passphrase) | Only the daily limit remains: slow exit to a new wallet | Phone + key replace the Kit at once |
| Kit stolen | Useless alone. At level 0 it can start a Key Safe recovery that the owner must cancel (PDR-015). | Phone + key replace the Kit |
| Two factors stolen together | Full control | Full control (rule of three places) |
| Swissquote malicious or compromised | Can do nothing: never an owner | Same |

**Build order (amends PDR-009):**

1. ADR-017 spike (2 hours max). It goes first because the registry, `@handle`s and the account ↔ wallet transfer must point to the **Account** address.
2. Wallet registry.
3. Transfer between the Swissquote account and the wallet.
4. Account Safe + daily limit + encrypted Kit (ADR-017, ADR-018) + levels (PDR-015).
5. `@handle` transfers (PDR-010).
6. Compliance layer.
7. Hardware key + guided "phone stolen" flow (PDR-017).
8. Trusted contact as Account guardian (optional).

## Consequences

- ✅ A thief with the unlocked phone can no longer empty the account, change its rules or block anything on the Account.
- ✅ Same structure as Bitkey (phone capped, other factors for the rest), but **every key belongs to the user**.
- ✅ Verifiable on-chain: the Account's owners are only the user's addresses.
- ⚠️ With 2 factors and no arbiter, a stolen phone is a tie: the loss is capped per day but ongoing.
- ⚠️ Losing the Kit without a hardware key leaves only the daily limit (slow exit).
- ⚠️ The allowance is not cut automatically when a recovery starts. Bitkey does this, but here it would need a custom contract.
- ⚠️ Large payments need the second factor. More friction, by design.

## Alternatives considered

- **Accept and document the risk:** today a stolen unlocked phone means everything is lost, and recovery can be blocked.
- **Swissquote as a co-owner (2-of-3 with Swissquote):** contradicts self-custody, the very point of the challenge.
- **Swissquote as sole arbiter:** if the client does not react within the delay, Swissquote takes over. Rejected.
- **A second paper Kit ("Kit B") as co-guardian with Swissquote:** too complex for users.
- **Custom guard on Safe 1.5.0:** custom security-critical Solidity (ADR-011).
- **Two pockets (PDR-011):** superseded. The thief kept drawing the limit and the owner could not stop it.
