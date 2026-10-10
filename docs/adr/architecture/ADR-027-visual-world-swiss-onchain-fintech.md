# ADR-027: Visual world — Swiss onchain fintech, recorded in DESIGN.md

- **Status:** Accepted
- **Date:** 2026-10-10
- **Amends:** [ADR-016](ADR-016-design-system.md) (same tokens-and-kit architecture, new visual values and a written design authority)
- **Related:** [PDR-012](../product/PDR-012-web-first-banking-ux.md), [PDR-008](../product/PDR-008-english-ui-copy.md), issue #10

## Context

- The first UI used soft cards, a warm grey ground and 12–16px corners. The team wanted a more distinctive, technical fintech feel for the jury, and asked to use the impeccable design skill (`.claude/skills/impeccable`).
- The direction was chosen with the team through impeccable's decision rounds. The team named **base.org** (technical fintech, one saturated committed colour, live chain facts, generative motion) and **Phantom** (warmth) as craft references, recorded in `PRODUCT.md`.
- ADR-016 fixed the architecture (Tailwind tokens + in-house kit) but no written visual rules, so every new screen drifted on its own.

## Decision

- **World:** the onchain fintech standard at Base and Phantom's craft, with the registration plate's signature moments where the user commits. Full rules and tokens in **`DESIGN.md`** (root) and its sidecar `.impeccable/design.json`.
  - White and ink (`#171717`); **Swissquote orange is the only committed colour** (P3 `color(display-p3 1 0.38 0.06)`, hex fallback `#ff5f0f`), always with **ink text** on orange fills (AA); orange text and focus rings use `--accent-ink` (`#c2410c`).
  - Hanken Grotesk (UI and display) and JetBrains Mono (figures, addresses, status tokens only), served by `next/font`.
  - Crisp corners: the Tailwind radius scale is remapped in `globals.css` (`rounded-lg` 6px … `rounded-3xl` 12px), flat surfaces, hairline borders.
  - Signature components in the kit: `BlockField` (generative square field, paused off screen, still under reduced motion), `Plate` / `Seal` / `PlateRow` (ink plate with crosshairs and a turning "SPONSORED BY SWISSQUOTE · 2 OF 2 · USER MAJORITY" seal for anything Face ID signs), `TokenBar` / `LiveStrip` (live Base Sepolia block, sponsored fee).
- **Architecture unchanged (ADR-016):** token names stay (`accent`, `surface`, `hero`…), so every existing screen inherited the new values at once; views keep using the kit.
- **Process:** new or reworked screens go through impeccable (`shape` before coding, `critique` / `harden` / `polish` after) and Emil Kowalski's skills for motion (CLAUDE.md). `DESIGN.md` is regenerated from the built code (`/impeccable document`), never edited ahead of the build. The design-detector hooks are per person (`settings.local.json`).
- **First surface:** the protect flow (#10), reviewed by impeccable's independent finish reviewer until a "ship" disposition (truth of copy, single committed colour, display scale, seal legibility, commit moment above a 900px fold). The direction contract lives in `.impeccable/surfaces/`.
- Decision sketches, review captures and the decision server state under `.impeccable/` are local artifacts (gitignored).

## Consequences

- ✅ One written visual authority for humans and AI assistants; screens stop drifting.
- ✅ The custody story is visible in the UI itself: the seal and ink plate mark every commit, live chain facts are real.
- ⚠️ Screens built before this ADR (Overview, Send, Receive, Activity, Security, Recover) only inherited tokens: they still carry pills, circles and a hero glow that `DESIGN.md` lists as drift. They are reworked with their issues (#11, #12, #13, #26…).
- ⚠️ Known drift to fix: the ink plate is low-contrast in OS dark mode; the danger button and the hero address pill use raw white instead of tokens.
- ⚠️ The impeccable decision server writes a state file every second; a running `next dev` reloads in a loop while it is open. Stop it once the decision is made.

## Alternatives considered

- **Keep the first soft-card UI (the category standard):** fastest, but indistinguishable from other wallets.
- **Other directions dealt by impeccable** (Swiss payment slip, Swiss banknote, transit diagram, dense module mosaic, factor characters…): shown to the team over three hands and declined; the team kept the Base standard with the registration plate's seal.
