# ADR-039: Offers page and the upgrade funnel: a comparison table at /offers, the user's offer and its next step, a MOCK Premium in the store, one conversion trigger on Send's receipt

- **Status:** Accepted
- **Amends:** [ADR-036](ADR-036-level-1-upgrade.md): the funnel towards level 1 also runs from the fee quota, the end of the protect flow and the Overview card.
- **Date:** 2026-10-11
- **Related:** [PDR-019](../product/PDR-019-offer-tiers.md) (the offers), [PDR-015](../product/PDR-015-open-wallet-and-levels.md), [PDR-017](../product/PDR-017-theft-protection-hardware-key.md), [PDR-018](../product/PDR-018-time-locked-eviction.md), [PDR-020](../product/PDR-020-daily-limit-chosen-by-user.md), [ADR-020](ADR-020-deployment-vercel-upstash.md) (store), [ADR-021](ADR-021-wallet-registry.md) (registry), [ADR-023](ADR-023-sponsorship-policy-proxy.md) (fee quota), [ADR-034](ADR-034-security-page.md), [ADR-036](ADR-036-level-1-upgrade.md), [ADR-037](ADR-037-ui-refinements-no-seal-4px-tab-bar-chart.md), [ADR-038](ADR-038-security-key.md) (security key, #17), issue #22

## Context

PDR-019 defines three offers:

- **Free:** level 0, for everyone;
- **Client:** level 1, free for Swissquote clients who link their wallet;
- **Premium "Theft protection":** a subscription for linked clients.

Basic security is free in all three. Premium sells speed, insurance and assistance, and the security key is self-service at every level.

The app showed the level (the sidebar, the level call on `/swissquote`) but not what each offer does. Premium existed only in the decision records. The impeccable shape round chose the form: a comparison table on its own page, the user's offer and its next step above it, one offer at a time on phones, and one conversion trigger. The direction contract is in the surface brief `web-src-components-views-offersview-tsx`.

## Decision

- **Where:** `/offers` (`app/(wallet)/offers/page.tsx` renders `components/views/OffersView.tsx`).
  - "Offers" closes `NAV` in `components/shell/AppShell.tsx` (lucide `Layers`).
  - It shows in the sidebar and in the phone's More menu.
- **The user's offer** comes from the link and the subscription, never from the device:
  - Free: this wallet is not linked (`useSwissquoteLink`, the registry);
  - Client: linked;
  - Premium: linked, with a MOCK subscription for that client id.

  The level beside it is the one the chain enforces (`chainLevel`, as on the Security page).
- **Its next step** is the page's one orange action:

  | State | Next step |
  |---|---|
  | No Account yet | "Protect your wallet" |
  | Free | "Link your Swissquote account" (`/swissquote`) |
  | Client, level 0 onchain | "Shorten the lock-out to 3 days" (`/security?change=level`, ADR-036). The Client column's 3 days need the upgrade. |
  | Client, level 1 | "Subscribe to Premium" (MOCK) |
  | Premium | "Order my security key" (MOCK), then "Add a security key" (`/security?change=key`, #17), with "End Premium" |
  | Premium, with a key already an owner | None: the key is read from the owners (`useOwnerKinds`, as on the Security page). "End Premium" stays |

  Subscribing says what it is: "You subscribed to Theft protection … Until then, your Account works as before." Nothing onchain changes until a key is added.
- **The table**, from 640px:
  - **Columns:** Free, Client and Premium "Theft protection". Each says who it is for, its level and its price (CHF 0, or "CHF 5–9 a month" with "Price to model").
  - **The user's column** takes an ink outline (the card-in-action rule) and an accent "Your offer" badge.
  - **Rows:**
    - stolen phone (after 7 days, after 3 days, at once, with the demo delay in the cell);
    - worst case;
    - large payments;
    - lost Kit;
    - security key;
    - network fees;
    - banking extras;
    - assistance;
    - then "Same in every offer": your Account (owned only by you, Swissquote is never an owner) and the daily limit (chosen by you).

    On phones each cell is self-contained (no "Same"), because one offer shows at a time.
  - **Actions:** under each column, its way in, as a secondary button ("Link your account", "Subscribe" with MOCK). "Subscribe" shows only at level 1; a linked client at level 0 reads "First, shorten the lock-out to 3 days, above".
  - **A key gives the same powers in every offer** (PDR-019). Each Free and Client cell says what the user's own key does there:
    - stolen phone: "At once with your own key";
    - worst case: "With your own key: one day of the limit";
    - large payments: "Or a tap on your own key";
    - lost Kit: "Or replaced with your own key".

    Premium's cells name "the included key". So Premium never reads as selling basic security.
  - **"Soon"** (the neutral badge of the Soon Slot) marks what the app does not build yet (ADR-038): a key tap for large payments, and replacing a lost Kit with the phone and the key. Onchain, any two of the three owners can already do both.
  - **Factor squares** only on two rows: "Large payments" (phone + Kit, or phone + key for Premium, the receipt's "who approved" vocabulary) and "Security key" (the key's orange outline square).
  - **Semantics:** a `<table>` with a hidden caption, column and row headers, and screen-reader text for "—".
- **Phones:** a three-way segmented control (the Activity filter's style, `role="tablist"`, arrow keys), open on the user's offer. The offer shows as a hairline list in a card, ink-bordered when it is the user's.
- **The worst case** comes from the user's limit (`chain.account.allowance.amount`):
  - Free: `lossBound(limit, 0)`;
  - Client: `lossBound(limit, 1)`;
  - Premium: `limit` (locked out at once with the key), "If you act before the next daily reset", the same condition as the Security page (`LossBound withKey`).

  Each sits on the Apricot Field with the loss bound's day squares at 12px. Premium's tile adds "Insured (partner to be chosen)". Without an Account, a tile reads "8 × your daily limit" (and so on).
- **The self-service key:** the "Security key" row.
  - Free and Client: "Bring your own" (any FIDO2 key, added by you).
  - Premium: "Included" (shipped, set up and checked for you).
  - The row says "With one, any offer locks a stolen phone out at once", and links to `/security?change=key`.
- **Network fees:** the Free cell shows `SPONSORED_OPS_PER_MONTH` (ADR-023), returned by the API. Client and Premium: "All covered", "No monthly quota, by Swissquote".
- **MOCK Premium:** `server/offers.ts` behind `app/api/offers/route.ts`. The types and client helpers are in `lib/offers.ts`.
  - `GET /api/offers?clientId=` returns `{ subscription, sponsoredPerMonth }`.
  - `POST /api/offers` takes `{ clientId, action }`, with `action` one of `subscribe`, `order-key` or `end`.
  - One record per Swissquote client id in the `subscriptions` collection of `store()` (ADR-020). MOCK auth: the client id comes from the request, as for the other Swissquote endpoints.
  - Subscribing needs a linked wallet (403 otherwise). Ordering the key needs a subscription (409 otherwise). Both are idempotent.
  - No payment is taken, nothing ships, and nothing changes onchain.
  - MOCK appears in the code, on the actions (a warning badge with "No payment in this prototype." or "Nothing ships in this prototype.") and in the page's footnote.
- **The only conversion trigger:** on Send's receipt, after the first payment that needed the Kit, a line for linked clients who are not Premium and hold no key: "Coming soon: a tap on a security key instead of your passphrase, with your own key or one set up for you with Premium. Offers ›" (`OffersHint`, exported by `OffersView.tsx`).
  - It sits under the plate, never on it (the Ink Plate Rule).
  - It shows once per device and Account. `sq-offers-hint:v1` in localStorage remembers the Account that saw it (public data, ADR-009; read and written in try/catch, cleared by "Forget this wallet"). Once shown, it stays for that receipt.
- **The sidebar's label** reads the link, as Offers does (`LevelLabel` in `AppShell.tsx`, read again on each navigation): "Free · level 0" only when unlinked, "Swissquote client · level 0" for a linked client before the upgrade, "Swissquote client · level 1" after it.
- **The funnel towards level 1 (#21, PDR-015).** Linking gives an @handle, one-tap transfers and unlimited sponsored fees. The 3-day lock-out comes with the upgrade, with the Kit (ADR-036), and every surface says so in that order:
  - **The fee quota:** when the paymaster refuses for the level 0 quota (ADR-023), `errorMessage` (`lib/format.ts`) shows its sentence, and `QuotaHint` (`components/swissquote/QuotaHint.tsx`) adds "Link with Face ID ›" inside the "Not sent", "Not swapped" and Earn alerts. A refused unapproved dApp shows only the refusal's first sentence: the app has no "pay the fee yourself" path (PDR-003).
  - **The end of the protect flow:** at level 0, "Swissquote client?" with "Link my Swissquote account".
  - **The Overview's Swissquote card** and the "Move to Swissquote" description on `/swissquote`.
- **Activity (Next 16):** the subscription is read again each time the page shows. A picked phone tab and a failed action reset when the page is hidden (a `useLayoutEffect` cleanup, as in ADR-036).
- **Check:** `node scripts/capture-offers.mts [outDir] [--send]`, with Chrome and `npm run dev`, in about a minute.
  - It protects a wallet with a virtual passkey, links it as Alice Meier (MOCK), upgrades it to level 1, subscribes, then orders the key.
  - It captures `/offers` at 390×844 and 1440×900 (`offers-*.png`) for each state.
  - With `--send`, it also captures Send's receipt with the line: 1 USDC comes from the demo treasury and goes back to it with the Kit.
  - It ends Alice's MOCK subscription before and after the run.

## Consequences

- ✅ The offers are in the product, and the page proves them: the level is read onchain, the worst case comes from the user's own limit, and each column carries the same basic security.
- ✅ The Free → Client → Premium funnel has one next step, on one page. The key stays self-service at every level (no lock-in, PDR-017).
- ⚠️ Premium is a MOCK. There is no billing, shipping, attestation or insurance yet, and the price is a placeholder (PDR-019).
- ⚠️ The line on Send's receipt shows once per device and Account: a demo wallet that already made a Kit payment on that device won't show it again ("Forget this wallet" resets it).
- ⚠️ Two of Premium's comforts are "Soon": the key tap for large payments and the lost Kit replaced with phone + key. The table says so.

## Alternatives considered

- **Offer cards side by side, as on a pricing page:** they read as an upsell. The table shows, row by row, what is the same and what differs.
- **More Client → Premium triggers** (a balance above a threshold, after the "phone stolen" explainer): left out by the shape round. The first large payment is the moment the Kit's friction is felt.
- **Keeping the offer on the device:** the offer is a banking fact (the link and the subscription), so it is read from the backend, like the link.
- **Requiring level 1 onchain to subscribe** (PDR-019: "level 1 + subscription"): the page leads a linked client at level 0 to the upgrade first. The MOCK checks only the link, because the key's powers do not depend on the level.
