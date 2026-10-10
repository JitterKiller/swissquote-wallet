# PDR-012: Web-first, online-banking-grade UX

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [ADR-014](../architecture/ADR-014-routing-and-wallet-state.md), [ADR-015](../architecture/ADR-015-activity-from-chain-logs.md), [ADR-016](../architecture/ADR-016-design-system.md)

## Context

The first UI was a single phone-sized column, good enough to prove the flows. UX and pitch count for 15 points, and Swissquote clients expect the polish of a bank. We polish the web app first; mobile (React Native) comes later.

## Decision

- **Desktop app shell**: a sidebar with Overview, Send, Receive, Swap (soon), Activity and Security. Below `lg`, it becomes a top bar plus a bottom tab bar.
- **Every screen has its own URL**, so the browser's back button and deep links work: `/`, `/send`, `/receive`, `/activity`, `/security`, `/welcome`, `/welcome/protect`, `/recover`.
- **Guided onboarding** in 3 steps: Create → Protect → Done, next to a brand panel that states the value proposition.
- **Review before signing**: Send goes Details → Review → Confirm. The review step shows the full recipient address, the fee ("Free, sponsored by Swissquote") and warnings (first transfer to that address, sending to yourself). Then a progress checklist, then a success screen with an explorer link.
- **Security transparency**: a "Who can do what" table (you / Recovery Kit / Swissquote × move funds / approve recovery / cancel recovery), the guardians with their addresses, and the device and passkey details. It is our custody model, made visible to users and judges.
- **Receive**: QR code, copy button, network warning, testnet faucet guide. "Top up from Swissquote" is shown as *Soon*.
- **Upcoming features stay visible but disabled** ("Swap", "Top up", marked *Soon*), so the roadmap is clear without pretending they work.
- Light and dark themes follow the OS setting. Loading skeletons, empty states and toasts are used throughout.

## Consequences

- ✅ Reads like a real banking product, and the security model can be explained from the UI itself.
- ⚠️ More screens to keep in sync with the e2e tests (`scripts/e2e-*.mts` select elements by visible labels).
- Next: mobile polish (React Native), and filling in Swap / Top up / handles.
