---
version: 1
slug: "web-src-components-views-landingview-tsx"
primary_target: "web/src/components/views/LandingView.tsx"
related_targets: ["web/src/app/(marketing)/start/page.tsx"]
---

# Landing (/start)

Scope: public landing for new visitors at `/start`; a visitor without a wallet on the device lands here instead of `/welcome`. Mode: Persuade.
Audience: anyone new to SQure, Swissquote clients and non-clients alike, often on a phone; the jury sees it projected.
Action: Create your wallet (to `/welcome`); secondary: Phone lost or stolen? (to `/lost`).
Proof allowed: live on-chain facts (current Base Sepolia block, network fee 0.00, contract links to Basescan) and interactive simulations labelled Demo. No users, usage figures, testimonials, prices or partners.
Constraints: English copy, plain and calm; MOCK on anything Swissquote-side; nothing implies market performance.

## Direction contract
THESIS: The product is the spectacle: a real SQure screen floats over the live candle floor and walks the visitor through create, protect, pay and lock-out. Refuses the split hero (copy beside a phone mockup) and the row of feature cards.
OWN-WORLD: DESIGN.md as built: an ink first viewport with the generative candle chart full-bleed (orange rising candles, Plate Grey outlined falling ones), Hanken Grotesk display set tight, JetBrains Mono for figures and tokens, then white sections ruled by hairlines, ink plates with crosshairs, allowance cells, factor squares, 4px orange buttons with ink text; no shadows, blur or gradients.
STORY: The visitor understands self-custody without a seed phrase, that Swissquote never owns the Account, and that a stolen phone costs a bounded amount; believes it because the real mechanism works on screen and the chain facts are live; then creates a wallet.
FIRST VIEWPORT: Nav (logo, How it works, Security, Create your wallet). Centred 80px headline "Your keys. Swiss security." on one line at 1440, one-line lede, Create your wallet (orange) and Phone lost or stolen?. The candle chart fills the lower half edge to edge; the phone stands centred on the chart's baseline, two chapter ticks on each side of it along that baseline.
FORM: "The live phone on the trading floor", structure 7 of my 7, seed key 09687c3b. Signature interaction: the chapter ticks are the chart's time axis; a chapter advances every four candles (6.4s), pauses on hover or focus, jumps on click, and the phone's screen slides with it.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
