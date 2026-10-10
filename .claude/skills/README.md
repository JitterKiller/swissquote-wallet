# Project skills

Design and UI skills for Claude Code, shared with the whole team (loaded from `.claude/skills/`).

## How to use them for a screen

1. **Once per project:** `/impeccable init` (writes `PRODUCT.md`: audience, purpose, tone), then `/impeccable document` (writes `DESIGN.md` from `web/src/app/globals.css` and `web/src/components/ui`, so later commands keep our tokens and kit, ADR-016).
2. **Before coding a screen:** `/impeccable shape <screen>`.
3. **After coding it:** `/impeccable critique <screen>` (UX review), `/impeccable harden <screen>` (errors, edge cases) or `break-ui` (worst-case data), then `/impeccable polish <screen>` before merging.
4. **Motion and touch:** Emil's skills, `emil-design-eng` first; `animate` / `review-animations` for motion, `mobile-native` for phone polish, `ask-sonner` for toasts.

Impeccable owns layout, typography, color, copy and UX review; Emil's skills own motion and interaction details. Keep the incumbent design (Swissquote orange, our kit) unless a redesign is decided.

## Impeccable

Source: [pbakaus/impeccable](https://github.com/pbakaus/impeccable) v4.5.2 (engine 0.1.14), Apache-2.0 (`LICENSE-impeccable`). Installed with `npx impeccable@4.5.2 install --providers=claude --scope=project --yes`.

- One skill, `/impeccable <command> <target>`: `init`, `document`, `shape`, `critique`, `audit`, `polish`, `harden`, `clarify`, `distill`, `layout`, `typeset`, `colorize`, `animate`, `adapt`, `onboard`, `optimize`, `live`, … (see `impeccable/SKILL.md`), plus its sub-agents in `.claude/agents/`.
- **Engine binary not committed** (`.gitignore`): the launcher `impeccable/scripts/impeccable` downloads the pinned version for your platform from the GitHub releases and checks its sha256 before running it.
- **Hooks are per person.** The installer writes them into your own `.claude/settings.local.json` (a design-detector pass after each edit of a UI file, and a deeper pass at the end of a turn). To get them, run the install command above from the repo root; it leaves the committed skill unchanged.
- **Telemetry off for the team:** `.claude/settings.json` sets `IMPECCABLE_NO_TELEMETRY=1` (the engine otherwise sends an anonymous ping when a design direction is picked).
- To update: rerun the install with a newer version and bump the version above.

## Emil Kowalski's skills

Source: [emilkowalski/skills](https://github.com/emilkowalski/skills) at commit `e8a175de22ae1e49370fc144c1f3bb9aeedf988d`, MIT license (`LICENSE-emilkowalski-skills`). Copied as-is after review (Markdown only, no scripts).

| Skill | Use it for |
|---|---|
| `emil-design-eng` | Main skill: UI polish, component design, animation decisions |
| `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`, `animation-vocabulary` | Motion: build, review, audit, find opportunities, name effects |
| `apple-design` | Apple-style interface and fluid motion principles for the web |
| `break-ui` | Stress-test a screen with worst-case data |
| `mobile-native` | Make the web app feel native on a phone |
| `ask-sonner` | Sonner toasts (we use Sonner) |
| `pick-ui-library`, `prototype` | Only when explicitly invoked |
| `animate-expo`, `write-swift` | For the React Native / native app later |

To update: re-copy `skills/*` from the upstream repo and bump the commit above.
