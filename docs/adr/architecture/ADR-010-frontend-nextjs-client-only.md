# ADR-010: Frontend — Next.js 16, client-only wallet UI, Tailwind v4

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [ADR-008](ADR-008-mock-backend.md)

## Context

The team is strongest in React. The app needs both a wallet UI and a small backend. The wallet relies on browser-only APIs: WebAuthn and `localStorage`.

## Decision

- **Next.js 16, App Router.** The wallet UI renders **client-side only**: `ClientApp` loads it with `dynamic(..., { ssr: false })`.
- `WalletApp` switches between four screens: `onboarding`, `setup`, `recover`, `dashboard`.
- Components live in `src/components`, logic in `src/lib`, and server code in `src/server`.
- **Tailwind v4**, with color tokens and dark mode defined in `src/app/globals.css`.

## Consequences

- ⚠️ Next 16 has breaking changes. Read `web/node_modules/next/dist/docs/` before using a Next API (see `web/AGENTS.md`).
- ⚠️ After adding a new route folder, the dev server can keep an outdated route table and return 404s. Restart `npm run dev`.
- A React Native app can come later. It would reuse `src/lib` and share passkeys through associated domains.

## Alternatives considered

- **Vite single-page app + a separate backend**: two processes to run.
- **React Native first**: slower to iterate on during the hackathon.
