---
version: 1
slug: "web-src-components-account-levelupgrade-tsx"
primary_target: "web/src/components/account/LevelUpgrade.tsx"
related_targets: ["web/src/components/views/SecurityView.tsx","web/src/components/views/SwissquoteView.tsx","web/src/components/account/WorstCaseChange.tsx","web/src/components/account/LimitChange.tsx"]
---

# Surface brief: Upgrade to level 1

- **Scope:** the level 1 upgrade (#21).
  - "Upgrade to level 1" on the Security page's "Lock-out delay" row stops being "Soon" and opens an in-row panel. `/security?change=level` opens it too.
  - Once the wallet is linked, `/swissquote` shows the Account's level with "Shorten the lock-out to 3 days", which leads to the panel.
  - The before → after worst-case block becomes a shared component used by the limit panel and this one.
- **Mode:** Operate.
- **Audience and job:** a linked Swissquote client at level 0 who wants a lost phone locked out after 3 days instead of 7. Before signing, they must understand what Swissquote gains (an identity check before a lock-out) and what it never gets.
- **Proof and content:**
  - **Level:** read on-chain (the eviction module's guardians include Swissquote's guardian key, `/api/guardian`).
  - **Worst case:** `lossBound(limit, 0)` → `lossBound(limit, 1)`, for example 4.00 → 2.00 USDC.
  - **The transaction:** `upgradeToLevel1Call` (checked on-chain by `check:target-flows` F7), signed by Face ID + the Kit in one sponsored UserOp. In the demo both levels share the 3-minute module, so it adds Swissquote as the second guardian, threshold 2.
  - **The link:** the registry entry from "Link with Face ID" (`useSwissquoteLink`).
- **Constraints:**
  - For linked clients only. Unlinked wallets see why and a way to link (MOCK sign-in on `/swissquote`).
  - Blocked while a lock-out is pending.
  - Swissquote never becomes an owner, never moves money and never locks the user out alone (PDR-013, PDR-018). The copy says so before signing.
  - The demo delays are labelled.
  - English copy.
- **Out of scope:**
  - going back to level 0 (PDR-018: the app does it before Swissquote closes);
  - the Premium offer (#22);
  - the security key (#17).
- **Unresolved:** none blocking.

## Direction contract

THESIS: Level 1 is a trade the client makes with eyes open. The worst case drops (4.00 → 2.00 USDC, 7 days → 3) because Swissquote joins as a guardian that checks identity. The panel says in four lines what that guardian can do and what it can never do, before both factors sign. It refuses the upsell card ("Go Premium!"), badges and any wording that makes Swissquote sound like a custodian.

OWN-WORLD:
- DESIGN.md as built: the In-Row Panel rule, the shared Worst Case Change on the Apricot Field, the 2-of-2 review plate led by the approval squares, and the Kit section.
- The can / can't list is a hairline list with drawn icons: a check for what it can do, an X for what it can't, in ink and Graphite, never green or red.
- The receipt is a plate. The CTA on `/swissquote` is a quiet white section with a secondary action.
- One committed orange: the primary action.

STORY:
1. On the Security page the owner taps "Upgrade to level 1" beside "7 days". The panel opens under the row.
2. If the wallet isn't linked, it says level 1 is for linked Swissquote clients and links to `/swissquote`.
3. If it is linked, the panel shows:
   - "4.00 → 2.00 USDC: locked out after 3 days instead of 7";
   - what Swissquote can (check your identity before a lock-out) and can never do (move your money, lock you out alone, become an owner);
   - the review plate (new lock-out, the new guardian with its address, approval);
   - the Kit, then "Approve with Kit and biometrics".
4. The receipt says the Account is at level 1. The row then reads "3 days", and the matrix and scenarios switch to level 1.
5. From `/swissquote`, right after linking, the client sees their level and the way to shorten the lock-out.

FIRST VIEWPORT: on the Security page at the "Lock-out delay" row, with the panel open:
1. the worst case before → after;
2. the can / can't list;
3. the review plate;
4. the Kit;
5. the actions.

FORM: chosen by the user in the shape round:
- a panel in Security, plus a call to action on `/swissquote`;
- the worst case before → after and the can / can't list.

It sits inside the established world, with no roll.

FINISH: unreviewed and undocumented is unfinished. This build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
