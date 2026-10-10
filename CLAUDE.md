# Swissquote Wallet — notes for AI assistants

Hackathon prototype: self-custody wallet (Safe + passkeys + gasless + guardian recovery). The app lives in `web/`.

@docs/adr/README.md

## Rules

- Decisions live in `docs/adr/`: product decisions (`product/PDR-*`) and architecture decisions (`architecture/ADR-*`), one file each. Before changing product behaviour, architecture, custody, recovery or anything cryptographic, read the relevant record. When you make a new decision, add a record from `docs/adr/_template.md` and list it in `docs/adr/README.md`. Never rewrite an accepted record: supersede it.
- `web/` uses Next.js 16, which has breaking changes: read `web/node_modules/next/dist/docs/` before using Next APIs (see `web/AGENTS.md`).
- No custom cryptography. Never persist secrets client-side in clear. The only stored secret is the passphrase-encrypted Recovery Kit (keystore V3, ADR-018); the passphrase is never stored.
- Swissquote must never gain unilateral power over client funds (PDR-001) and is never an owner of the Account: the user always holds the majority (PDR-013, PDR-014).
- Mark mocked parts as MOCK (code comment + UI badge) and keep the README's "Real vs mocked" table current.
- UI: pages are thin files in `web/src/app/(wallet)` and `(onboarding)` rendering views from `web/src/components/views`. Shared state comes from `useWallet()` / `useLoadedWallet()` (`WalletProvider`). Use the kit in `web/src/components/ui` and the tokens in `globals.css`, never raw colors.
- User transactions go through `sendCalls` in `web/src/lib/wallet.ts` (sponsored + passkey-signed). Server-only code stays in `web/src/server/`.
- Backend data goes through `store()` in `web/src/server/store.ts` (async, one record per key; Upstash Redis when deployed, JSON file locally, ADR-020). Never write files from route handlers.
- Passkeys are bound to the domain: wallets created on localhost or a preview URL do not work on the production demo domain (ADR-020).

## Commands (from `web/`)

- `npm run dev`: app + mock backend on http://localhost:3000
- `npm run lint` and `npx tsc --noEmit`
- `npm run smoke`, `npm run e2e`, `npm run e2e:recovery` (the e2e scripts need `npm run dev` and Google Chrome)
- `npm run screenshots`: captures every screen (desktop light/dark + mobile) into `web/screenshots/` for UI review
- `npm run spike:two-safe`: on-chain spike of the two-Safe account and the time-locked eviction (ADR-017, ADR-019), about 5 minutes
