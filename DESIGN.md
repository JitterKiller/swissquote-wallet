---
name: Swissquote Wallet
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
  logo-mark:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.lg}"
    size: "32px"
---

# Design System: Swissquote Wallet

## Overview

**Creative North Star: "A Swiss onchain fintech at base.org's craft, with the registration plate's seal on commit moments"**

The wallet reads like a technical fintech, not a crypto toy and not a private bank. White ground, ink type, and one fully saturated Swissquote orange that does real work: it fills the primary action, lights the generative block field, and stamps the seal. The orange takes the place Base gives its blue. Warmth comes from that orange and from the apricot field that shows the worst case as an amount; precision comes from crisp corners, hairline borders and mono figures you can check against the chain.

Density is calm and single-column: one task per screen, the title at display size, then the facts. Live chain facts (network fee 0.00, the current Base Sepolia block, a live status square) sit beside the content as proof, never as decoration. Every moment where Face ID signs or something is committed onchain turns dark: an ink plate, registered by two crosshairs at opposite corners, with the orange Swissquote seal ("SPONSORED BY SWISSQUOTE · 2 OF 2 · USER MAJORITY") half off its top edge, turning slowly.

The system refuses both the purple-gradient crypto wallet and the beige private-bank page. Craft references are base.org (technical register, one committed colour, live facts, generative motion) and Phantom (warmth). The brand is a Swissquote-inspired prototype: the Swissquote name, its orange and the SQ monogram, no official assets.

**Key Characteristics:**
- White and ink with one committed colour, Swissquote orange, which always carries ink text.
- Hanken Grotesk for UI and display, tight and large; JetBrains Mono strictly for figures, addresses and status tokens.
- Crisp corners (6 to 10px), hairline borders, flat surfaces: no shadows.
- A generative square field of orange cells on ink as the world's signature motion.
- Ink plates with crosshairs and a turning seal for everything Face ID signs.
- Light by default; dark follows the OS.

## Colors

A neutral white-and-ink ground with a single saturated orange, apricot tints for bounds, and status colours held to signals.

### Primary
- **Swissquote Orange** (accent; `color(display-p3 1 0.38 0.06)` on P3 screens, hex fallback in the frontmatter): fills for the primary button, the selected preset, the active stepper step, the SQ logo mark, the seal disc, lit cells in the block field, the first day square, and text selection. A fill, never a text colour on white.
- **Pressed Orange** (accent-hover; P3 `color(display-p3 0.95 0.33 0.02)`): hover state of orange fills.
- **Ember Ink** (accent-ink): the orange that is legible as text on light grounds (AA): focus rings, caret, link-like accents, the accent badge text, the focused input border. In dark mode it lightens to #ff8a4c.
- **Apricot Field** (accent-soft): the ground for loss bounds and the accent badge, and the soft focus ring around inputs. In dark mode it becomes orange at 14% alpha.

### Neutral
- **Ink** (ink, also accent-fg): all body and display type, the text on orange fills, the completed stepper step, the crosshairs, the amount field's 1.5px border.
- **Paper White** (background, surface): page ground and card surface; the same white, separated by hairlines, not by tone.
- **Stone Wash** (surface-2): hover ground for secondary and ghost controls, neutral badges, info alerts, the file drop zone, skeletons.
- **Graphite** (muted): secondary copy, hints, inactive tokens.
- **Hairline Stone** (border): 1px borders on cards, inputs, chips and list rules.
- **Plate Ink / Plate Rule / Plate White / Plate Grey** (hero, hero-2, hero-fg, hero-muted): the onboarding panel and every ink plate. hero-2 is the plate's border and its row rules, and the unlit cell colour of the block field.

### Status
- **Ledger Green** (success, success-soft), **Signal Red** (danger, danger-soft), **Amber Note** (warning, warning-soft): validation, alerts, badges, the strength meter and the live square. Each has a lighter dark-mode value.

