# ADR-041: "Test your Kit": a Recovery Kit row on the Security page, a reminder after 90 days, the cloud file checked onchain

- **Status:** Accepted
- **Date:** 2026-10-11
- **Related:** [PDR-016](../product/PDR-016-recovery-kit-encrypted-cloud-backup.md) ("test at setup, then periodic 'test your Kit' reminders"), [ADR-018](ADR-018-recovery-kit-encryption-and-storage.md), [ADR-019](ADR-019-account-eviction-module.md), [ADR-009](ADR-009-client-storage-public-data-only.md), [ADR-034](ADR-034-security-page.md), [ADR-035](ADR-035-daily-limit-change.md) (the In-Row Panel), [PDR-014](../product/PDR-014-separation-of-powers.md) (rotating a lost Kit, an open question), issue #9

## Context

The Recovery Kit is the only way back after a lost phone: the cloud file and its passphrase. The protect flow tests it once at setup (ADR-018). But a file deleted in a drive clean-up, or a passphrase forgotten after months, only shows on the day the phone is gone, and by then it is too late.

PDR-016 decided periodic "test your Kit" reminders. In the shape round the user chose:
- where: a "Recovery Kit" row on the Security page with a test panel, plus a reminder on the Overview;
- what: the cloud file plus the passphrase, checked onchain;
- when: every 90 days, with a Demo control.

## Decision

- **Last test, per device:** `sq-kit-tested:v1` (`loadKitTestedAt` / `saveKitTestedAt` in `lib/storage.ts`, public data, ADR-009).
  - It is written at setup, after a test in the panel, and when "Phone lost or stolen?" opens the Kit file (`EvictionView`): the new device starts as tested.
  - `saveKitTestedAt` fires `sq-kit-tested`. `useKitTestedAt()` (`components/account/useKitTest.ts`, `useSyncExternalStore`) follows that event and other tabs' `storage` events, so the Overview and the Security row change at once.
- **Due:** 90 days after the last test (`KIT_TEST_INTERVAL_DAYS` in `lib/config.ts`), or at once on a device that never tested the Kit.
- **Security page:** a "Recovery Kit" row closes "Rules of your Account".
  - Its value: "Tested today", "Tested 94 days ago" with a warning "Due" badge, or "Not tested on this phone".
  - Its line: "Next test in N days" or "Check that you still have the file and its passphrase, before you need them."
  - "Test" opens `KitTest` (`components/account/KitTest.tsx`), an In-Row Panel like the daily limit. `/wallet/security?change=kit` opens it too.
- **The test** (`KitTest`). Nothing is signed or sent, and the file and the passphrase never leave the device.
  1. The owner picks the file from iCloud Drive or Google Drive and types the passphrase.
  2. `parseKitFile`: a v3 Kit for this Account. A v1 Kit or another Account's Kit is refused with its reason.
  3. `decryptKit`. A wrong passphrase is refused.
  4. `readAccount`: the owner key must be among the Account's owners, and the guardian key among the lock-out guardians (ADR-019).
  5. On success: "Kit tested" in ink, led by the Kit's square (nothing green: a test signs nothing), the three facts with ink checks and the two key addresses, and the next test date. `saveKitTestedAt()` is called.
- **Help under the form:**
  - **"Can't find the file?":** "Save my Kit again" downloads this phone's encrypted copy (`sq-kit:v3`, ADR-018). It is the same file and opens with the same passphrase.
  - **"Forgot the passphrase?":** nobody can reset it, not even Swissquote. The money is safe while the phone works, but losing the phone as well would lock the owner out. Until then, Face ID alone can still move the money out, up to the daily limit each day, to a new wallet with a new Kit (PDR-014). "With a security key, this phone and the key will replace a forgotten Kit at once" is marked "Soon".
- **Overview:** `KitReminder` (`components/account/KitReminder.tsx`) shows only when a test is due.
  - It is a quiet white section led by the Kit's ink square: "Test your Recovery Kit · Last tested 94 days ago", with a secondary "Test my Kit" to the panel.
  - On phones it sits right under the Account plate; on desktop it heads the right column.
- **Demo:** "Demo: skip 90 days" on the row (a ghost button, while the test isn't due) moves the last test 90 days back, so the reminder shows live.
- **Test:** `npm run e2e:kit` (`scripts/e2e-kit.mts`), about 40 seconds, no funds needed:
  1. protect a wallet;
  2. check "Tested today" and no reminder;
  3. skip 90 days with the Demo control, then check the reminder;
  4. a file that isn't a Kit and a wrong passphrase are refused;
  5. the right file and passphrase pass, and the reminder goes;
  6. "Save my Kit again" gives the same Kit.

## Consequences

- ✅ A lost file or a forgotten passphrase is found while the phone still works, in about 20 seconds, with an onchain check of what the file really is.
- ✅ A lost file is fixed on the spot from the phone's encrypted copy.
- ⚠️ The last test is per device. A second device or a new browser starts as never tested, so the reminder shows there at once.
- ⚠️ A forgotten passphrase has no fix in the app yet. Replacing the Kit needs 2 factors: phone + Kit, or phone + a security key (Soon, PDR-014).
- ⚠️ No reminder outside the app (push, email) in this prototype.

## Alternatives considered

- **Test the passphrase only, against the phone's encrypted copy:** faster, but a lost cloud file would go unnoticed, and that file is what a new phone needs.
- **A banner on every page:** it would read as an alarm for a routine check. The Overview reminder plus the Security row are enough.
- **Count each Kit payment as a test:** a payment proves the passphrase, not the cloud file.
