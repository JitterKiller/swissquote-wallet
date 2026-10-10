# PDR-021: One flow for a lost or stolen phone — the Account eviction

- **Status:** Accepted
- **Date:** 2026-10-10
- **Supersedes:** [PDR-004](PDR-004-recovery-policy.md) in the target design. The current code still runs the Key Safe recovery until the eviction UI ships.
- **Amends:** [PDR-014](PDR-014-separation-of-powers.md) ("phone lost" row), [PDR-015](PDR-015-open-wallet-and-levels.md) (Key Safe recovery rows)
- **Related:** [PDR-006](PDR-006-identity-verification-before-guardian-approval.md), [PDR-016](PDR-016-recovery-kit-encrypted-cloud-backup.md), [PDR-018](PDR-018-time-locked-eviction.md), [ADR-005](../architecture/ADR-005-social-recovery-module.md), [ADR-006](../architecture/ADR-006-recovery-target-verifier-proxy.md), [ADR-017](../architecture/ADR-017-two-safe-account.md), [ADR-019](../architecture/ADR-019-account-eviction-module.md)

## Context

With PDR-018, two paths would coexist:

- the **Key Safe recovery** (PDR-004, ADR-005), for a lost phone;
- the **Account eviction** (PDR-018, ADR-019), for a stolen phone.

| | Two paths | One path: the Account eviction |
|---|---|---|
| Lost phone | ✅ Key Safe recovery | ✅ Eviction (nobody cancels) |
| Stolen phone | ✅ Eviction. Picking the Key Safe recovery by mistake fails: the thief cancels it. | ✅ Eviction (the thief cannot cancel) |
| The user must first answer "lost or stolen?" | Yes, and often cannot know | No |
| Cancelling an attempt you did not start | Face ID alone (Key Safe), or Face ID + Kit (Account) | Face ID + Kit passphrase (or Kit + key) |
| On-chain setup | Two recovery modules, two sets of guardians | One module, on the Account |
| Code today | Key Safe recovery built and tested end to end | Eviction proven by the spike (ADR-019), UI to build |
| Demo and pitch | Two flows to explain | One flow |
| Address after the flow | Same Key Safe | New Key Safe. Invisible to users: the public address is the Account. |

## Decision

- **The Account eviction (ADR-019) is the only flow for a lost or stolen phone.** The app does not ask which.
- **Who and how fast:**
  - level 0: the Kit's guardian key, 7 days;
  - level 1: + Swissquote identity verification (PDR-006), 3 days;
  - with a hardware key: Kit + key, immediately (ADR-017).
- **Cancelling an eviction you did not start:** 2 factors (Face ID + Kit passphrase, or Kit + key).
- **The Key Safe gets no recovery module of its own** in the target design. After an eviction the old Key Safe is abandoned: it holds no funds and keeps no rights.
- **Synced passkeys:** if the passkey comes back with the Apple or Google account on the new phone, no eviction is needed.
- **Transition:** the current Key Safe recovery code and `npm run e2e:recovery` stay until the eviction UI ships. An eviction e2e test then replaces them.

## Consequences

- ✅ One flow to explain, build, test and demo. It works whether the phone is lost or in a thief's hands.
- ✅ The thief cannot block it, and the on-chain setup is lighter (one module).
- ⚠️ Cancelling a malicious eviction needs the Kit passphrase too, not Face ID alone.
- ⚠️ The existing Key Safe recovery code and its e2e test become legacy once the eviction ships.
- ⚠️ Each eviction creates a new Key Safe. The app must update the stored wallet.

## Alternatives considered

- **Keep both paths:** two flows, and the user has to pick the right one, often without knowing whether the phone was stolen.
- **Key Safe recovery only:** cannot handle a stolen phone (the thief cancels it).
