---
name: SQure
description: A Swiss onchain fintech wallet. White and ink, one saturated Swissquote orange, live chain facts, and a sealed ink plate for every commit.
colors:
  background: "#ffffff"
  surface: "#ffffff"
  surface-2: "#f5f5f4"
  ink: "#171717"
  muted: "#6b6b6b"
  border: "#e7e5e4"
  accent: "#ff5f0f"
  accent-hover: "#f25200"
  accent-fg: "#171717"
  accent-ink: "#c2410c"
  accent-soft: "#fff0e6"
  success: "#0f7a55"
  success-soft: "#e6f4ee"
  danger: "#c8302a"
  danger-soft: "#fbeae9"
  warning: "#9a5b00"
  warning-soft: "#fdf1dc"
  hero: "#171717"
  hero-2: "#232323"
  hero-fg: "#fafafa"
  hero-muted: "#a3a3a3"
typography:
  display:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"ss01\", \"cv11\""
  body-sm:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  figure-xl:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  figure:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "\"tnum\""
  token:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.12em"
rounded:
  cell: "3px"
  lg: "6px"
  xl: "8px"
  2xl: "10px"
  3xl: "12px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.xl}"
    height: "44px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.accent-fg}"
  button-primary-lg:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.xl}"
    height: "48px"
    padding: "0 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "44px"
    padding: "0 16px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "44px"
    padding: "0 16px"
  button-hero:
    backgroundColor: "{colors.hero-2}"
    textColor: "{colors.hero-fg}"
    rounded: "{rounded.xl}"
    height: "48px"
    padding: "0 20px"
  button-action:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.xl}"
    height: "64px"
    padding: "0 8px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.hero-fg}"
    rounded: "{rounded.xl}"
    height: "44px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "44px"
    padding: "0 14px"
  input-amount:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.figure-xl}"
    rounded: "{rounded.xl}"
    height: "60px"
  preset-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "36px"
    padding: "0 14px"
  preset-chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
  badge-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.lg}"
    padding: "2px 6px"
  badge-hero:
    backgroundColor: "{colors.hero-2}"
    textColor: "{colors.hero-muted}"
    rounded: "{rounded.lg}"
    padding: "2px 6px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: "20px 24px"
  loss-bound-field:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  plate:
    backgroundColor: "{colors.hero}"
    textColor: "{colors.hero-fg}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  allowance-cell:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.cell}"
    height: "24px"
  allowance-cell-empty:
    backgroundColor: "{colors.hero-2}"
    rounded: "{rounded.cell}"
    height: "24px"
  allowance-cell-pending:
    backgroundColor: "{colors.accent-soft}"
    rounded: "{rounded.cell}"
    height: "12px"
  allowance-cell-sm:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.cell}"
    height: "12px"
  factor-square:
    size: "10px"
  factor-square-sm:
    size: "8px"
  logo-mark:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.lg}"
    size: "32px"
---

# Design System: SQure

## Overview

**Creative North Star: "A Swiss onchain fintech at base.org's craft, with the registration plate's seal on commit moments"**

The wallet reads like a technical fintech, not a crypto toy and not a private bank. White ground, ink type, and one fully saturated Swissquote orange that does real work: it fills the primary action, fills the rising candles of the generative chart, and stamps the seal. The orange takes the place Base gives its blue. Warmth comes from that orange and from the apricot field that shows the worst case as an amount; precision comes from crisp corners, hairline borders and mono figures you can check against the chain.

Density is calm and single-column: one task per screen, the title at display size, then the facts. Live chain facts (network fee 0.00, the current Base Sepolia block, a live status square) sit beside the content as proof, never as decoration. Every moment where Face ID signs or something is committed onchain turns dark: an ink plate, registered by two crosshairs at opposite corners, with the orange Swissquote seal ("SPONSORED BY SWISSQUOTE · 2 OF 2 · USER MAJORITY") half off its top edge, turning slowly.

The system refuses both the purple-gradient crypto wallet and the beige private-bank page. Craft references are base.org (technical register, one committed colour, live facts, generative motion) and Phantom (warmth). The brand is a Swissquote-inspired prototype: the Swissquote name, its orange and the SQ monogram, no official assets.

