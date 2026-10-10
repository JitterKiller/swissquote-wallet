# Swissquote Wallet — self-custody, bank-grade

Prototype for the **Swissquote Wallet Challenge** (BSA Hackathon): a self-custody wallet Swissquote could launch for its clients. The client holds the keys, Swissquote can never move the funds on its own, and the experience stays one tap from the Swissquote account.

Why things are built this way: see the decision records in **[docs/adr/](docs/adr/README.md)** (product decisions and architecture decisions).

## Status

| Step | Status |
|---|---|
| Create wallet with a passkey (Face ID / Touch ID), no seed phrase | ✅ |
| Safe smart account (ERC-4337) owned by the passkey, deterministic address | ✅ |
| Gasless USDC transfers (paymaster), user never holds ETH | ✅ |
| Recovery setup: Recovery Kit + Swissquote Guardian (2 of 2), one gasless tx | ✅ |
| Recovery on a new device: Kit + identity check → delay → new passkey owns the wallet | ✅ |
| Attacker path refused (identity check fails), owner can cancel during the delay | ✅ |
| Old device revoked after recovery | ✅ |
| Mock Swissquote backend: guardian (HSM), KYC, relayer, notifications | ✅ (mock) |
| Web UI: banking-style app shell, review-before-sign transfers, QR receive, on-chain activity, security page, light/dark | ✅ |
| Compliance: sanctions screening, simulation, dApp allowlist, high-value checks | ⏳ |
| Transfer from Swissquote account, `@handle` transfers, third guardian | ⏳ |
| Separation of powers: Account Safe (user factors, threshold 2) + Key Safe with a user-chosen daily limit (PDR-014, PDR-020, ADR-017) | ⏳ (spike ✅) |
| One flow for a lost or stolen phone: time-locked eviction the thief cannot cancel (PDR-018, PDR-021, ADR-019) | ⏳ (spike ✅) |
| Recovery Kit as a passphrase-encrypted cloud backup (PDR-016, ADR-018) | ⏳ |
| Open wallet for everyone + Swissquote link as the upgrade (PDR-015) | ⏳ |
| Theft protection: hardware key, guided "phone stolen" flow (PDR-017) | ⏳ |

## Architecture

```
┌──────────────── Web app (Next.js) ──────────────────┐     ┌──── Mock Swissquote backend (/api) ────┐
│ Passkey (WebAuthn P-256, Secure Enclave)             │     │ KYC session (video ident. — MOCK)       │
│   └─ signs UserOperations (biometric prompt)         │────►│ Swissquote Guardian key (HSM — MOCK)    │
│ Recovery Kit (guardian key, downloaded, not stored)  │     │ Relayer: ops Safe, sponsored UserOps    │
└───────────────┬──────────────────────────────────────┘     └───────────────────┬────────────────────┘
                │ UserOps                                                         │ UserOps
                ▼                                                                 ▼
          Candide bundler + paymaster (gas sponsored) ───────────────────────────────
                │
                ▼
   EntryPoint v0.9 ──► Safe smart account                         Base Sepolia
                        ├─ owner: passkey (WebAuthn verifier proxy)
                        └─ Social Recovery Module: guardians {Recovery Kit, Swissquote}, threshold 2,
                           delay 3 min (demo) / 3 days (prod), cancellable by the owner
```

**Where the keys live**

| Key | Where | Can move funds? |
|---|---|---|
| Passkey private key | Device secure hardware (or synced in iCloud Keychain / Google Password Manager), never extractable | Yes, it is the owner |
| Passkey public key | On-chain, in the Safe | — |
| Recovery Kit key | With the client, offline (file / printed / password manager), never stored by the app | No: one guardian vote, subject to delay + owner veto |
| Swissquote Guardian key | Swissquote HSM (mocked: env var or `web/.data`) | No: one guardian vote, signs only after identity check, subject to delay + owner veto |

## Recovery flow

1. **Setup** (after wallet creation): download the Recovery Kit, then one passkey-signed, gasless UserOp enables the module and registers both guardians.
2. **Lost device → new device**: upload the Recovery Kit and create a new passkey.
3. **Identity check** with Swissquote (mock: video identification). If it fails (attacker), Swissquote refuses to sign and the owner is alerted.
4. **Request**: the Kit signs (in the browser) and Swissquote co-signs (server). The relayer deploys the new passkey's signer and starts the recovery on-chain.
5. **Delay**: the current device shows an alert and can **cancel**. Swissquote notifies the client on every channel (mock).
6. **Finalize**: the new passkey becomes the owner. Same address, same funds. The old passkey can no longer sign.

## Stack

- **Next.js 16** (App Router with route groups, client-only wallet UI + route handlers for the mock backend), Tailwind CSS v4 with design tokens, lucide-react icons, sonner toasts, react-qr-code
- **abstractionkit** (Candide): Safe accounts, WebAuthn signer, paymaster, Social Recovery Module
- **ox**: WebAuthn ceremonies · **viem**: chain reads, ABI encoding, EIP-712
- **Network**: Base Sepolia (RIP-7212 P-256 precompile), Circle testnet USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

