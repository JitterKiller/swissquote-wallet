# ADR-026: Transitional — the protect flow keeps the legacy Key Safe recovery until the eviction flow ships

- **Status:** Accepted (temporary: removed by issue #33)
- **Date:** 2026-10-10
- **Related:** [ADR-005](ADR-005-social-recovery-module.md), [ADR-017](ADR-017-two-safe-account.md), [ADR-018](ADR-018-recovery-kit-encryption-and-storage.md), [ADR-019](ADR-019-account-eviction-module.md), [PDR-021](../product/PDR-021-one-flow-lost-or-stolen-phone.md)

## Context

- Issue #10 replaces the protect flow: the client now creates a passphrase-encrypted Kit v3 (ADR-018) and the Account Safe (ADR-017, ADR-019) in one sponsored UserOp.
- The target "phone lost or stolen" flow on a new device (eviction + handover, issue #15) is not built yet. Until it is, the only working recovery in the app is the legacy one: Kit + Swissquote replace the passkey owner of the Key Safe (ADR-005, ADR-006), through `RecoverView` and `/api/recovery`.
- If the new protect flow stopped registering the legacy guardians, a new wallet would have no recovery at all, and the demo (create → sign → lose → recover) and `npm run e2e:recovery` would break.

## Decision

Until issue #33 retires the legacy recovery:

- **The protect UserOp also registers the legacy guardians on the Key Safe**, before the Account setup calls (`AccountSetupStep.tsx`):
  - `recoverySetupCalls(keySafe, kitGuardian, swissquoteGuardian)`: the 3-minute module, threshold 2;
  - the guardian is the **Kit v3 guardian key**, the same key that guards the Account's eviction module. No new key.
  - Skipped when the Key Safe already has guardians (a wallet protected with a v1 Kit before).
- **`RecoverView` accepts a v3 Kit:** it asks for the passphrase, decrypts the guardian key in the browser, and recovers the Key Safe (`kit.keySafe`). The recovered device stores `kit.account`, so it keeps the Account: the Key Safe address does not change, it stays an owner and the allowance delegate.
- Level 0 and level 1 get the same legacy setup. Swissquote is therefore one of the two Key Safe guardians even at level 0 during the transition.

## Consequences

- ✅ The end-to-end recovery demo keeps working with the new onboarding.
- ✅ Recovering the Key Safe also recovers the Account: same address, still owner and delegate.
- ⚠️ The legacy weakness stays until #15 ships: a thief holding the unlocked phone can cancel a legacy Key Safe recovery with Face ID alone (PDR-018 explains why the eviction fixes this).
- ⚠️ At level 0, the legacy path needs a Swissquote identity check, which PDR-015 does not require at level 0. Swissquote alone still can do nothing (2 of 2 with the Kit, PDR-001).
- ⚠️ Follow-up, issue #33: drop `recoverySetupCalls` from `AccountSetupStep`, delete the legacy recovery screens and routes, and disable the module on existing Key Safes if needed.

## Alternatives considered

- **Account setup only, no legacy guardians:** cleaner, but no recovery at all until #15 ships, and the main demo breaks.
- **A separate v1 Kit for the legacy recovery:** two files to save and test, confusing for users, and thrown away by #33.
