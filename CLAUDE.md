# SQure (by Swissquote) — notes for AI assistants

Hackathon prototype: self-custody wallet (Safe + passkeys + gasless + guardian recovery). The app lives in `web/`.

@docs/adr/README.md

## Rules

- Decisions live in `docs/adr/`: product decisions (`product/PDR-*`) and architecture decisions (`architecture/ADR-*`), one file each. Before changing product behaviour, architecture, custody, recovery or anything cryptographic, read the relevant record. When you make a new decision, add a record from `docs/adr/_template.md` and list it in `docs/adr/README.md`. Never rewrite an accepted record: supersede it.
- `web/` uses Next.js 16, which has breaking changes: read `web/node_modules/next/dist/docs/` before using Next APIs (see `web/AGENTS.md`).
- No custom cryptography. Never persist secrets client-side in clear. The only stored secret is the passphrase-encrypted Recovery Kit (keystore V3, ADR-018); the passphrase is never stored.
- Swissquote must never gain unilateral power over client funds (PDR-001) and is never an owner of the Account: the user always holds the majority (PDR-013, PDR-014).
- Mark mocked parts as MOCK (code comment + UI badge) and keep the README's "Real vs mocked" table current.
- UI: pages are thin files rendering views from `web/src/components/views`: the landing page in `web/src/app/(marketing)` (`/`), the app under `/wallet` in `web/src/app/wallet/(wallet)`, `(onboarding)` and `(recovery)` (ADR-040). Old app paths redirect to `/wallet/…` (`next.config.ts`). Shared state comes from `useWallet()` / `useLoadedWallet()` (`WalletProvider`). Use the kit in `web/src/components/ui` and the tokens in `globals.css`, never raw colors.
- UI work: follow the design skills in `.claude/skills/`: `/impeccable` for layout, typography, color, copy and UX review (`shape` before coding a screen, `critique` / `harden` / `polish` after), and Emil's skills for motion and interaction (start with `emil-design-eng`; `break-ui` to stress-test a screen, `mobile-native` for phone polish, `ask-sonner` for toasts). Keep our tokens and kit. See `.claude/skills/README.md`.
- User transactions go through `sendCalls` in `web/src/lib/wallet.ts` (sponsored + passkey-signed). Server-only code stays in `web/src/server/`.
- Backend data goes through `store()` in `web/src/server/store.ts` (async, one record per key; Upstash Redis when deployed, JSON file locally, ADR-020). Never write files from route handlers.
- Passkeys are bound to the domain: wallets created on localhost or a preview URL do not work on the production demo domain (ADR-020).

## Commands (from `web/`)

- `npm run dev`: app + mock backend on http://localhost:3000
- `npm run lint` and `npx tsc --noEmit`
- `npm run smoke`, `npm run e2e`, `npm run e2e:recovery`, `npm run e2e:account-setup` (the e2e scripts need `npm run dev` and Google Chrome)
- `npm run screenshots`: captures every screen (desktop light/dark + mobile) into `web/screenshots/` for UI review
- `npm run spike:two-safe`: on-chain spike of the two-Safe account and the time-locked eviction (ADR-017, ADR-019), about 5 minutes
- `npm run check:registry`: wallet registry checks against `npm run dev` (ADR-021)
- `npm run check:sponsorship`: sponsorship policy checks against `npm run dev` (ADR-023)
- `npm run check:handles`: `@handle` checks against `npm run dev` (ADR-024)
- `npm run check:swissquote`: Swissquote account transfer checks against `npm run dev` (ADR-025)
- `npm run e2e:link`: "Link with Face ID" in real Chrome with a virtual passkey, then @handle and /wallet/swissquote
- `npm run e2e:earn`: Earn on Base Sepolia (deposit to Aave with Kit + Face ID, withdraw, unlisted-dApp demo, funds back to the treasury), about 2 minutes
- `npm run e2e:swap`: Swap on Base Sepolia (USDC → EURC, EURC → USDC with Max, USDC → ETH and back, Activity, funds back to the treasury), about 2 minutes
- `npm run e2e:level`: level 1 upgrade (not-linked panel, sign in + Link with Face ID, the /wallet/swissquote call, upgrade with Kit + Face ID, level 1 on Security and /swissquote), about 30 seconds, no funds needed
- `npm run e2e:limit`: daily limit change from the Overview's "Change" (raise to 1.00, lower to 0.25, both with Kit + Face ID) and the panel's states, about 1.5 minutes, 0.10 USDC from the treasury, returned
- `npm run e2e:key`: security key (the phone refused as its own key, a USB key added with Kit + Face ID, then a lost phone locked out at once with Kit + key on a second device), about 1 minute, no funds needed
- `node scripts/capture-offers.mts [outDir] [--send]`: captures `/wallet/offers` in every offer state (390 and 1440), with `--send` Send's receipt line too, about 1 minute (1 USDC from the treasury, returned)
- `npm run e2e:eviction`: "Phone lost or stolen?" on two phones (lock-out, thief refused, 2-factor stop, takeover after the 3-minute delay), about 6 minutes, screenshots in `web/screenshots/`
