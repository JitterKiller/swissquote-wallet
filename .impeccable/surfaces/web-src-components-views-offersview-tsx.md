---
version: 1
slug: "web-src-components-views-offersview-tsx"
primary_target: "web/src/components/views/OffersView.tsx"
related_targets: ["web/src/components/shell/AppShell.tsx","web/src/components/views/SendView.tsx","web/src/components/views/SecurityView.tsx","web/src/components/account/LossBound.tsx"]
---

# Surface brief: Offers

- **Scope:** the Offers page `/offers` (#22, PDR-019).
  - A comparison table of the three offers: Free, Client, Premium "Theft protection". The user's column is marked.
  - Above it, the user's offer, its level read onchain, and its one next step.
  - The worst case per offer, computed from the user's own daily limit.
  - The self-service security key, open at every level, linked to `/security?change=key` (#17).
  - Premium is for linked clients only. "Subscribe" and "Order my security key" are MOCK, stored through `store()` behind `/api/offers`.
  - One conversion trigger: on Send's receipt after the first payment that needed the Kit (once per device and Account), a quiet line for linked clients who are not Premium and hold no key.
  - "Offers" in the navigation: the sidebar and the phone's More menu.
- **Mode:** Read, with one Operate moment (the next step). The table proves what each offer does. It is not an upsell.
- **Audience and job:**
  - **The owner** (level 0, or a linked client) wants to know what linking or Premium would change for their own Account.
  - **The jury** checks that basic security is never sold.
- **Proof and content:**
  - **Worst case:** `lossBound(limit, 0)`, `lossBound(limit, 1)`, and one day of the limit for Premium, from `chain.account.allowance.amount`.
  - **The offer:** the link (`useSwissquoteLink`, registry), then the MOCK subscription (`/api/offers`, keyed by the Swissquote client id).
  - **The level:** `chainLevel`, read onchain.
  - **Network fees:** the sponsorship quota (`SPONSORED_OPS_PER_MONTH`).
- **Constraints:**
  - Basic security is the same in every column, and the copy says so. Premium sells speed, insurance and assistance, never basic security (PDR-019).
  - The demo delays are labelled. Prices read "CHF 5–9 a month, to model". Insurance reads "with a licensed partner (to be chosen)".
  - MOCK in the code and in the UI. English copy. 44px targets on phones.
- **Out of scope:**
  - billing, shipping and attestation;
  - the security key flow itself (#17);
  - any other conversion trigger.
- **Unresolved:** the prices and the insurance partner (PDR-019).

## Direction contract

THESIS: The Offers page proves what each offer does to your own Account. Basic security is the same in every column; only speed, insurance and someone to call sit on top. Your column is outlined in ink. The worst case is your own daily limit on three apricot fields (4.00, 2.00 and 0.50 USDC at a 0.50 limit), with the loss bound's day squares: 8, 4, then 1. It refuses the pricing page: no check grids, no "most popular", no gradients, no scarcity, nothing basic held back for a paid tier.

OWN-WORLD:
- DESIGN.md as built: white and ink, hairline rows, one orange action (the next step).
- The user's column takes an ink outline (the card-in-action rule), never a fill. Its header carries the accent "Your offer" badge.
- The worst case sits on the Apricot Field: one tile per offer, a mono figure, and the day squares at 12px ("now" solid orange, each reset at 45%).
- "Your offer" is a quiet white section like the Level Callout, with the level as a mono token read onchain.
- On phones, the Activity filter's segmented control picks the offer, and the shown offer is a hairline list in a card: ink-bordered when it is yours.
- MOCK is a warning badge beside each mocked action. The demo delays are said in the cell they change.
- Mono only for figures: amounts, days, prices, the quota.

STORY:
1. The owner opens Offers from the sidebar or More, or from a Send receipt after a payment that needed the Kit.
2. They read their offer, its level, and the one next step: link, the 3-day lock-out, subscribe, or order the key.
3. They compare the columns:
   - the lock-out delay;
   - their own worst case;
   - what large payments and a lost Kit take;
   - the security key, theirs at any level or included in Premium;
   - fees, extras and assistance.
4. The last rows say what never changes: the Account is owned only by them, and the daily limit is theirs to choose.
5. They act once, or leave knowing that nothing basic is for sale.

FIRST VIEWPORT:
- **Desktop (1440):**
  1. the title "Offers" with "Basic security is free in all of them";
  2. the "Your offer" section, with the primary next step at its right;
  3. the table head: Free, Client and Premium "Theft protection", each with who it is for and its price, the user's column outlined in ink;
  4. the rows down to the security key, the worst case on apricot among them.
- **Phone (390):**
  1. the title;
  2. "Your offer", with the full-width next step;
  3. the three-way control (Free, Client, Premium), open on the user's offer;
  4. that offer's card as a hairline list.

FORM: chosen by the user in the shape round:
- a comparison table on its own page, the current column marked;
- the header with the offer and its next step;
- one offer at a time on phones;
- one conversion trigger, on Send's receipt.

It sits inside the established world, with no roll.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
