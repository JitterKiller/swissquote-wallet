# PDR-027: Logo — the two-square mark

- **Status:** Accepted
- **Date:** 2026-10-11
- **Amends:** [PDR-026](PDR-026-product-name-squre.md) (the wordmark: the orange square no longer carries "SQ")
- **Related:** [PDR-013](PDR-013-key-management-user-majority.md), [PDR-014](PDR-014-separation-of-powers.md), [ADR-027](../architecture/ADR-027-visual-world-swiss-onchain-fintech.md)

## Context

PDR-026's wordmark set "SQ" in 13px inside an orange tile, followed by "ure" in 20px. It read as two pieces ("SQ ure"), and the team found it unattractive. The pitch needs a mark that works in the sidebar, on the ink onboarding panel, in a phone's top bar and as an app icon.

## Decision

The team picked option B of three (in-word square Q, two-square mark, corrected monogram).

- **The mark:** an orange square (radius 6 on a 32 grid) holding a smaller ink square in its lower-right corner (11/32, inset 4).
  - The two squares are the two factors that hold the Account: the phone (orange) and the Kit (ink), the same code as the Factor Code Rule. The custody model is the logo.
  - The ink square never inverts.
- **The wordmark:** "SQure" in one piece (Hanken Grotesk 700, −0.035em), with "by Swissquote" in 12px on its baseline. In the phone's top bar the endorsement drops below 380px so the address keeps its room.
- **The app icon** is the mark:
  - `app/icon.svg` (favicon, any size);
  - `app/apple-icon.tsx` (180px PNG for the iOS home screen).

  The default Next favicon is removed.
- **Code:** `LogoMark` and `Logo` in `web/src/components/shell/Logo.tsx`.
- **Unchanged:** the name, the line, and the seal's "SQ" monogram on commit plates (PDR-026).

## Consequences

- ✅ One readable word. The mark carries the product's promise (two factors, user majority) and reads at 16px.
- ✅ It needs no Swissquote assets: only the brand orange and a square.
- ⚠️ "SQ" is now said by the word, no longer drawn in the mark.

## Alternatives considered

- **Square Q inside the word ("S■ure"):** the most original, but less legible at small sizes, and its tail has to invert on dark grounds.
- **Corrected monogram (an "SQ" tile at the word's size):** the smallest change, but still a tile of letters rather than a mark.
