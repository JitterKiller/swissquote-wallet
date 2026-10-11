# ADR-034: Security page for the two-Safe Account: owners read live onchain, "Swissquote · not an owner", worst case, who can do what

- **Status:** Accepted, amended by [ADR-035](ADR-035-daily-limit-change.md) (the daily limit's "Change" works) and [ADR-036](ADR-036-level-1-upgrade.md) ("Upgrade to level 1" works)
- **Date:** 2026-10-11
- **Related:** [PDR-012](../product/PDR-012-web-first-banking-ux.md), [PDR-013](../product/PDR-013-key-management-user-majority.md), [PDR-014](../product/PDR-014-separation-of-powers.md), [PDR-018](../product/PDR-018-time-locked-eviction.md), [PDR-020](../product/PDR-020-daily-limit-chosen-by-user.md), [ADR-017](ADR-017-two-safe-account.md), [ADR-019](ADR-019-account-eviction-module.md), [ADR-027](ADR-027-visual-world-swiss-onchain-fintech.md), issue #26

## Context

`/security` still described the first design: "only your passkey can move funds", and a recovery by the Kit + Swissquote, 2 of 2. Since the two-Safe Account (ADR-017) and the eviction (ADR-019), that page was wrong.

The product principle "the user always holds the majority, and the interface proves it" (PRODUCT.md) needs a place where the owner, and the jury, can see and check who can move the money. Issue #26 lists the content:

- the owners with their roles;
- "Swissquote is not an owner", verifiable on Basescan;
- the level, the loss bound and the eviction delay;
- who can do what;
- the slots for the limit (#13) and the security key (#17);
- the pending eviction.

## Decision

- **A proof, not a settings list.** The layout was chosen in the impeccable shape round (surface brief `web-src-components-views-securityview-tsx`).
- **Owners plate, live onchain.** An ink plate titled "Owners of your Account · live onchain" (green live square from `useBlockNumber`) lists the owners from `readAccount`:
  - **This phone:** orange factor square, its Key Safe address.
  - **Recovery Kit:** ink square. Its owner key comes from the local encrypted Kit (`kitAddresses`). Without a local copy, it is the Account's other owner, because the protect flow always creates `[Key Safe, Kit]`.
  - **Any other owner:** "Another owner · Not added by this app".
  - **Security key:** an empty slot marked "Soon".
  - **Footer:** "Above your daily limit: `threshold` of `owners` needed · both yours".
  - **Swissquote:** "Not an owner", computed live. Swissquote's guardian key and treasury (from `/api/guardian`) are checked against the owners.
    - The sentence naming those addresses appears only when the check passes.
    - If they cannot be loaded, the plate says "Not checked" and offers a retry.
    - If a Swissquote key were an owner, the plate says so and warns.
    - A link opens the Account's `getOwners` on Basescan in every case.
  - **Pending lock-out:** the phone's row says "Being locked out · m:ss left", under the global alert (ADR-030).
- **Worst case beside the plate.** `LossBound` (`components/account/LossBound.tsx`) is extracted from the protect flow and shared by both screens: limit × (days + 1) with DaySquares and the demo delay. `lossBound()` is the one formula.
- **The level comes from the chain.** Level 1 when the eviction module's guardians include Swissquote's guardian (`evictionLevel`, as the eviction API reads it), not from the level stored in the browser. Delays, the loss bound, the matrix and the scenarios follow it.
- **Who can do what.** A table of powers (rows) × parties (Phone, Kit, Swissquote): spend up to the limit, pay more / swap / lend / change a rule, lock out a lost phone (after the delay), stop a lock-out.
  - **Cells:** a factor square and a few words ("alone", "never", "—"), with the full words for screen readers.
  - **Two-factor rows:** one cell spanning Phone and Kit reads "together".
  - **Phones:** below 640px the table becomes a list, "■ Phone alone · Swissquote never". Next to it, "If something goes wrong" gives four scenarios from the threat model, with the worst case in mono.
- **Rules of your Account.** The daily limit (amount, spent today, reset), the lock-out delay with its level, and the security key. "Change", "Upgrade to level 1" and "Add a key" are disabled buttons with a "Soon" badge until #13, #21 and #17.
- **This phone.** The passkey, where it is stored, and the credential. The status comes from the Account ("Owner of your Account", "Being locked out"). "Forget this wallet on this device" says what it removes, including the local Kit copy, and how to come back.
- **Wallets without an Account** keep the legacy recovery as a plain hairline list, with "Create your Account", until #33.
- **Nothing on the page signs a transaction.**

## Consequences

- ✅ The custody claim is in the product, live and checkable: two owners, both the user's, and Swissquote's own addresses shown as not owners.
- ✅ One loss-bound component and formula for the protect flow and the Security page.
- ⚠️ The Kit is recognised by elimination when the browser has no local Kit copy. A future third owner (#17) will need its own label.
- ⚠️ The slots stay "Soon" until #13, #17 and #21 ship.

## Alternatives considered

- **Keep the old permissions table (passkey / Kit / Swissquote × move, approve, cancel recovery):** it described the legacy design and implied Swissquote co-approves recoveries of the funds.
- **Worst case first:** strong for a client, but the jury's question is "who holds the money", so the owners lead and the worst case sits beside them.
- **Scenarios only:** easier to read, but not exhaustive. The matrix is the verifiable form, and the scenarios translate it.
