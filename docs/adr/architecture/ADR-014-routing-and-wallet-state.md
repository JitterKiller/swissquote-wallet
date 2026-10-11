# ADR-014: Routing with route groups + a shared `WalletProvider`

- **Status:** Accepted, amended by ADR-040 (landing at `/`, the app under `/wallet`)
- **Date:** 2026-10-10
- **Supersedes:** the screen-switching part of [ADR-010](ADR-010-frontend-nextjs-client-only.md) (`ClientApp` / `WalletApp`)
- **Related:** [PDR-012](../product/PDR-012-web-first-banking-ux.md), [ADR-015](ADR-015-activity-from-chain-logs.md)

## Context

PDR-012 needs real URLs. The wallet only exists in the browser (WebAuthn, `localStorage`), every page needs the same on-chain state (balance, recovery status, ownership), and Next 16 runs with Cache Components enabled.

## Decision

- **Route groups:**
  - `src/app/(wallet)/…` uses the `AppShell` layout: sidebar, guard, global recovery alert, revoked screen.
  - `src/app/(onboarding)/…` uses the `OnboardingShell` layout: brand panel plus content.
- **`WalletProvider`** (`src/components/providers`) wraps the whole app in the root layout and is the single source of truth:
  - the wallet stored on this device: `setWallet`, `forget`;
  - on-chain state, polled every 5 s: balance, deployment, recovery status, whether this passkey is still an owner;
  - transfer history (ADR-015);
  - `refresh()` to reload everything.

  State is keyed by wallet address, so switching wallets never shows stale data.
- **Client-only gate:** `useIsClient()` (built on `useSyncExternalStore`) is `false` during server rendering and hydration. The shells render skeletons until it turns `true`, which avoids hydration mismatches without `dynamic(..., { ssr: false })`.
- **Guards:**
  - `AppShell` sends visitors without a wallet to `/welcome`, or to `/recover` if a recovery is in progress on this device.
  - `/welcome` sends visitors who already have a wallet to `/`.
  - If this passkey is no longer an owner, `AppShell` shows the revoked screen.
- **Pages** are small server files (`export const metadata` + one client view from `src/components/views`). Wallet pages and their layout export `instant = false`: Next can't validate instant navigation for UI that only renders after hydration.

## Consequences

- ✅ One polling loop shared by every page, and real browser navigation.
- ⚠️ Every wallet page needs `instant = false`, otherwise Next 16 logs "Could not validate … instant navigation" in development.
- ⚠️ After adding a route folder, restart `npm run dev`: the dev server can keep an outdated route table.