**Key Characteristics:**
- White and ink with one committed colour, Swissquote orange, which always carries ink text.
- Hanken Grotesk for UI and display, tight and large; JetBrains Mono strictly for figures, addresses and status tokens.
- Crisp corners (6 to 10px), hairline borders, flat surfaces: no shadows.
- A generative, unlabelled candlestick chart on ink as the world's signature motion: orange rising candles, Plate Grey outlined falling ones, a crosshair under the pointer.
- Ink plates with crosshairs and a turning seal for everything Face ID signs; the Account itself is an ink plate because it is live onchain.
- Today's Face ID budget drawn as a row of ten square allowance cells that drain through the day and refill at 00:00 UTC.
- Light by default; dark follows the OS.

## Colors

A neutral white-and-ink ground with a single saturated orange, apricot tints for bounds, and status colours held to signals.

### Primary
- **Swissquote Orange** (accent; `color(display-p3 1 0.38 0.06)` on P3 screens, hex fallback in the frontmatter): fills for the primary button, the selected preset, the active stepper step, the SQ logo mark, the seal disc, rising candles in the candle field, lit allowance and delay cells, the "now" day square, and text selection. A fill, never a text colour on white.
- **Pressed Orange** (accent-hover; P3 `color(display-p3 0.95 0.33 0.02)`): hover state of orange fills.
- **Ember Ink** (accent-ink): the orange that is legible as text on light grounds (AA): focus rings, caret, link-like accents, the accent badge text, the focused input border. In dark mode it lightens to #ff8a4c.
- **Apricot Field** (accent-soft): the ground for loss bounds and the accent badge, and the soft focus ring around inputs. In dark mode it becomes orange at 14% alpha.

### Neutral
- **Ink** (ink, also accent-fg): all body and display type, the text on orange fills, the completed stepper step, the crosshairs, the amount field's 1.5px border.
- **Paper White** (background, surface): page ground and card surface; the same white, separated by hairlines, not by tone.
- **Stone Wash** (surface-2): hover ground for secondary and ghost controls, neutral badges, info alerts, the file drop zone, skeletons.
- **Graphite** (muted): secondary copy, hints, inactive tokens.
- **Hairline Stone** (border): 1px borders on cards, inputs, chips and list rules.
- **Plate Ink / Plate Rule / Plate White / Plate Grey** (hero, hero-2, hero-fg, hero-muted): the onboarding panel and every ink plate. hero-2 is the plate's border and its row rules, the unlit allowance and delay cells, and the candle field's grid rules. hero-muted outlines the candle field's falling candles and draws its last-price line and crosshair.

### Status
- **Ledger Green** (success, success-soft), **Signal Red** (danger, danger-soft), **Amber Note** (warning, warning-soft): validation, alerts, badges, the strength meter and the live square. Each has a lighter dark-mode value.

