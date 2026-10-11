# ADR-037: UI refinements: no seal on ink plates, 4px buttons, phone tab bar with More, Overview balance chart

- **Status:** Accepted
- **Date:** 2026-10-11
- **Related:** amends [ADR-027](ADR-027-visual-world-swiss-onchain-fintech.md), [ADR-030](ADR-030-lost-phone-flow-ui.md), [ADR-031](ADR-031-earn-screen.md), [ADR-032](ADR-032-swaps-and-assets.md), [ADR-035](ADR-035-daily-limit-change.md), [ADR-036](ADR-036-level-1-upgrade.md) and [PDR-027](../product/PDR-027-logo-two-square-mark.md); [ADR-015](ADR-015-activity-from-chain-logs.md), [ADR-028](ADR-028-approved-dapps-native-integration.md)

## Context

A live design session in the browser (impeccable live) and a critique of the onboarding flow led to changes the product owner asked for:

- The turning orange seal ("SPONSORED BY SWISSQUOTE · 2 OF 2 · USER MAJORITY") competed with the plate's own content and was asked to be removed.
- The buttons read as too round.
- On phones the tab bar had seven entries in five columns, and after the team's fix Handle was unreachable on a phone.
- The Overview had no view of the balance over time.
- The custody story was told in different words on different screens (critique P1-1).

## Decision

- **No seal.** `Seal` and the `seal` prop are removed from `web/src/components/ui/plate.tsx`, with the `seal-turn` animation in `globals.css` and the 64px plate margin that made room for it. A plate that reviews a payment or a protocol action is now titled with the approval squares (`ApprovalSquares` in `components/ui/factor.tsx`) before its title, so the 2 of 2 is read in the factor code (Send, Earn, the takeover in `/lost`).
- **Approve labels say "biometrics".** "Approve with biometrics" when the phone alone signs, "Approve with Kit and biometrics" with the Kit (Send, Earn, Swap, the daily limit change, the level 1 upgrade), device-neutral; the e2e scripts click those names.
- **Buttons at 4px.** A `--radius-control: 4px` token (`rounded-control`) carries every button size in `components/ui/button.tsx`, including the plate action tiles. Inputs stay at 8px.
- **Phone tab bar.** Four tabs (Overview, Send, Receive, Activity) and More, a menu of the rest of the navigation (Handle, Swissquote, Earn, Security). It grows out of the More tab and shrinks back into it with CSS transitions, so it can be interrupted. It closes on navigation, on Escape and on its scrim (`MobileTabBar` in `components/shell/AppShell.tsx`).
- **Overview balance chart.** `components/views/BalanceHistoryCard.tsx` sits under the Account plate. It shows the balance over time, rebuilt from the Account's USDC Transfer logs (`lib/balanceHistory.ts`, ADR-015), never from sample data.
  - A stepped line, with the ranges 24H, 7D, 30D and All.
  - A crosshair and a tooltip on hover or with the arrow keys, and a screen-reader table.
  - The change over the range is shown in neutral ink, never green or red.
- **One custody vocabulary.** Plate rows carry the factor squares in a fixed slot (`FactorLabel` in `components/ui/factor.tsx`). The words are fixed:
  - Face ID on this phone;
  - your iCloud or Google account;
  - your Kit passphrase;
  - the Recovery Kit is the file and its passphrase together.
  
  `/recover` says it is the earlier recovery and points to "Phone lost or stolen" (`/lost`).
- **Phone polish.**
  - Inputs are 16px below 640px, so iOS Safari doesn't zoom into them.
  - `touch-action: manipulation` and no tap highlight on controls.
  - `:active` works on iOS (`components/providers/PressFeedback.tsx`), with pressed states on tabs, menu items and sidebar links.
  - Toasts sit above the tab bar.
  - `theme-color` in light and dark.
  - Under `prefers-contrast: more`, hairlines become `--muted` lines.

DESIGN.md, `.impeccable/design.json` and the surface briefs are updated to match.

## Consequences

- ✅ Plates are calmer, and the approval squares say what the seal said, in the code used everywhere else.
- ✅ Every destination is reachable on a phone, and the tab bar fits in one row.
- ✅ The Overview shows how the balance got to where it is, with real data only.
- ⚠️ ADR-027, ADR-030, ADR-031, ADR-032 (swap review), ADR-035 (limit change), ADR-036 (level upgrade) and PDR-027 still describe the seal or a "sealed" plate; this record amends them: those reviews are plates titled with the approval squares.
- ⚠️ Tailwind's build drops CSS custom properties that no stylesheet reads. A colour or offset used only in an SVG attribute or by sonner's runtime CSS must be set through a utility class or on the property itself (see the comments in `BalanceHistoryCard.tsx` and `globals.css`).

## Alternatives considered

- **Keep the seal only on 2-of-2 commits** (the team's rule before this record): asked to be removed outright.
- **Five fixed tabs with Security** (the team's version): it left Handle unreachable on phones.
- **A price-style chart with green and red changes**: wrong for a stablecoin, where a deposit is not a gain.
