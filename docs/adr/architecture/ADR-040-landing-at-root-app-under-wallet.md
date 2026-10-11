# ADR-040: The landing page at `/`, the app under `/wallet`

- **Status:** Accepted
- **Date:** 2026-10-11
- **Amends:** [ADR-014](ADR-014-routing-and-wallet-state.md): the routes and the guards.
- **Related:** [ADR-020](ADR-020-deployment-vercel-upstash.md) (one demo domain; passkeys are bound to the domain, not the path), [ADR-024](ADR-024-handle-directory.md) and [ADR-033](ADR-033-input-filtering.md) (payment request links), [ADR-037](ADR-037-ui-refinements-no-seal-4px-tab-bar-chart.md) (the landing)

## Context

The public landing lived at `/start`, and the wallet's Overview at `/`. A visitor opening the demo domain landed in the app shell, which sent them on to `/start` when this browser had no wallet. For the demo and the pitch, the domain's root should be the landing page, and the wallet should have a path of its own.

## Decision

- **Routes:**

  | Folder | Paths | Shell |
  |---|---|---|
  | `src/app/(marketing)/page.tsx` | `/` (was `/start`) | none, `LandingView` |
  | `src/app/wallet/(wallet)/…` | `/wallet` (Overview), `/wallet/send`, `/wallet/receive`, `/wallet/activity`, `/wallet/earn`, `/wallet/swap`, `/wallet/handle`, `/wallet/swissquote`, `/wallet/security`, `/wallet/offers` | `AppShell` |
  | `src/app/wallet/(onboarding)/…` | `/wallet/welcome`, `/wallet/welcome/protect`, `/wallet/recover` | `OnboardingShell` |
  | `src/app/wallet/(recovery)/lost` | `/wallet/lost` | `OnboardingShell quiet` |

  The API stays at `/api/…`.
- **Guards** (ADR-014, amended):
  - `AppShell` sends a visitor without a wallet to `/wallet/lost` or `/wallet/recover` when that flow is in progress on this device, otherwise to the landing `/`.
  - The create, recover and lost screens send a visitor who already has a wallet to `/wallet`.
  - The landing's main action is "Open your wallet" (`/wallet`) or "Create your wallet" (`/wallet/welcome`).
- **Links:** every internal link and `router.push` / `replace` points under `/wallet`.
  - In the navigation (`NAV`, the phone tab bar), the Overview is active on `/wallet` exactly.
  - Payment request links are `/wallet/send?to=…&amount=…` (`lib/handles.ts`).
- **Old paths keep working:** `redirects()` in `next.config.ts` sends `/start` to `/`, and each old app path (`/send/…`, `/security/…`, `/lost`, …) to the same path under `/wallet`.
  - The query is kept, so payment request QR codes made before still open Send, filled in.
  - The redirects are temporary (307).
- **Scripts:** the e2e and capture scripts visit `/wallet/…`.
- **Passkeys:** they are bound to the domain (rpId), not the path (ADR-020), so existing wallets keep working.

## Consequences

- ✅ The domain opens on the landing page, and the wallet is one tap away at `/wallet`.
- ✅ Old links and QR codes still work through the redirects.
- ⚠️ Paths named in earlier records (for example `/security?change=key`, `/lost`, `/swissquote`, `/offers`) now live under `/wallet`.
- ⚠️ `/` is no longer the Overview: an old bookmark of it opens the landing, whose main action opens the wallet.

## Alternatives considered

- **Keep the landing at `/start`:** the domain would keep opening on the app shell and bounce visitors without a wallet.
- **Landing at `/`, the app's other pages kept at the root (`/send`, …):** the Overview would still need a path, and mixing landing and app routes at the root makes the guards and the navigation's active state ambiguous.
- **Permanent redirects (308):** browsers cache them, and the routes may still change before the demo.
