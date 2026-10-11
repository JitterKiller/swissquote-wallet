# ADR-036: Level 1 upgrade: a panel on the Security page, a call on /swissquote, the trade shown before signing; panels and the Swissquote link follow Next 16's Activity

- **Status:** Accepted
- **Date:** 2026-10-11
- **Amends:** [ADR-034](ADR-034-security-page.md): the "Upgrade to level 1" slot is no longer "Soon".
- **Related:** [PDR-013](../product/PDR-013-key-management-user-majority.md), [PDR-015](../product/PDR-015-open-wallet-and-levels.md), [PDR-018](../product/PDR-018-time-locked-eviction.md), [PDR-019](../product/PDR-019-offer-tiers.md), [ADR-019](ADR-019-account-eviction-module.md), [ADR-021](ADR-021-wallet-registry.md), [ADR-035](ADR-035-daily-limit-change.md), issue #21

## Context

PDR-015 makes the Swissquote link the upgrade: a linked client's lost phone is locked out after 3 days, with the Kit plus a Swissquote identity check (PDR-018), instead of 7 days with the Kit alone. Three pieces were already built:

- `upgradeToLevel1Call` in `lib/account.ts`, checked on-chain by `check:target-flows` F7;
- the level-1 eviction path (`/api/eviction` requires a fresh KYC session);
- the protect flow, which creates a level-1 Account when a Swissquote session exists.

What was missing was the upgrade of an existing level-0 Account, shown as "Upgrade to level 1 · Soon" on the Security page (ADR-034).

Building it exposed a Next 16 behaviour. With Cache Components, pages are not unmounted on navigation: they are kept hidden with React `<Activity>` (up to 3 routes), with their state preserved and their effects re-run when shown (`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`). Two things went wrong in the Security → /swissquote (link) → Security round trip:

- the panel kept its first-visit state ("not linked"), because `useSwissquoteLink` read the session only once;
- `?change=` was read only on the first mount.

## Decision

- **Where:** chosen in the impeccable shape round (surface brief `web-src-components-account-levelupgrade-tsx`).
  - "Upgrade to level 1" on the "Lock-out delay" row opens an in-row panel. `/security?change=level` opens it too.
  - Once linked, `/swissquote` shows the Account's level (`LevelCallout`). At level 0 it offers "Shorten the lock-out to 3 days", which leads to the panel.
- **The panel (`components/account/LevelUpgrade.tsx`), for linked clients only:**
  - **Gates:**
    - loading: a skeleton;
    - already at level 1, read on-chain: "Your Account is already at level 1";
    - not linked: "Level 1 is for Swissquote clients who linked this wallet", with a link to `/swissquote`;
    - a lock-out is pending: blocked;
    - Swissquote's guardian key couldn't be loaded: blocked, with "Try again".
  - **The trade, before signing:**
    - the worst case before → after on the shared `WorstCaseChange` (`lossBound(limit, 0)` → `lossBound(limit, 1)`, for example 4.00 → 2.00 USDC);
    - "Locked out after 3 days instead of 7", with a demo note computed from the two levels' delays (`levelDemoNote`);
    - why it helps: someone who steals the Kit and its passphrase can't lock the phone out (threat model A3). The phone and the Kit together are full control at any level (A10), and the copy does not claim otherwise.
  - **What Swissquote can and never can do:** a list with drawn icons. It has to confirm it's you before a lost phone is locked out. It never moves your money, never locks you out on its own and never becomes an owner.
    - Then the trade, before signing: "If Swissquote can't sign, a lock-out waits for it. Before ending the service, Swissquote moves you back to 7 days with your Kit alone" (PDR-018).
  - **The sealed 2-of-2 plate:** new lock-out (and the current one), the new guardian "Swissquote" with its address, the worst case, the approval squares and the network fee.
  - **Then:** the Kit, and "Approve with Kit and Face ID".
    - The Kit is opened once. Its owner key signs, and its guardian address is passed to `upgradeToLevel1Call` for the module swap in production delays.
    - One sponsored UserOp. In the demo both levels share the 3-minute module, so the call only adds Swissquote's guardian with threshold 2.
  - **The receipt** "Level 1 · onchain", naming the new guardian with its address. The stored wallet's `level` is set to 1. The level shown everywhere stays the one read on-chain (`chainLevel`, `components/account/useSwissquoteKeys.ts`, shared by the Security page and `/swissquote`).
- **Shared pieces:** `WorstCaseChange` (extracted from the limit panel) and `useSwissquoteKeys` / `chainLevel` (extracted from the Security page).
- **Rule panels and Activity (Security page):**
  - one panel is open at a time (`RuleControl`);
  - `?change=limit|level` is followed on every visit, by comparing it with the last seen value during render;
  - `?change=level` is followed only at level 0;
  - `?change=` is removed (`router.replace('/security')`) when a panel closes, so a reload never reopens a finished task;
  - an open panel closes when the page is hidden (a `useLayoutEffect` cleanup, as the Next guide recommends for transient UI), so coming back never shows a stale form or receipt.
- **`useSwissquoteLink`:** it re-reads the session each time its effect runs, so a page shown again after a sign-in elsewhere sees it.
- **Test:** `npm run e2e:level` (`scripts/e2e-level.mts`), about 30 s, no funds needed:
  1. protect a wallet at level 0;
  2. check the "not linked" panel;
  3. sign in (MOCK) and link with Face ID;
  4. follow the `/swissquote` call;
  5. upgrade with Face ID + the Kit;
  6. check that the Security page and `/swissquote` read level 1.

## Consequences

- ✅ A linked client can halve their worst case and close the Kit-theft gap, and sees exactly what Swissquote gains and never gets before signing.
- ✅ The level is read on-chain everywhere. The funnel from linking to level 1 is one tap.
- ⚠️ No way back to level 0 in the app. PDR-018 has the app move the Account back to the Kit-only lock-out before Swissquote would close; that flow is not built.
- ⚠️ With production delays the upgrade swaps modules: this is covered by F7 in `check:target-flows`, not by the e2e, which runs on the shared demo module.
- ⚠️ Every page kept by Activity must treat open panels, sessions and URL parameters as state that can be stale when it shows again.

## Alternatives considered

- **Upgrade on `/swissquote` only:** a natural place right after linking, but the Security page is where the lock-out and its delay live.
- **The can / can't list or the worst case alone:** the shape round chose both. The benefit is an amount, and the trust boundary must be read before signing.
- **Reset the whole Security page on each navigation (`bfcacheId` key):** simpler, but it also throws away state that should survive (such as scroll position).