No custom cryptography: every primitive comes from audited contracts (Safe, Safe passkey module, Candide recovery module) and established libraries.

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:3000 (app + mock backend)
```

- Passkeys require `localhost` or HTTPS, and a passkey is bound to the domain it was created on.
- Get test USDC from the [Circle faucet](https://faucet.circle.com) (Base Sepolia → paste the wallet address).
- Team: share `SWISSQUOTE_GUARDIAN_PRIVATE_KEY` in `web/.env.local` (see `web/.env.example`), otherwise each machine has its own Swissquote Guardian.

## Deploy (Vercel + Upstash, ADR-020)

1. Vercel → Add New → Project → import this repo → **Root Directory `web`** → Deploy.
2. Project → Storage → Marketplace → **Upstash Redis** (free) → connect it to the project (all environments).
3. Settings → Environment Variables → `SWISSQUOTE_GUARDIAN_PRIVATE_KEY` (Production + Preview) = the team's shared key.
4. Redeploy, then open `/api/health`: expect `"ok": true, "store": "upstash-redis", "guardianFromEnv": true`.

Passkeys are bound to the domain: create demo wallets **on the production URL**. Wallets made on `localhost` or a preview URL do not work there.

## Tests

```bash
npm run smoke          # simulated passkey → Safe → sponsored UserOps (no browser)
npm run e2e            # real Chrome + virtual authenticator: create wallet in the UI, sign UserOps
npm run e2e:recovery   # two devices: attacker refused, owner cancels, full recovery, old device revoked (~5 min)
npm run screenshots    # captures every screen (desktop light/dark + mobile) into web/screenshots/
npm run spike:two-safe # on-chain spike of the two-Safe account + time-locked eviction (ADR-017, ADR-019), ~5 min
npm run spike:two-safe-variants # 2-owner eviction + immediate eviction with Kit + key, through lib/account.ts (~5 min)
npm run check:account  # lib/account.ts: setup + C1–C4 on Base Sepolia (~1 min)
npm run check:kit      # Kit v3 encryption, local (~5 s)
npm run check:eviction-api # /api/eviction endpoints over HTTP, needs npm run dev (~4 min)
```

The e2e scripts need Google Chrome and `npm run dev` running.

## Mock backend API

| Endpoint | Role |
|---|---|
| `GET /api/health` | Deployment check: store kind, write/read round trip, guardian + relayer (ADR-020) |
| `GET /api/guardian` | Swissquote Guardian + relayer addresses |
| `POST /api/kyc` | Identity verification session (MOCK outcome) |
| `POST /api/recovery` | Checks KYC + Kit signature, co-signs, relays `multiConfirmRecovery` |
| `POST /api/recovery/finalize` | Relays `finalizeRecovery` after the delay |
| `POST /api/eviction` | Starts a time-locked eviction of the phone (Key Safe) on the Account: Kit guardian signature; at level 1 also a verified KYC session, then Swissquote co-signs. Refuses anything but replacing the Key Safe (ADR-019, PDR-021) |
| `POST /api/eviction/finalize` | Relays `finalizeRecovery` on the Account after the delay |

## Real vs mocked

| Real (on-chain / standard) | Mocked (documented) |
|---|---|
| Passkeys (WebAuthn), Safe smart account, ERC-4337 bundler + paymaster, USDC transfers, Social Recovery Module (guardians, delay, cancel, finalize), EIP-712 guardian signatures | Swissquote banking account, KYC / video identification, guardian HSM, notifications (push / email / SMS / e-banking), postal mail |

## Repo layout

```
docs/adr/           decision records: product/ (PDR-*) and architecture/ (ADR-*), index in README.md
CLAUDE.md           context for AI assistants (imports docs/adr/README.md)
web/
  src/app/(wallet)/       /, /send, /receive, /activity, /security   (AppShell: sidebar + guards)
  src/app/(onboarding)/   /welcome, /welcome/protect, /recover       (OnboardingShell)
  src/app/api/            mock backend route handlers: guardian, kyc, recovery, recovery/finalize
  src/components/views/   one view per page (Overview, Send, Receive, Activity, Security, Create, Protect, Recover)
  src/components/shell/   AppShell, OnboardingShell, security banners, logo
  src/components/ui/      design-system kit (button, card, feedback, field, stepper, address, page)
  src/components/providers/WalletProvider.tsx   wallet + on-chain state shared by all pages
  src/lib/                config, passkey, wallet (Safe + UserOps), recovery, recoveryKit, activity, storage, format
  src/server/             mock Swissquote backend: guardian key + relayer, JSON store, notifications
  scripts/                smoke + e2e tests, UI screenshots
```
