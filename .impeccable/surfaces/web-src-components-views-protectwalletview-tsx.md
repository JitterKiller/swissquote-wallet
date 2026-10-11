---
version: 1
slug: "web-src-components-views-protectwalletview-tsx"
primary_target: "web/src/components/views/ProtectWalletView.tsx"
related_targets: ["web/src/components/views/AccountSetupStep.tsx","web/src/components/shell/OnboardingShell.tsx","web/src/components/ui/candle-field.tsx"]
---

# Surface brief: Protect flow (onboarding, issue #10)

- **Scope:** `/welcome/protect` and its shell (OnboardingShell), first surface of the new world; the world then reaches every wallet screen through tokens and the kit.
- **Mode:** Operate.
- **Audience and job:** anyone setting up a self-custody wallet (client or not); choose a Kit passphrase, save and test the Kit, choose a daily limit, approve one Face ID to create the Account.
- **Proof and content:** real on-chain Account creation, real loss bound (limit × days), real chain status (Base Sepolia block), sponsored fees. Lock-out delay is 3 minutes in the demo (labelled DEMO).
- **Constraints:** e2e selects by visible labels (keep "Protect your wallet", "Kit passphrase", "Confirm passphrase", "Create my Recovery Kit", "Download Recovery Kit", "I saved it, continue", "Recovery Kit file", "Test my Kit", "Choose your daily limit", "Activate protection", "Your wallet is protected", "Go to my wallet"); English copy; MOCK/DEMO badges; Swissquote orange and SQ monogram.
- **Unresolved:** level-1 upgrade later (#21).

## Direction contract

THESIS: A Swiss onchain fintech at base.org's craft: white ground, ink, one fully saturated Swissquote orange that does real work, live chain facts, crisp corners. It refuses both the purple-gradient crypto wallet and the beige private-bank page.

OWN-WORLD: White and ink (#171717) with P3 Swissquote orange as the only committed colour (orange fills carry ink text); apricot fields for loss bounds; ink plates for anything Face ID signs. Hanken Grotesk for UI and display, JetBrains Mono for figures, addresses and status tokens. Corners 6–8px, hairline borders, flat surfaces. Signature: a generative candlestick chart on the ink panel (user request 2026-10-11, replacing the square field: orange candles close up, ink candles with a grey outline close down, constant left scroll, crosshair under the pointer, no asset or price labels) and, on every commit moment, a registered ink plate with crosshairs.

STORY: The visitor understands they hold the majority, sees the worst case as an amount before committing, and signs once with Face ID; nothing about Swissquote's role is hidden.

FIRST VIEWPORT: Desktop: left ink panel (40%) with the SQ logo, the live candlestick chart, the tagline and a live strip (fees 0.00 · Base Sepolia block · ● live). Right: a mono token bar (PROTECT · STEP 04/04 · BASE SEPOLIA ● LIVE), the step title at display size, the limit field with mono figures and presets, the loss bound as seven squares on apricot, the Face ID review as a registered ink plate, and the orange "Activate protection" button with ink text. Mobile: the panel collapses to the logo row; the token bar stays.

FORM: The onchain fintech standard (Base · Phantom), the canon card taken by the user, raised with crosshairs, ink plate and token bar on commit moments; seed key ba373c50 (re-roll 2, bolder).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
