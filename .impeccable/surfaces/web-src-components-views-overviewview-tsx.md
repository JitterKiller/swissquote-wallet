---
version: 1
slug: "web-src-components-views-overviewview-tsx"
primary_target: "web/src/components/views/OverviewView.tsx"
related_targets: ["web/src/components/views/SendView.tsx","web/src/components/shell/AppShell.tsx"]
---

# Surface brief: Overview and Send (issues #11, #12)

- **Scope:** `/` (OverviewView) and `/send` (SendView), plus the app shell they live in (AppShell). Inside the established SQure world (DESIGN.md, ADR-027).
- **Mode:** Operate.
- **Audience and job:** the wallet's owner (client or not), mostly on a phone, projected on a laptop during the demo. Check money and protection; send USDC to a 0x address or an @handle.
- **Proof and content:** the Account's real USDC balance, the Allowance Module's real remaining amount and reset time, the Account's owners and guardians read on-chain, real activity from USDC logs, Earn positions read from Aave v3 / Compound III, the Swissquote account (MOCK, linked clients), USDC left on the phone's Key Safe.
- **Constraints:** keep "Wallet protected" visible on the Overview and the "Recipient" label in Send (e2e). Wallets without an Account keep the legacy Key Safe send. Swissquote account data is MOCK and labelled. English copy.
- **Out of scope:** Handle page payments, eviction screens (#15/#16), the full Earn page (#25), the Security page (#26).
- **Unresolved:** the Earn action links to the Earn page once #25's screen ships (shown as Soon until then).

## Direction contract

THESIS: Your money and its guard in one glance: the balance, what Face ID can still spend today, and who holds the keys. It refuses the hero-metric dashboard and the crypto portfolio wall.

OWN-WORLD: DESIGN.md as built: white and ink, Swissquote orange as the only committed colour (ink text on orange fills), ink plates for what Face ID signs, mono only for figures, addresses and status tokens, crisp corners, factor codes (orange fill phone, ink fill Kit, outline cloud). Signature here: today's Face ID allowance drawn as a row of square cells that empties through the day and refills at 00:00 UTC.

STORY: The owner sees the balance, knows today's Face ID budget and when it resets, sees that the phone and the Kit hold the majority with Swissquote as guardian only, then sends: Face ID alone within the budget, Kit passphrase plus Face ID above it, always after a sealed review with compliance checks.

FIRST VIEWPORT: Desktop: the shell's sidebar; main column an ink plate (Account address with a live token, the balance at display size in mono, the allowance cells with "320 of 500 USDC left today · resets in 6 h", Send in orange, Receive, Earn), activity below it; side column the custody strip ("Wallet protected", factor codes, Swissquote guardian, link to Security), then the Earn card and the Swissquote card. Mobile: plate, any "move funds into your Account" notice, custody strip, activity, Earn, Swissquote. Send: recipient, amount with a live route token, then a sealed review plate.

FORM: user-pinned composition from the shape round (balance and today's limit first, Kit at review, Earn + Swissquote + funds-on-phone on the Overview); no roll, inside the established world.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