Dark mode (OS setting) swaps the ground to near-black (#0c0c0c, surfaces #151515 and #1d1d1d), type to #f5f5f5, and plates to #1a1a1a; orange fills stay the same.

### Named Rules
**The Ink-On-Orange Rule.** An orange fill always carries ink text (accent-fg), never white. When orange must be read as text on a light ground, use Ember Ink.

**The One Committed Colour Rule.** Swissquote orange is the only brand hue. Green, red and amber are signals, never decoration, and there is no second accent.

**The Factor Code Rule.** The user's three factors keep one code on every screen: the phone (Face ID) is an orange-filled square, the cloud account an ink-outlined square, the Kit passphrase an ink-filled square. No other colours encode factors.

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
- **Token** (JetBrains Mono 500, 11px, 0.12em, uppercase): stepper labels, the token bar, a plate's title, units inside fields ("USDC / DAY"), file metadata.

### Named Rules
**The Mono-Is-Data Rule.** JetBrains Mono is reserved for figures, addresses, units and verifiable status. If the text is not a number, an address, a unit or a chain fact, it is set in Hanken Grotesk.

**The Tight Display Rule.** Titles are semibold at 1.05 line-height with negative tracking (-0.03 to -0.035em). Display size is for the one title per screen.

## Layout

Onboarding is a two-column split from 1024px: an ink panel on the left (0.9fr) holding the logo, the block field (200 to 340px tall), the tagline, and the live strip; content on the right (1.1fr) in a single column, top-anchored, max 560px wide (35rem). Below 1024px the panel disappears: a logo row with the mono token bar sits on top and the column narrows to 448px (28rem).

Inside a step, vertical rhythm is 24px between blocks (title, form, action), 16 to 20px inside forms, 6px between a label and its field. Plates take extra top margin (64px) so the seal's overhang has room. Panel padding is 40px (48px from 1280px). Lists use hairline top and bottom rules rather than boxes. Primary actions run full width at the bottom of the column. Breakpoints are Tailwind's 640, 1024 and 1280px.

## Elevation & Depth

The system is flat. The card shadow token is deliberately `none`, and no component casts a shadow. Depth comes from two moves only: hairline borders that separate white from white, and the ink plate, a dark slab that marks the one thing on the screen being signed or committed. Focus is shown with a 2px Ember Ink outline offset 2px (controls) or an Ember Ink border plus a 4px Apricot ring (text fields).

### Named Rules
**The Flat Ground Rule.** No box shadows, no blurs, no glass. If something needs to stand out, it is either orange (action) or ink (commitment).

**The Ink Plate Rule.** A dark plate on a light screen means Face ID will sign this, or this is now live onchain. Never use it for marketing or general grouping.

## Shapes

Rectangles are crisp: 6px for small controls (small buttons, chips, badges, the logo mark, stepper squares), 8px for buttons and inputs, 10px for cards, plates and the apricot field, 12px at most. Data cells go sharper still: day squares at 3px, strength-meter bars at 2px, block-field cells and factor codes square. Status markers in the token bar and live strip are small squares, not dots. The one deliberate circle is the Swissquote seal: an orange disc with mono ink type set on a ring around the SQ mark. Crosshairs (14px, 1px ink strokes) register plates at the top-left and bottom-right corners, overhanging by 7px.

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

### Chips (presets)
- **Style:** 36px mono figures on white with a hairline border, 6px corners; the suggested value carries a small "suggested" in the grotesk.
- **State:** selected is an orange fill with ink text and no border (the Ink-On-Orange Rule), with the same 0.97 press.

### Badges
Small 6px tags, 12px medium text: neutral (Stone Wash with a hairline), accent (Apricot with Ember Ink), success, danger, warning on their soft grounds. Warning marks DEMO and MOCK states.

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
A row of 24px squares (6px corners) joined by hairlines: done is ink with a check, active is orange with ink numerals, pending is a hairline outline. Labels are tokens; on phones only the active label stays.

### Ink Plate (signature)
The commit surface. Plate Ink ground, Plate Rule border, 10px corners, 20 to 24px padding, crosshairs at two corners, a 120px seal overhanging the top edge by 56px at the right. Its title is a token in Plate Grey; its content is a definition list of rows (label in Plate Grey left, fact in Plate White right, hairline rules between). Addresses inside it use the hero-toned address chip.

### Seal (signature)
120px orange disc; the ring text "SPONSORED BY SWISSQUOTE · 2 OF 2 · USER MAJORITY" in 9-unit mono semibold ink, fitted exactly to the ring, turning once every 28s (still under reduced motion); "SQ" centred in 700 grotesk. Appears only on plates.

### Block Field (signature)
A canvas of 14px square cells with 4px gaps on the ink panel. Unlit cells are Plate Rule; orange cells light in slow diagonal waves, a few stay lit, and cells gather around the pointer. Drawn in Display P3 where available, capped at about 30fps, paused off screen or in a hidden tab, a single still frame under reduced motion, hidden from assistive tech.

### Live facts
- **Token bar:** a wrapping line of tokens in Graphite separated by middots, ending with "Base Sepolia", the block number, and a green square with "Live" ("Connecting" in grey after a missed poll). Shown on phones above the content.
- **Live strip:** on the ink panel, three columns under a Plate Rule line: Network fee "0.00", Base Sepolia block, Status, each a 12px Plate Grey label over a 20px mono figure.

### Loss bound
An apricot field: a 14px sentence, the worst case as a 36px mono figure with its unit, and one 28px square per day of exposure (the first day solid orange, the rest orange at 45%), numbered in 11px mono.

### Motion
Entrances are for rare, first-time screens: fade up 8px over 280ms, or scale from 0.9 over 320ms, both on cubic-bezier(0.23, 1, 0.32, 1). State changes run 150 to 200ms. Reduced motion collapses all of it.

## Do's and Don'ts

### Do:
- **Do** put ink text on every orange fill and use Ember Ink when orange has to be read as text.
- **Do** show risk as a number before the user commits: limits, loss bounds and delays in mono figures on the apricot field.
- **Do** put everything Face ID signs on an ink plate, with crosshairs and the seal, as the last block before the action.
- **Do** keep live chain facts (fee, block, live status) visible in the shell: the live strip on desktop, the token bar on phones.
- **Do** use the Factor Code Rule squares whenever the phone, the cloud account and the Kit appear together.
- **Do** use the tokens in `globals.css` and the kit in `web/src/components/ui`, never raw colours.

### Don't:
- **Don't** set white text on Swissquote orange.
- **Don't** add box shadows, glass or blur; the card shadow token stays `none`.
- **Don't** introduce a second accent, purple gradients, or a beige private-bank palette.
- **Don't** use JetBrains Mono or uppercase tokens as a decorative kicker above a headline; tokens label data.
- **Don't** round rectangles beyond 12px or turn markers into pills; the seal is the only circle.
- **Don't** place the seal anywhere but on a commit plate, and never more than one per screen.
