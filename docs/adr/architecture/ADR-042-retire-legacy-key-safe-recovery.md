# ADR-042: Retire the legacy Key Safe recovery: one flow for a lost or stolen phone

- **Status:** Accepted
- **Date:** 2026-10-11
- **Supersedes:** [ADR-026](ADR-026-transitional-legacy-key-safe-recovery.md) (the transitional legacy recovery)
- **Related:**
  - [PDR-021](../product/PDR-021-one-flow-lost-or-stolen-phone.md) (one flow), [PDR-004](../product/PDR-004-recovery-policy.md) (the old policy);
  - [ADR-005](ADR-005-social-recovery-module.md), [ADR-006](ADR-006-recovery-target-verifier-proxy.md), [ADR-019](ADR-019-account-eviction-module.md) (the Account's lock-out);
  - [ADR-030](ADR-030-lost-phone-flow-ui.md), [ADR-038](ADR-038-security-key.md), [ADR-040](ADR-040-landing-at-root-app-under-wallet.md);
  - issues #33, #28.

## Context

PDR-021 keeps one flow for a lost or stolen phone: the Account's lock-out (ADR-019).

Until that flow shipped, ADR-026 kept the old recovery alive on the phone's Key Safe:
- the protect UserOp also enabled Candide's module on the Key Safe, with the Kit's guardian key and Swissquote as guardians (2 of 2, 3-minute delay);
- `/wallet/recover` with `/api/recovery` and `/api/recovery/finalize` moved the wallet to a new passkey;
- an alert let the old device cancel.

The lock-out shipped (#15, #16, ADR-030), and so did the immediate lock-out with a security key (#17, ADR-038). Keeping both mechanisms meant:
- two stories for the same event;
- Swissquote as a guardian of every new Key Safe, a role the custody story no longer needs;
- one more chain read every 20 seconds on every device.

## Decision

- **Protect:** the UserOp creates the Account only. `recoverySetupCalls` is gone from `AccountSetupStep`, so a new Key Safe has no recovery module and no guardian.
- **Removed:**
  - `/wallet/recover` (`RecoverView`);
  - `/api/recovery` and `/api/recovery/finalize`;
  - `lib/recovery.ts` and `RecoveryAlert`;
  - the `sq-recovery:v1` record (`clearAll` still removes a stale one);
  - the `RECOVERY_*` config;
  - `npm run e2e:recovery`.
- **Kept:**
  - `isPasskeyOwner`, moved to `lib/wallet.ts`. The revoked screen still uses it.
  - Candide's module, on the Account only: it is the lock-out (ADR-019). ADR-005 still holds there.
- **`WalletProvider`** no longer reads the Key Safe's recovery status.
- **`/api/report-stolen`:** a Kit proves ownership only as an owner of the Account.
- **Old paths:** `/recover` and `/wallet/recover` redirect to `/wallet/lost` (`next.config.ts`).
- **A v1 Kit, or a wallet without an Account:** "Phone lost or stolen?" now says "Wallet from before the Account": this version can't move it.
- **Tests:**
  - `npm run e2e:account-setup` S4 now checks that the Key Safe has no legacy recovery module.
  - The target flows (#28) are covered by `e2e:account-setup`, `e2e:eviction` and `e2e:key`.

## Consequences

- ✅ One flow and one story for a lost or stolen phone. On a new wallet, Swissquote has no role on the Key Safe.
- ✅ Less code, and one chain read fewer on every device.
- ⚠️ Wallets protected before this change keep their legacy guardians on the Key Safe, onchain. No app path uses them any more: Swissquote no longer co-signs a Key Safe recovery.
- ⚠️ Wallets from before the Account (a v1 Kit, no Account) can no longer move to a new phone in this version.

## Alternatives considered

- **Keep the legacy recovery as a fallback:** two stories, and Swissquote stays a guardian of every Key Safe.
- **Remove the old guardians onchain from existing wallets:** each owner would have to sign. No demo wallet needs it.
