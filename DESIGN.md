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
  rate:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  section:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.56
    letterSpacing: "-0.025em"
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
  asset-picker:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.token}"
    rounded: "{rounded.lg}"
    height: "36px"
    padding: "0 28px 0 10px"
  quote-field:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "64px"
    padding: "0 8px 0 14px"
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
  protocol-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "20px 24px"
  action-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "20px 24px"
  loss-bound-field:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  loss-bound-field-roomy:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "20px 24px"
  worst-case-change:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "16px 20px"
  day-square:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.cell}"
    size: "28px"
  day-square-lg:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.cell}"
    size: "36px"
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
    textColor: "{colors.hero}"
    rounded: "{rounded.lg}"
    size: "28px"
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
- **Swissquote Orange** (accent; `color(display-p3 1 0.38 0.06)` on P3 screens, hex fallback in the frontmatter): fills for the primary button, the selected preset, the active stepper step, the logo mark, the seal disc, rising candles in the candle field, lit allowance and delay cells, the "now" day square, and text selection. A fill, never a text colour on white.
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
- **Section** (600, 1.125rem, tight -0.025em): the title of a section on an app page ("Who can do what", "Rules of your Account"), a protocol card's name, an action panel's heading. A muted 14px subline may follow it.
- **Title** (600, 0.875rem): section titles inside a step ("Three locks, all held by you") and card headers.
- **Body** (400, 1rem, 1.5): step descriptions in Graphite, under the display title.
- **Body small** (400 or 500, 0.875rem): field labels (500), list rows, plate rows, alerts. Hints and errors drop to 0.75rem.
- **Figure XL** (JetBrains Mono 600, 3rem, tabular): the amount being chosen, inside the amount field. The loss bound sits one step down at 2.25rem with its unit in the grotesk (on the Security page it stands as the page's figure at 3rem, 3.75rem from 640px, -0.04em, with its unit in the 20px grotesk), and so do the amount being given (Send, Swap) and Swap's quote, at 2.25rem with tight tracking; on phones these step down to 1.875rem, then 1.5rem, before they would clip (`amountFit`).
- **Figure** (JetBrains Mono 400, 1.25rem, tabular): the live strip's facts (fee, block, status).
- **Rate** (JetBrains Mono 600, 1.875rem, tabular, tight): a protocol's variable rate on its card, followed by "a year, variable" in 14px Graphite grotesk.
- **Token** (JetBrains Mono 500, 11px, 0.12em, uppercase): stepper labels, the token bar, a plate's title, units inside fields ("USDC / DAY"), file metadata, and short verifiable status ("2 of 2 · yours", "Account · live onchain", "Lent · live onchain").
- **Balance** (JetBrains Mono 600, 3rem on phones and 3.75rem from 640px, tabular, -0.04em): the Account balance on its plate, and the amount on a review plate (2.25 to 3rem), with "USDC" in the grotesk beside it.
- **Route note** (Hanken Grotesk 500, 0.875rem, with a 600 lead such as "Needs your Kit:" or "Face ID alone:"): a sentence that says which factors a payment needs, preceded by its approval squares. Only the figures inside it are mono. It replaced an uppercase mono token that was illegible on a projector: guidance a user must read is a sentence, never a token.

### Named Rules
**The Mono-Is-Data Rule.** JetBrains Mono is reserved for figures, addresses, units and verifiable status. If the text is not a number, an address, a unit or a chain fact, it is set in Hanken Grotesk.

**The Amount Precision Rule.** An amount is shown at one of three precisions, never by taste.
- **Exact:** what is given, received or signed shows to the last unit, up to six decimals ("0.498962 EURC", "0.50 USDC"): the review plate's hero amount, Allow, the receipt, the simulation preview and the typed confirmation (`formatAssetExact`, `formatUsdcExact`).
- **Asset precision:** balances, lists and quotes show two decimals for USDC and EURC and up to six for ETH, always rounded down so they never show more than there is (`formatUsdc`, `formatAsset`). Activity rows and the Account plate use this precision.
- **Minimums** ("At least") are rounded down.
- **Inputs** take at most six decimals, and Max fills the whole balance to the sixth decimal.

Rounded short forms ("3,500") are for limits and input defaults only. Rates keep their own discipline: a percentage with two decimals ("1.25%"), always with "variable" beside it, never a promised return; a swap rate reads "1 USDC = 0.9979 EURC" with four significant decimals.

**The Tight Display Rule.** Titles are semibold at 1.05 line-height with negative tracking (-0.03 to -0.035em). Display size is for the one title per screen.

## Layout

Onboarding is a two-column split from 1024px: an ink panel on the left (0.9fr) holding the logo, the candle field (200 to 340px tall), the tagline, and the live strip; content on the right (1.1fr) in a single column, centred vertically (a step taller than the screen starts at the top, never clipped), max 560px wide (35rem). Below 1024px the panel disappears: the logo and the mono token bar sit centred on top, and the column narrows to 448px (28rem), still centred vertically in the space below.

The quiet variant of the same shell serves the lost-phone flow (`/lost`): the panel steps back to the logo and the live strip, with no candle chart and no tagline, and narrows to 0.7fr against 1.3fr for the content, so the lock-out leads.

Inside a step, vertical rhythm is 24px between blocks (title, form, action), 16 to 20px inside forms, 6px between a label and its field. Plates take extra top margin (64px) so the seal's overhang has room. Panel padding is 40px (48px from 1280px). Lists use hairline top and bottom rules rather than boxes. Primary actions run full width at the bottom of the column. In the app shell the sidebar runs Overview, Send, Receive, Earn, Swap, Handle, Swissquote, Activity, Security; a task screen with a reference list (Swap) puts it in a 340px aside from 1024px, under the task on phones. A page of proof (Security) sets its sections in pairs on a 7fr/5fr grid from 1024px (24px gap for the plate row, 40px for the section rows), stacked on phones, with 48px between rows; the wider column carries the plate, the matrix and the rules, the narrower one the worst case, the scenarios and this phone. Breakpoints are Tailwind's 640, 1024 and 1280px. Page gutters are 20px on phones (app header, content, onboarding), 24px from 640px, 40px on desktop content.

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
- **Action size:** the plate's main actions (Send, Receive, Swap, Earn). On phones a 64px tile in a four-column grid, 20px icon over the label; from 640px the 48px large button with the icon beside the label. A disabled action keeps the same size as a Plate Rule outline in Plate Grey with a "Soon" badge.
- **Icons** inside buttons never shrink.

### Chips (presets)
- **Style:** 36px mono figures on white with a hairline border, 6px corners; the suggested value carries a small "suggested" in the grotesk.
- **State:** selected is an orange fill with ink text and no border (the Ink-On-Orange Rule), with the same 0.97 press.

### Badges
Small 6px tags, 12px medium text: neutral (Stone Wash with a hairline), accent (Apricot with Ember Ink), success, danger, warning on their soft grounds, and hero (Plate Rule with Plate Grey, no border), the neutral badge on an ink plate. Warning marks DEMO and MOCK states. "Soon" is always the neutral badge (hero tone on a plate), in the sidebar, on plates and on cards, never a mono token.

**The Soon Slot.** A power the app does not build yet keeps its place and its control: the neutral "Soon" badge sits just before a disabled small secondary button that names the action (today only the security key's "Add a key"; the daily limit's "Change" and the lock-out delay's "Upgrade to level 1" now work). On a plate the slot is a row with a 10px empty outlined square in Plate Grey, the name and its line in Plate Grey, and the hero "Soon" badge at the right. Nothing in a Soon slot is orange, and it is never hidden.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** white, or the apricot field for a loss bound or a worst case before → after.
- **Shadow Strategy:** none (Flat Ground Rule).
- **Border:** 1px hairline; the apricot field has none.
- **Internal Padding:** 20px, 24px from 640px.

### Inputs / Fields
- **Style:** 44px, white, 1px hairline, 8px corners, 14px side padding; label above in 14px medium, hint or error below in 12px.
- **Focus:** border turns Ember Ink with a 4px Apricot ring over 150ms; caret is Ember Ink.
- **Error:** message in Signal Red replaces the hint.
- **Amount field:** 60px tall with a 1.5px ink border, the value in 48px mono semibold, the unit as a token pinned right. The daily limit takes it as one shared field, `LimitPicker` ("USDC / day" token, presets 100 / 250 / 500 / 1,000, 44px on phones), in the protect flow and in Change the daily limit; on phones its 48px figure steps down past 6 characters (`amountFit`). The amount being given (Send, Swap, Earn) is 64px with the value in 36px mono semibold; on phones it steps down to 30px, then 24px, before it would clip (`amountFit(text, fits)`, 7 characters in Send, 9 in Swap). Max is in Ember Ink: in Send beside the unit, in Swap beside the balance in the label row ("Balance 1.00 USDC  Max"), small, with its hit area enlarged by a pseudo-element.
- **Asset picker:** a native select styled as a token chip (36px, white, hairline, 6px corners, a chevron in Graphite), pinned inside the amount field. 44px on phones.
- **Tap targets:** every control is at least 44px on phones (`max-sm:h-11`), even when it is 36px on desktop. A text link set inside a line (the Overview's "Change") gets its 44px through negative margins (`-my-3 min-h-11`), without moving the line.
- **Kit file drop zone:** a dashed hairline well on Stone Wash (8px corners), Ember Ink border on hover; keyboard focus shows on the zone itself (`focus-within`: Ember Ink border and the 4px Apricot ring), wherever a Kit is asked for (Send, Swap, Earn, the limit change, the lock-out and the stop).
- **What a field accepts:** each field filters as it is typed or pasted (`lib/inputs.ts`, ADR-033); a refused character simply does not appear, with no error for it.
  - **Amounts** take digits and one decimal point: a lone "," is the point, and thousands separators, spaces and apostrophes are dropped. Up to six decimals, two for the daily limit, payment requests and Swissquote transfers.
  - **A recipient** takes a 0x address or an @handle, and pulls the address out of a pasted payment URI.
  - **Names** take letters, spaces, apostrophes and hyphens.
  - **Kit passphrases** accept anything.
- **Handle field:** the "@" is printed in Graphite inside the field on the left (32px padding). Only a lowercase letter, then letters, digits or "_" can be typed, 20 at most.

### Navigation (stepper)
A row of 24px squares (6px corners) joined by hairlines: done is ink with a check, active is orange with ink numerals, pending is a hairline outline. Labels are tokens; on phones only the active label stays. Items size from their labels (flex-auto), so a label is never cut with an ellipsis while the row has room.

### Ink Plate (signature)
The commit surface. Plate Ink ground, Plate Rule border, 10px corners, 20 to 24px padding, crosshairs at two corners, a 120px seal overhanging the top edge by 56px at the right. Its title is a token in Plate Grey, and it reserves room for the seal on the right only when the plate carries one; its content is a definition list of rows (label in Plate Grey left, fact in Plate White right, hairline rules between). A row's label never wraps; the fact wraps under it, right-aligned, and may carry a second 12px Plate Grey line. Addresses inside it use the hero-toned address chip. The plate's title names who approves ("Face ID and your Kit will approve"), and the seal goes only on the commit that needs both factors and is the step's own action: a plate signed by the Kit alone ("Your Kit will start the lock-out") or one set inside an alert ("Face ID and your Kit will stop it") carries none.

### Account Plate (signature)
The Account as a live object, under the Ink Plate Rule. Header: a token in Plate Grey ("Account · live onchain") led by a 6px live square (Ledger Green when the chain answers, Plate Grey otherwise), and the hero-toned address pill at the right from 640px (on phones the top bar carries the address). Then the balance in the Balance figure; under it, only when the Account holds some, one 14px Plate Grey line of the other assets at asset precision ("+ 0.49 EURC · 0.000314 ETH", figures in mono). Then the allowance cells at the large size, and the action row: Send (primary), Receive, Swap and Earn (hero). Padding 20px, 24px from 640px. No seal: the seal stays on commit plates.

### Positions Plate
What the Account has lent, under the Ink Plate Rule because it is live onchain; no seal. Title: the token "Lent · live onchain" led by the 6px live square. Then the total in the Balance figure with "USDC" in the grotesk, and one plate row per approved protocol: the amount in mono with "USDC", then the rate in mono Plate Grey. It closes with a 12px Plate Grey footnote: "Testnet rates, variable. Swissquote neither holds the positions nor promises a return."

### Protocol Card
One per approved protocol, side by side from 1024px, stacked on phones. White, 10px corners, hairline border, 20px padding (24px from 640px), no logos. The name in 18px semibold with the neutral "Approved" badge at the right: every listed card is approved, so it never takes the accent badge. The rate in the Rate figure with "a year, variable"; one 14px line of what the protocol is, then its risks in Graphite. Hairline-ruled rows: "You lend" (mono amount, "USDC") and "Contract" (the short address in 12px mono Graphite, linked to Basescan with an outbound icon). Deposit is a large secondary button, joined by Withdraw (secondary) once there is a position; a single action spans the card. The card in action takes an ink border instead of a hairline; it never gets an orange button, so the screen keeps one orange action.

### Action Panel
A protocol action opens under the cards as one bordered panel (1px ink border, 10px corners, 20 to 24px padding): the heading "Deposit to Aave v3" / "Withdraw from …" in 18px semibold with a muted Cancel at the right, then the world's stepper (Amount → Review → Done). The amount step is the Send amount field (1.5px ink border, mono figure, Max in Ember Ink, the unit as a token) and the full-width primary Continue. The review is a sealed plate, "Face ID and your Kit will approve", with the amount in the Balance figure and rows Allow (the exact amount, plus the hero address chip) and Supply, or Withdraw ("back to your Account"), then Approval (approval squares) and Network fee. Under it, hairline-ruled sections with no inner boxes: the checks, the risk checkbox (ink accent colour), and the Kit; then Back (secondary) beside "Approve with Kit and Face ID" (primary). On phones the panel scrolls into view when it opens, with the amount field focused (instant under reduced motion). The receipt is a plate without a seal, titled by the event ("Deposit confirmed · onchain" / "Withdrawal confirmed · onchain"), showing the amount that was signed, rows Lent to / Back from, Approved by, Network fee, and a Basescan link.

### Swap Card
The `/swap` details, in the same white bordered card (10px corners, 20 to 24px padding), beside an aside from 1024px (340px). "You give" is the amount field being given, holding only the asset picker; the label row carries "Balance" with the mono balance and Max. Under it, a 36px flip button (44px on phones, hairline, 6px corners, the up-down arrows) centred between the two sides. "You get about" is the quote field: a Stone Wash well (64px, 8px corners, no border) with the quote in the same mono figure, Graphite until a quote lands, announced politely (`aria-live`) and refreshed every 15 s, and the second asset picker. Then hairline-ruled rows, label in Graphite left, fact right: Rate ("1 USDC = 0.9979 EURC" in mono), At least (the minimum in mono, rounded down, "· 0.5% slippage" in Graphite), Pool ("Uniswap v3 · 0.05% fee"). When ETH is on either side, a 12px Graphite note says the testnet pool price is far from real markets. A missed quote reads "Couldn't get a quote from the network. Retrying…" in Graphite; an amount no pool can fill reads "No Uniswap pool can fill this amount right now." in Signal Red. The card closes with the full-width primary "Review swap".

The aside, "Your Account holds", lists the three assets on hairline rows (name, symbol in Graphite, mono balance at asset precision) and a 12px Graphite line that swaps go through an approved contract and need Face ID and the Kit.

The review replaces the card, with the Action Panel's grammar and no panel border: the sealed plate "Face ID and your Kit will approve", the amount given exact in the Balance figure with its symbol in the grotesk, rows At least (the minimum, with "Expected … · if less, nothing happens" beneath), Allow ("Uniswap v3 to take exactly … , no more" and the hero address chip), Swap ("In the 0.05% pool, back to your Account"), Approval (approval squares) and Network fee ("Covered by Swissquote"). Then the checks before Face ID, the Kit, and Back beside "Approve with Kit and Face ID". The receipt is the plate without a seal, "Swap confirmed · onchain": You gave and You got, exact, read from the transaction's own Transfer logs ("You got at least" with the minimum when they cannot be read), Approved by, Network fee, a Basescan link, then the large secondary "Swap again".

### Activity Row
One row per USDC movement: a 36px icon tile (6px corners), a 14px medium title with approval squares at the small size, a 12px Graphite subtitle that truncates, and the USDC figure in mono at asset precision at the right (Ledger Green when it comes in). Sent and received rows read "Sent USDC" / "Received USDC" with "To 0x…" / "From 0x…" and the time. A swap is one row, never two: a neutral tile (Stone Wash, ink Repeat icon) in both directions, "Swapped to EURC" or "Swapped from ETH", approval squares on both directions, and "Got 0.49 EURC · Uniswap v3 · 03:55" (or "Gave …"), the venue hidden on phones.

### Security Page
`/security` is a proof, not a settings list: who can move the money, as the chain reports it. Under the page header ("Who can move your money, read live onchain.") the rows run on the Layout's 7fr/5fr grid:
- **Owners plate and worst case.** An ink plate without a seal, titled "Owners of your Account · live onchain" with the 6px live square. Owner rows: factor square, name in 14px medium Plate White, one 12px Plate Grey line, the hero address pill at the right. "This phone" (orange, its Key Safe; "Being locked out · m:ss left" in Plate White under it while a lock-out is pending), "Recovery Kit" (Plate White square, its owner key), any "Another owner" not added by the app (a filled Plate Grey square, "Not added by this app"), then the Security key Soon slot. A plate-ruled footer reads "Above your daily limit" left and "2 of 2 needed · both yours" right (mono figures), stacked on phones. Last, the Swissquote block: "Swissquote" in 14px medium, the verdict "Not an owner" in 20px semibold at the right (announced politely), then one Plate Grey sentence naming its guardian key and treasury in mono, only once the live comparison has passed. If Swissquote's keys do not load, the verdict reads "Not checked" with a "Try again" link; if one is an owner, "Listed as an owner" with a warning-icon sentence in Plate White. It closes with "Verify the owners on Basescan ↗". Beside it, the roomy loss bound, as tall as the plate.
- **"Who can do what"** (the Powers Matrix) beside **"If something goes wrong"**: four scenarios on hairline rows, the title in 14px medium, the body in Graphite, the worst case in mono ink.
- **"Rules of your Account"** beside **"This phone"** and the forget box. Rules are hairline rows of a Graphite label, the value in medium (figures in mono), a Graphite detail line, and a control at the right (under the text on phones): daily limit (amount, spent today, reset) with a working "Change"; lock-out delay ("7 days (3 min in this demo)" or "3 days …", the level in its detail line) with a working "Upgrade to level 1" at level 0 and no control at level 1; security key ("None") as the one Soon slot. The level is the one the chain enforces (`chainLevel`: level 1 when Swissquote's guardian key guards the lock-out), never the stored profile. "This phone" is a hairline definition list (label in Graphite left, fact right) ending in a status badge read from the Account: success "Owner of your Account", danger "Being locked out" or "No longer an owner".
- **Change the daily limit** (the In-Row Panel). The daily limit row's control is a working small secondary "Change" (44px on phones); it opens the panel under the row, inside the row's hairlines, and reads "Cancel" while it is open, then disappears once the receipt shows. Closing gives focus back to "Change". `/security?change=limit` opens the page with the panel open; that is where the Overview's "Change" lands. The panel, in order: `LimitPicker` labelled "New daily limit", prefilled with the current limit; the Worst Case Change; the sealed plate "Face ID and your Kit will approve" (Daily limit with "Now …" under it, Worst case, Approval squares, Network fee "Covered by Swissquote"); the Kit section, whose copy says why lowering needs the Kit too ("Up or down, your limit only changes with your Kit"); then Cancel (secondary) beside "Approve with Kit and Face ID" (primary), both large. The receipt is the plate without a seal, "Limit changed · onchain" (Daily limit with "Was …", Worst case, Approved by, Network fee, View on Basescan), then a large secondary "Done"; the whole row scrolls back into view, its new value above the receipt, and focus moves to the receipt.
- **Upgrade to level 1** (the In-Row Panel, `LevelUpgrade`). The lock-out delay row's "Upgrade to level 1" opens the panel under the row. It first shows a Gate Block when the upgrade cannot run: a skeleton while loading, "Your Account is already at level 1" (Close), "Level 1 is for Swissquote clients who linked this wallet" (primary "Link your Swissquote account" to `/swissquote` beside a secondary "Not now"), "A lock-out is in progress" (Close), or "Couldn't load Swissquote's guardian key" (primary "Try again" beside Close). Linked, in order: the Worst Case Change (4.00 → 2.00 USDC at a 0.50 limit; the sentence "Locked out after 3 days instead of 7 (… in this demo). And someone who steals your Kit and its passphrase can't lock your phone out: Swissquote checks your identity first."); the Third-Party Powers list "With level 1, Swissquote" and its trade line; 64px of air, then the sealed plate "Face ID and your Kit will approve" (Lock-out "3 days" with two Plate Grey sub-lines, "Your Kit + a Swissquote identity check" and "Now 7 days, your Kit alone"; New guardian "Swissquote" with the hero address pill under it; Worst case; Approval squares; Network fee "Covered by Swissquote"); the Kit section ("Changing who guards the lock-out takes your Kit, so a thief with your phone can't do it."); then Cancel beside "Approve with Kit and Face ID", both large. The receipt is the plate without a seal, "Level 1 · onchain" (Lock-out with its sub-line, Guardian with the address, Worst case, Approved by, Network fee, View on Basescan), then a large secondary "Done"; the row above now reads "3 days" and keeps no control.
- **One panel at a time.** Opening one rule's panel closes the other. `/security?change=limit` or `?change=level` opens that panel on every visit (`level` only at level 0, so a reload after the upgrade never reopens it); closing drops `?change=` from the URL. The page stays alive while hidden (Next 16 Activity), so open panels close when it is hidden: coming back never shows a stale form or receipt.
- **Forget this wallet on this device:** a white box with a 1px Signal Red border at 30%, 10px corners and 20px padding, a 16px semibold title and a muted paragraph. "Forget…" (small secondary) turns into "Keep it" (secondary) beside "Forget this wallet" (danger).

Each section is the Section title, an optional muted subline, then hairline rows, no cards. A wallet without an Account shows only a "Recovery" hairline list: the Kit's factor square, the Swissquote guardian with an empty square column, address pills, and a primary link to create the Account. No shield icons, no success badge.

**The In-Row Panel.** Changing a rule opens under its own row, between the row's hairlines, with no border or card of its own: the field, the before → after, the plate and the Kit stack as sections, and the row's control toggles Change ↔ Cancel. The level upgrade follows it with gates instead of a field; the security key's panel will too.

### Worst Case Change
The before → after of the loss bound when a rule changes (`WorstCaseChange`), on the apricot field (10px corners, 16px padding, 20px from 640px, no border). The 14px sentence "If your phone is stolen, a thief can take at most", then on one wrapping baseline: the current worst case muted (24px mono, ink at 60%), an arrow in the same tone, the new worst case large (36px mono semibold), then "USDC" in the 18px grotesk. Under it one sentence, `aria-live` and describing the field: the difference in mono ("4.00 USDC more than now" / "less than now") and what Face ID can still spend today, or "You spent 0.10 today: Face ID can't spend more until the reset". An unchanged value reads "That is your current limit: pick a new one." and an invalid one "Choose a limit from 0.01 to 1,000,000 USDC to see your new worst case."; in both only the current figure shows. The plate under it appears only once the value is valid and different. Both figures follow the Loss Bound Truth Rule. One component for every rule change (the daily limit and the level upgrade): a change with no field passes both figures from the start and writes its own sentence (the level's "Locked out after 3 days instead of 7 …"), and screen readers hear "Now" and "with level 1" before the figures.

### Third-Party Powers
A third party's powers, stated before signing: whenever a change gives an outside party (Swissquote) a role on the Account, the panel says what it can and never can do, above the plate. A 14px semibold title naming the party in a sentence ("With level 1, Swissquote"), then a hairline list (rule above the first line and under each) of 14px lines, each a 16px drawn lucide icon and a verb phrase that finishes the title: a Check in ink for what it can do ("has to confirm it's you before a lost phone is locked out"), an X in Graphite for what it never can ("never moves your money", "never locks you out on its own", "never becomes an owner of your Account"). The icons are never green or red: a power is not good news and a refusal is not an error. Only can-lines carry a screen-reader "Can: " prefix; the never-lines say it in words. A muted 14px line closes with the trade-off and the exit ("If Swissquote can't sign, a lock-out waits for it. Before ending the service, Swissquote moves you back to 7 days with your Kit alone."). The party gets no factor square.

### Gate Block
When a panel or a section cannot run its task yet, it says why in place of the form, without a card or an alert: a plain block of a 16px medium title that states the situation ("Level 1 is for Swissquote clients who linked this wallet"), one muted 14px line of what to do or what did not change ("Nothing changed. …"), then the actions in a wrapping row: the way forward as primary when there is one ("Link your Swissquote account", "Try again") beside a secondary "Not now" or "Close"; a dead end gets only "Close". Loading is a 96px skeleton at 10px corners.

### Level Callout
On `/swissquote`, right after the link, a quiet white section (1px hairline, 10px corners, 20px padding, no icon, no fill): the 16px semibold title "Your Account is at level 0" with a muted mono token at the right, "Kit alone · 7 days", wrapping under it on narrow widths; one muted 14px sentence of what linking unlocks (3 days instead of 7, the identity check, "Swissquote never becomes an owner"); then a secondary "Shorten the lock-out to 3 days" to `/security?change=level`. Never orange: the page's one orange fill stays its transfer action. At level 1 it reads "Level 1: lock-out after 3 days" with the token "Kit + identity check", a sentence ending "Swissquote is not an owner of your Account.", and no action. The level is read onchain.

### Powers Matrix
Powers × parties, for any screen that says who can do what. From 640px a table with hairline row rules: the power as the row header in 14px (a 12px Graphite detail under it, such as "After 7 days (3 min in this demo)"), then one column per party headed in 14px medium with its small factor square: Phone (orange), Kit (ink) and Swissquote with none, under the Factor Code Rule. A cell is small factor squares plus a few words: "alone", "together" spanning the Phone and Kit columns with both squares, "starts it" or "checks ID" at level 1; "never" and "—" (not needed) stand in Graphite without squares. Every cell carries screen-reader text ("yes, Face ID alone", "not needed"). Below 640px the table becomes a hairline list: the power in 14px medium, its detail, then one line of parties ("■ Phone alone", "■■ Phone + Kit together", "Swissquote never" in Graphite) with "not needed" dropped. A muted footnote closes it.

### Compliance Checks
A list of checks before Face ID, each a status icon, a 14px title and mono detail lines that wrap anywhere (never cut). On a dApp action the subject is the contract, not a recipient: "Protocol contract screened: not on sanctions lists", "Simulation: these steps would succeed" with one mono line per step, and "Large amount: type the amount to confirm" (on a payment, "Large payment"). The typed confirmation compares amounts, so "0.5" matches "0.50". Simulation lines name an approved dApp with its short address ("Allow Aave v3 (0x07eA…814b) to spend 0.50 USDC"); a transfer's recipient stays the full address, because it is what the user verifies.

### Allowance Cells (signature)
Today's Face ID budget as ten square cells (3px corners), lit orange from the left for what Face ID can still spend; the rest are empty (Plate Rule on a plate; Stone Wash with a hairline inset ring on white). Two tones (hero on an ink plate, light on white cards) and two sizes (24px tall with 6px gaps on the Account plate; 12px with 4px gaps in the Send rail). Above the row a 14px label ("Face ID can still spend today") and "Resets in" with a mono duration, optionally followed by " · " and an action (on the Overview, a "Change" link in Plate White, medium, underlined on hover, to `/security?change=limit`); below it the remaining and the limit as mono figures with "USDC left". In Send the cells preview the amount being typed: cells a Face ID payment will use turn outlined (Apricot fill, or Plate Rule on a plate, with a 1px inset orange ring) and the line reads "left after this payment"; a payment that needs the Kit leaves the cells untouched and adds a sentence led by an ink factor square. When a payment lands, cells drain from the right with a 30ms stagger over 300ms.

### Factor Squares
The single implementation of the Factor Code Rule: a square of 10px (8px in dense rows and legends), with the hero tone on plates. Approval squares show which factors approved a payment: orange alone for Face ID alone, orange then ink for Face ID + Kit. They appear on outgoing activity rows (with a legend above the list), in a review plate's Approval row, and before the Send route note.

### Custody Strip
A white card that says who can move the money: "Wallet protected" as the title with a mono "2 of 2 · yours" token at the right, then factor rows under a hairline (factor square, name in 500, one muted line of what it can do): This phone, Recovery Kit, and, for linked clients only, Swissquote as guardian with an empty square column. It closes with an Ember Ink link to Security and a muted outbound link to Basescan.

### Logo (PDR-027)
The mark is an orange square (6px corners at 28px) holding a smaller ink square in its lower-right corner, inset 4/32. These are the two factors that hold the Account, the phone and the Kit, in the Factor Code. The ink square never inverts, on white or on the ink panel. The wordmark "SQure" is set in one piece (Hanken Grotesk 700, 22px, −0.035em), with "by Swissquote" in 12px muted on its baseline. In the phone's top bar the endorsement drops below 380px. The mark alone is the app icon (`app/icon.svg`, `app/apple-icon`).

### Seal (signature)
120px orange disc; the ring text "SPONSORED BY SWISSQUOTE · 2 OF 2 · USER MAJORITY" in 9-unit mono semibold ink, fitted exactly to the ring, turning once every 28s (still under reduced motion); "SQ" centred in 700 grotesk. Appears only on plates.

### Candle Field (signature)
A canvas on the onboarding ink panel: a generative candlestick chart, unlabelled (no asset, no prices, no axes). It evokes the trading bank; it is never market data. Candles sit on a 16px pitch with 10px bodies. A rising candle is filled Swissquote Orange (P3 where available), body and wick; a falling candle is a 1px Plate Grey outline over the ink ground, its wick split around the body. Four Plate Rule hairlines stand in for a grid. The last price is a Plate Grey dashed hairline at 40%; only its 6px square marker at the right edge takes the live candle's colour. Under the pointer, a full-bleed Plate Grey crosshair (the plates' registration mark at chart scale), with the hovered candle boxed in a 1px outline. Candles fade out over their last 48px on the left.

The price is a seeded, range-bound walk with no drift: the chart must never imply performance. One candle forms every 1.6s while a pixel-snapped layer slides left at a constant linear pace, redrawn every frame; the live close glides over 90ms and the vertical scale eases over 450ms, so a new high never snaps the chart. Under reduced motion it is one still frame with a half-formed newest candle. The loop runs only while the canvas is on screen and the tab is visible. Hidden from assistive tech (aria-hidden).

### Live facts
- **Token bar:** a wrapping line of tokens in Graphite separated by middots, ending with "Base Sepolia", the block number, and a green square with "Live" ("Connecting" in grey after a missed poll). Shown on phones above the content.
- **Live strip:** on the ink panel, three columns under a Plate Rule line: Network fee "0.00", Base Sepolia block, Status, each a 12px Plate Grey label over a 20px mono figure.

### Loss bound
An apricot field: a 14px sentence, the worst case as a 36px mono figure with its unit, and a row of 28px squares numbered in 11px mono: a leading solid orange "now" square for what can still go today, then one square at orange 45% per daily reset during the delay. A closing sentence spells the sum out with its mono figures, with the warning "Demo" badge and the testnet delay while it is on. One component (`LossBound`) in two modes:
- **Compact** (setup, lock-out step): 16px padding, the figure and the squares on one row.
- **Roomy** (Security, beside the owners plate): 20 to 24px padding, stretched to the plate's height as a column spaced between its ends: the sentence and the figure at the top (mono 600, 48px, 60px from 640px), the day squares in the middle, the explanation at the bottom. Its squares take the large size: 28px, 36px from 1024px (`DaySquares size="lg"`), labels unchanged.

**The Loss Bound Truth Rule.** The worst case is what is left today plus one daily limit per reset during the delay, computed exactly and shown with two decimals. Never "about", never rounded up for effect.

### Lock-out Countdown Plate
The pending lock-out as a live object, under the Ink Plate Rule and without a seal (it is live onchain, not a commit). Title: the token "Lock-out · live onchain" led by the 6px live square. Then the remaining time in the Balance figure register (mono 600, 3.75rem, -0.04em), counting exactly to the onchain deadline, a muted line "until the old phone is locked out", and ten delay cells in the allowance cells' grammar (24px tall, 6px gaps, 3px corners) lit orange from the left as the delay elapses, Plate Rule when unlit. Under them "Started" and "Takes effect" clock times in 12px mono at either end. Rows: Old phone (address and what it can still spend a day), New device ("This device" and its address), Can stop it (approval squares and "The old phone + your Kit"). It closes with a Plate Grey Basescan link.

### Lock-out alert (old phone)
A Signal Red banner on danger-soft (danger at 30% for the border, 10px corners) above the content on every page of the old phone: a 44px Signal Red icon tile, "Someone asked to lock this phone out" in semibold, the remaining time as a mono figure in the sentence, and a danger button "This wasn't me". It opens a panel inside the banner, under a danger hairline: the Kit passphrase field, the stop plate as the last block, the danger button, and the ghost "Demo: try with Face ID only" button.

### Refusal as evidence
When the Account refuses a single-factor attempt, the proof is shown, not paraphrased: an orange factor square beside an outlined empty square (1 of 2), "Refused by your Account" in Signal Red semibold, the Safe's code as mono data ("GS020 · 1 of 2 factors"), then one muted sentence of why. It scrolls into view when it lands.

The same grammar answers an unlisted dApp. Inside a white card "Only approved dApps are sponsored" (a muted paragraph saying Swissquote approves contracts, not brands, then a secondary button "Demo: try an unlisted router"), the answer lands under a hairline: a ShieldX icon in ink, "Not sponsored by Swissquote" in semibold, the reason as a 12px mono line ("unapproved-dapp · Uniswap Universal Router 0x492E…4104"; Uniswap v3's SwapRouter02 is approved for swaps), then the paymaster's own message in muted 14px, wrapping anywhere. It scrolls into view when it lands.

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
- **Do** show what is given, received or signed exactly (up to six decimals), and balances, lists and quotes at the asset's precision, rounded down.
- **Do** make every control at least 44px tall on phones, and step a big mono amount down a size before it would clip.
- **Do** say which factors a payment needs in a sentence with approval squares, mono only for the figures.
- **Do** show a rate as a percentage with two decimals and "variable", next to a footnote that it is a testnet rate and not promised.
- **Do** mark the card or row in action with an ink border, and keep the screen's one orange fill for its primary action.
- **Do** name an approved dApp with its short address in readable steps, and keep a transfer's recipient as the full address.
- **Do** show a rule change as its worst case before → after on the apricot field, the current figure muted and the new one large, before the plate.
- **Do** open a rule's change under its own row, inside its hairlines, with no card of its own, and give focus back to the row's control when it closes.
- **Do** state a third party's powers before signing: a hairline list of what it can do (ink check) and never can do (Graphite X), above the plate.
- **Do** answer a task that cannot run with a Gate Block: the situation as the title, one muted line, the way forward or "Close".
- **Do** keep a power that is not built yet in place as a Soon slot: the neutral "Soon" badge beside its disabled small secondary button.
- **Do** say who can do what as a powers matrix of factor squares and a few words, a table from 640px and a list on phones.
- **Do** use the tokens in `globals.css` and the kit in `web/src/components/ui`, never raw colours.

### Don't:
- **Don't** set white text on Swissquote orange.
- **Don't** add box shadows, glass or blur; the card shadow token stays `none`.
- **Don't** introduce a second accent, purple gradients, or a beige private-bank palette.
- **Don't** use JetBrains Mono or uppercase tokens as a decorative kicker above a headline; tokens label data.
- **Don't** round rectangles beyond 12px or turn markers into pills; the seal is the only circle.
- **Don't** place the seal anywhere but on a commit plate, and never more than one per screen.
- **Don't** give the Swissquote guardian a factor square; it is never an owner.
- **Don't** colour a can / never-can list green and red; the check is ink, the X Graphite.
- **Don't** set "Soon" or other non-data labels as mono tokens; use the kit's neutral badge.
- **Don't** round a balance or a minimum up, or show a signed amount at list precision.
- **Don't** let a plate row's label wrap; the value wraps.
- **Don't** wrap a bordered panel's sections in cards of their own; separate them with hairline rules (plates, alerts and the Kit drop zone stay elements inside a section).