Dark mode (OS setting) swaps the ground to near-black (#0c0c0c, surfaces #151515 and #1d1d1d), type to #f5f5f5, and plates to #1a1a1a; orange fills stay the same.

### Named Rules
**The Ink-On-Orange Rule.** An orange fill always carries ink text (accent-fg), never white. When orange must be read as text on a light ground, use Ember Ink.

**The One Committed Colour Rule.** Swissquote orange is the only brand hue. Green, red and amber are signals, never decoration, and there is no second accent.

**The Factor Code Rule.** The user's three factors keep one code on every screen: the phone (Face ID) is an orange-filled square, the cloud account an ink-outlined square, the Kit passphrase an ink-filled square. On an ink plate, ink translates to Plate White (filled Kit, outlined cloud); orange stays orange. No other colours encode factors, and the Swissquote guardian never gets a square because it is never an owner.

## Typography

**Display Font:** Hanken Grotesk (with system-ui, sans-serif), stylistic sets ss01 and cv11 on
**Body Font:** Hanken Grotesk
**Label/Mono Font:** JetBrains Mono (with ui-monospace, monospace)

**Character:** A warm, slightly geometric grotesk set large and tight for titles, paired with a technical mono that only ever carries data. The pairing is the fintech register: words in the grotesk, numbers in the mono.

### Hierarchy
- **Display** (600, 3rem from 640px up, 1.05, -0.035em): the step title of each screen ("Choose your daily limit", "Your wallet is protected"), balanced. The onboarding panel's tagline uses the same register at 2.25 to 3rem with -0.03em.
- **Headline** (600, 2.25rem, 1.05, -0.035em): the display title on phones.
- **Title** (600, 0.875rem): section titles inside a step ("Three locks, all held by you") and card headers.
- **Body** (400, 1rem, 1.5): step descriptions in Graphite, under the display title.
- **Body small** (400 or 500, 0.875rem): field labels (500), list rows, plate rows, alerts. Hints and errors drop to 0.75rem.
- **Figure XL** (JetBrains Mono 600, 3rem, tabular): the amount being chosen, inside the amount field. The loss bound sits one step down at 2.25rem with its unit in the grotesk.
- **Figure** (JetBrains Mono 400, 1.25rem, tabular): the live strip's facts (fee, block, status).
- **Token** (JetBrains Mono 500, 11px, 0.12em, uppercase): stepper labels, the token bar, a plate's title, units inside fields ("USDC / DAY"), file metadata, and short verifiable status ("2 of 2 · yours", "Account · live onchain").
- **Balance** (JetBrains Mono 600, 3rem on phones and 3.75rem from 640px, tabular, -0.04em): the Account balance on its plate, and the amount on a review plate (2.25 to 3rem), with "USDC" in the grotesk beside it.
- **Route note** (Hanken Grotesk 500, 0.875rem, with a 600 lead such as "Needs your Kit:" or "Face ID alone:"): a sentence that says which factors a payment needs, preceded by its approval squares. Only the figures inside it are mono. It replaced an uppercase mono token that was illegible on a projector: guidance a user must read is a sentence, never a token.

### Named Rules
**The Mono-Is-Data Rule.** JetBrains Mono is reserved for figures, addresses, units and verifiable status. If the text is not a number, an address, a unit or a chain fact, it is set in Hanken Grotesk.

**The Two Decimals Rule.** Every displayed USDC amount shows exactly two decimals (formatUsdc): balances, limits, rows, review plates, notes. Rounded short forms are for input defaults, not for display.

**The Tight Display Rule.** Titles are semibold at 1.05 line-height with negative tracking (-0.03 to -0.035em). Display size is for the one title per screen.

## Layout

Onboarding is a two-column split from 1024px: an ink panel on the left (0.9fr) holding the logo, the candle field (200 to 340px tall), the tagline, and the live strip; content on the right (1.1fr) in a single column, top-anchored, max 560px wide (35rem). Below 1024px the panel disappears: a logo row with the mono token bar sits on top and the column narrows to 448px (28rem).

The quiet variant of the same shell serves the lost-phone flow (`/lost`): the panel steps back to the logo and the live strip, with no candle chart and no tagline, and narrows to 0.7fr against 1.3fr for the content, so the lock-out leads.

Inside a step, vertical rhythm is 24px between blocks (title, form, action), 16 to 20px inside forms, 6px between a label and its field. Plates take extra top margin (64px) so the seal's overhang has room. Panel padding is 40px (48px from 1280px). Lists use hairline top and bottom rules rather than boxes. Primary actions run full width at the bottom of the column. Breakpoints are Tailwind's 640, 1024 and 1280px.

## Elevation & Depth

The system is flat. The card shadow token is deliberately `none`, and no component casts a shadow. Depth comes from two moves only: hairline borders that separate white from white, and the ink plate, a dark slab that marks the one thing on the screen being signed or committed. Focus is shown with a 2px Ember Ink outline offset 2px (controls) or an Ember Ink border plus a 4px Apricot ring (text fields).

### Named Rules
**The Flat Ground Rule.** No box shadows, no blurs, no glass. If something needs to stand out, it is either orange (action) or ink (commitment).

**The Ink Plate Rule.** A dark plate on a light screen means a factor (Face ID, the Kit) will sign this, or this is now live onchain. Never use it for marketing or general grouping.

## Shapes

Rectangles are crisp: 6px for small controls (small buttons, chips, badges, the logo mark, stepper squares), 8px for buttons and inputs, 10px for cards, plates and the apricot field, 12px at most. Data cells go sharper still: day squares and allowance cells at 3px, strength-meter bars at 2px, candle bodies and factor codes square. Status markers in the token bar and live strip are small squares, not dots. The one deliberate circle is the Swissquote seal: an orange disc with mono ink type set on a ring around the SQ mark. Crosshairs (14px, 1px ink strokes) register plates at the top-left and bottom-right corners, overhanging by 7px.

### Named Rules
**The Crisp Corner Rule.** Nothing rectangular exceeds 12px radius. The seal is the only circle in the world's vocabulary.

## Components

### Buttons
Crisp, solid, decisive.
- **Shape:** gently squared (8px; 6px at the small 36px size).
- **Primary:** orange fill with ink text, semibold, 44px tall (48px for the screen's main action, full width).
- **Hover / Focus:** fill shifts to Pressed Orange over 150ms; press scales to 0.97; keyboard focus shows the Ember Ink outline. Disabled drops to 45% opacity.
- **Secondary:** white with a hairline border, Stone Wash on hover. Used after an action is done ("Downloaded · download again").
- **Ghost:** no border, Stone Wash on hover.
- **Danger:** Signal Red fill, white text.
- **Hero:** the secondary action on an ink plate: Plate Rule fill, Plate White text, Plate White at 15% on hover. The primary on a plate stays orange.
- **Action size:** the plate's main actions (Send, Receive, Earn). On phones a 64px tile in a three-column grid, 20px icon over the label; from 640px the 48px large button with the icon beside the label. A disabled action keeps the same size as a Plate Rule outline in Plate Grey with a "Soon" badge.
- **Icons** inside buttons never shrink.

### Chips (presets)
- **Style:** 36px mono figures on white with a hairline border, 6px corners; the suggested value carries a small "suggested" in the grotesk.
- **State:** selected is an orange fill with ink text and no border (the Ink-On-Orange Rule), with the same 0.97 press.

### Badges
Small 6px tags, 12px medium text: neutral (Stone Wash with a hairline), accent (Apricot with Ember Ink), success, danger, warning on their soft grounds, and hero (Plate Rule with Plate Grey, no border), the neutral badge on an ink plate. Warning marks DEMO and MOCK states. "Soon" is always the neutral badge (hero tone on a plate), in the sidebar, on plates and on cards, never a mono token.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** white, or the apricot field for a loss bound.
- **Shadow Strategy:** none (Flat Ground Rule).
- **Border:** 1px hairline; the apricot field has none.
- **Internal Padding:** 20px, 24px from 640px.

### Inputs / Fields
- **Style:** 44px, white, 1px hairline, 8px corners, 14px side padding; label above in 14px medium, hint or error below in 12px.
- **Focus:** border turns Ember Ink with a 4px Apricot ring over 150ms; caret is Ember Ink.
- **Error:** message in Signal Red replaces the hint.
- **Amount field:** 60px tall with a 1.5px ink border, the value in 48px mono semibold, the unit as a token pinned right.

### Navigation (stepper)
A row of 24px squares (6px corners) joined by hairlines: done is ink with a check, active is orange with ink numerals, pending is a hairline outline. Labels are tokens; on phones only the active label stays. Items size from their labels (flex-auto), so a label is never cut with an ellipsis while the row has room.

### Ink Plate (signature)
The commit surface. Plate Ink ground, Plate Rule border, 10px corners, 20 to 24px padding, crosshairs at two corners, a 120px seal overhanging the top edge by 56px at the right. Its title is a token in Plate Grey, and it reserves room for the seal on the right only when the plate carries one; its content is a definition list of rows (label in Plate Grey left, fact in Plate White right, hairline rules between). Addresses inside it use the hero-toned address chip. The plate's title names who approves ("Face ID and your Kit will approve"), and the seal goes only on the commit that needs both factors and is the step's own action: a plate signed by the Kit alone ("Your Kit will start the lock-out") or one set inside an alert ("Face ID and your Kit will stop it") carries none.

### Account Plate (signature)
The Account as a live object, under the Ink Plate Rule. Header: a token in Plate Grey ("Account · live onchain") led by a 6px live square (Ledger Green when the chain answers, Plate Grey otherwise), and the hero-toned address pill at the right from 640px (on phones the top bar carries the address). Then the balance in the Balance figure, the allowance cells at the large size, and the action row: Send (primary), Receive (hero), Earn. Padding 20px, 24px from 640px. No seal: the seal stays on commit plates.

### Allowance Cells (signature)
Today's Face ID budget as ten square cells (3px corners), lit orange from the left for what Face ID can still spend; the rest are empty (Plate Rule on a plate; Stone Wash with a hairline inset ring on white). Two tones (hero on an ink plate, light on white cards) and two sizes (24px tall with 6px gaps on the Account plate; 12px with 4px gaps in the Send rail). Above the row a 14px label ("Face ID can still spend today") and "Resets in" with a mono duration; below it the remaining and the limit as mono figures with "USDC left". In Send the cells preview the amount being typed: cells a Face ID payment will use turn outlined (Apricot fill, or Plate Rule on a plate, with a 1px inset orange ring) and the line reads "left after this payment"; a payment that needs the Kit leaves the cells untouched and adds a sentence led by an ink factor square. When a payment lands, cells drain from the right with a 30ms stagger over 300ms.

### Factor Squares
The single implementation of the Factor Code Rule: a square of 10px (8px in dense rows and legends), with the hero tone on plates. Approval squares show which factors approved a payment: orange alone for Face ID alone, orange then ink for Face ID + Kit. They appear on outgoing activity rows (with a legend above the list), in a review plate's Approval row, and before the Send route note.

### Custody Strip
A white card that says who can move the money: "Wallet protected" as the title with a mono "2 of 2 · yours" token at the right, then factor rows under a hairline (factor square, name in 500, one muted line of what it can do): This phone, Recovery Kit, and, for linked clients only, Swissquote as guardian with an empty square column. It closes with an Ember Ink link to Security and a muted outbound link to Basescan.

### Seal (signature)
120px orange disc; the ring text "SPONSORED BY SWISSQUOTE · 2 OF 2 · USER MAJORITY" in 9-unit mono semibold ink, fitted exactly to the ring, turning once every 28s (still under reduced motion); "SQ" centred in 700 grotesk. Appears only on plates.

### Candle Field (signature)
A canvas on the onboarding ink panel: a generative candlestick chart, unlabelled (no asset, no prices, no axes). It evokes the trading bank; it is never market data. Candles sit on a 16px pitch with 10px bodies. A rising candle is filled Swissquote Orange (P3 where available), body and wick; a falling candle is a 1px Plate Grey outline over the ink ground, its wick split around the body. Four Plate Rule hairlines stand in for a grid. The last price is a Plate Grey dashed hairline at 40%; only its 6px square marker at the right edge takes the live candle's colour. Under the pointer, a full-bleed Plate Grey crosshair (the plates' registration mark at chart scale), with the hovered candle boxed in a 1px outline. Candles fade out over their last 48px on the left.

The price is a seeded, range-bound walk with no drift: the chart must never imply performance. One candle forms every 1.6s while a pixel-snapped layer slides left at a constant linear pace, redrawn every frame; the live close glides over 90ms and the vertical scale eases over 450ms, so a new high never snaps the chart. Under reduced motion it is one still frame with a half-formed newest candle. The loop runs only while the canvas is on screen and the tab is visible. Hidden from assistive tech (aria-hidden).

### Live facts
- **Token bar:** a wrapping line of tokens in Graphite separated by middots, ending with "Base Sepolia", the block number, and a green square with "Live" ("Connecting" in grey after a missed poll). Shown on phones above the content.
- **Live strip:** on the ink panel, three columns under a Plate Rule line: Network fee "0.00", Base Sepolia block, Status, each a 12px Plate Grey label over a 20px mono figure.

### Loss bound
An apricot field: a 14px sentence, the worst case as a 36px mono figure with its unit, and a row of 28px squares numbered in 11px mono: a leading solid orange "now" square for what can still go today, then one square at orange 45% per daily reset during the delay. A closing sentence spells the sum out with its mono figures. Used at setup and on the lock-out step.

**The Loss Bound Truth Rule.** The worst case is what is left today plus one daily limit per reset during the delay, computed exactly and shown with two decimals. Never "about", never rounded up for effect.

### Lock-out Countdown Plate
The pending lock-out as a live object, under the Ink Plate Rule and without a seal (it is live onchain, not a commit). Title: the token "Lock-out · live onchain" led by the 6px live square. Then the remaining time in the Balance figure register (mono 600, 3.75rem, -0.04em), counting exactly to the onchain deadline, a muted line "until the old phone is locked out", and ten delay cells in the allowance cells' grammar (24px tall, 6px gaps, 3px corners) lit orange from the left as the delay elapses, Plate Rule when unlit. Under them "Started" and "Takes effect" clock times in 12px mono at either end. Rows: Old phone (address and what it can still spend a day), New device ("This device" and its address), Can stop it (approval squares and "The old phone + your Kit"). It closes with a Plate Grey Basescan link.

### Lock-out alert (old phone)
A Signal Red banner on danger-soft (danger at 30% for the border, 10px corners) above the content on every page of the old phone: a 44px Signal Red icon tile, "Someone asked to lock this phone out" in semibold, the remaining time as a mono figure in the sentence, and a danger button "This wasn't me". It opens a panel inside the banner, under a danger hairline: the Kit passphrase field, the stop plate as the last block, the danger button, and the ghost "Demo: try with Face ID only" button.

### Refusal as evidence
When the Account refuses a single-factor attempt, the proof is shown, not paraphrased: an orange factor square beside an outlined empty square (1 of 2), "Refused by your Account" in Signal Red semibold, the Safe's code as mono data ("GS020 · 1 of 2 factors"), then one muted sentence of why. It scrolls into view when it lands.

### Locked-out screen
A centred white card on the page ground: a Signal Red icon on danger-soft, "This phone was locked out", one muted paragraph, a muted Basescan link to the Account's owners, and a secondary button to remove the wallet from the phone.

### Motion
Entrances are for rare, first-time screens: fade up 8px over 280ms, or scale from 0.9 over 320ms, both on cubic-bezier(0.23, 1, 0.32, 1). State changes run 150 to 200ms. Allowance cells change over 300ms, draining from the right with a 30ms stagger. Reduced motion collapses all of it.

## Do's and Don'ts

### Do:
- **Do** put ink text on every orange fill and use Ember Ink when orange has to be read as text.
- **Do** show risk as a number before the user commits: limits, loss bounds and delays in mono figures on the apricot field.
- **Do** put everything Face ID signs on an ink plate, with crosshairs and the seal, as the last block before the action.
- **Do** keep live chain facts (fee, block, live status) visible in the shell: the live strip on desktop, the token bar on phones.
- **Do** use the Factor Code Rule squares whenever the phone, the cloud account and the Kit appear together.
- **Do** draw today's Face ID budget as the ten allowance cells, with the remaining, the limit and the reset time beside them.
- **Do** compute the loss bound exactly (what is left today plus one daily limit per reset) and lead its day squares with a "now" square.
- **Do** show a refusal by the Account as evidence: the approval squares that signed, the outlined one that did not, and the Safe's code in mono.
- **Do** call the device in hand "this device" in the lost-phone flow (it may be a laptop) and the other one "the old phone".
- **Do** show every displayed USDC amount with two decimals.
- **Do** say which factors a payment needs in a sentence with approval squares, mono only for the figures.
- **Do** use the tokens in `globals.css` and the kit in `web/src/components/ui`, never raw colours.

### Don't:
- **Don't** set white text on Swissquote orange.
- **Don't** add box shadows, glass or blur; the card shadow token stays `none`.
- **Don't** introduce a second accent, purple gradients, or a beige private-bank palette.
- **Don't** use JetBrains Mono or uppercase tokens as a decorative kicker above a headline; tokens label data.
- **Don't** round rectangles beyond 12px or turn markers into pills; the seal is the only circle.
- **Don't** place the seal anywhere but on a commit plate, and never more than one per screen.
- **Don't** give the Swissquote guardian a factor square; it is never an owner.
- **Don't** set "Soon" or other non-data labels as mono tokens; use the kit's neutral badge.
