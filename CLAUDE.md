# Swissquote Wallet — notes for AI assistants

Hackathon prototype: self-custody wallet (Safe + passkeys + gasless + guardian recovery). The app lives in `web/`.

@docs/adr/README.md

## Rules

- Decisions live in `docs/adr/`: product decisions (`product/PDR-*`) and architecture decisions (`architecture/ADR-*`), one file each. Before changing product behaviour, architecture, custody, recovery or anything cryptographic, read the relevant record. When you make a new decision, add a record from `docs/adr/_template.md` and list it in `docs/adr/README.md`. Never rewrite an accepted record: supersede it.
- `web/` uses Next.js 16, which has breaking changes: read `web/node_modules/next/dist/docs/` before using Next APIs (see `web/AGENTS.md`).
- No custom cryptography. Never persist secrets client-side (the Recovery Kit key is never stored by the app).
- Swissquote must never gain unilateral power over client funds (PDR-001).
- Mark mocked parts as MOCK (code comment + UI badge) and keep the README's "Real vs mocked" table current.
- User transactions go through `sendCalls` in `web/src/lib/wallet.ts` (sponsored + passkey-signed). Server-only code stays in `web/src/server/`.

## Commands (from `web/`)

- `npm run dev`: app + mock backend on http://localhost:3000
- `npm run lint` and `npx tsc --noEmit`
- `npm run smoke`, `npm run e2e`, `npm run e2e:recovery` (the e2e scripts need `npm run dev` and Google Chrome)
