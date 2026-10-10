# Swissquote Wallet — self-custody, bank-grade

Prototype for the **Swissquote Wallet Challenge** (BSA Hackathon): a self-custody wallet Swissquote could launch for its clients. The client holds the keys, Swissquote can never move the funds on its own, and the experience stays one tap from the Swissquote account.

## Status

| Step | Status |
|---|---|
| Create wallet with a passkey (Face ID / Touch ID), no seed phrase | ✅ |
| Safe smart account (ERC-4337) owned by the passkey, deterministic address | ✅ |
| Gasless USDC transfers (paymaster), user never holds ETH | ✅ |
| Real transactions on Base Sepolia, verified end-to-end in Chrome | ✅ |
| Recovery: guardians (Recovery Kit + Swissquote Guardian) + timelock + cancel | ⏳ next |
| Mock Swissquote backend (KYC, guardian service, account → wallet transfer) | ⏳ |
| Compliance: sanctions screening, simulation, dApp allowlist, high-value checks | ⏳ |
| `@handle` transfers between Swissquote clients | ⏳ |

## Architecture

```
┌──────────────── Web app (Next.js) ─────────────────┐
│ Passkey (WebAuthn P-256, Secure Enclave)            │
│   └─ signs UserOperations (biometric prompt)        │
└───────────────┬─────────────────────────────────────┘
                │ UserOp
                ▼
   Candide bundler + paymaster (gas sponsored)
                │
                ▼
   EntryPoint v0.9 ──► Safe smart account
                        ├─ owner: passkey public key (WebAuthn signer)
                        └─ (next) Social Recovery Module: guardians + delay
                        Base Sepolia
```

**Where the keys live**

| Key | Where | Can move funds? |
|---|---|---|
| Passkey private key | Device secure hardware (or synced in iCloud Keychain / Google Password Manager), never extractable | Yes, it is the owner |
| Passkey public key | On-chain, in the Safe | — |
| Recovery Kit (next) | With the client, offline (printed / password manager) | No, only one guardian vote, subject to delay |
| Swissquote Guardian key (next) | Swissquote HSM (mocked) | No, only one guardian vote, subject to delay |

## Stack

- **Next.js 16** (App Router, client-only wallet UI), Tailwind CSS
- **abstractionkit** (Candide): Safe accounts, WebAuthn signer, paymaster, Social Recovery Module
- **ox**: WebAuthn ceremonies (create credential / sign)
- **viem**: chain reads, ABI encoding
- **Network**: Base Sepolia (RIP-7212 P-256 precompile), Circle testnet USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

No custom cryptography: every primitive comes from audited contracts (Safe, Safe passkey module, Candide recovery module) and established libraries.

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Passkeys require `localhost` or HTTPS. A passkey is bound to the domain it was created on: wallets created on `localhost` will not work on a deployed URL.

Get test USDC from the [Circle faucet](https://faucet.circle.com) (Base Sepolia → paste the wallet address).

## Tests

```bash
npm run smoke      # simulated passkey → Safe → sponsored UserOps on Base Sepolia (no browser)
npm run e2e        # real Chrome + virtual authenticator: create wallet in the UI, sign UserOps, verify on-chain
```

`npm run e2e` needs Google Chrome and `npm run dev` running.

## Real vs mocked

| Real (on-chain / standard) | Mocked (documented) |
|---|---|
| Passkeys (WebAuthn), Safe smart account, ERC-4337 bundler + paymaster, USDC transfers, recovery module | Swissquote banking account, KYC / video identification, guardian HSM, postal mail, notifications |

## Repo layout

```
web/
  src/lib/          config, passkey (WebAuthn), wallet (Safe + UserOps), storage
  src/components/   Onboarding, Dashboard, SendForm, UI primitives
  scripts/          smoke + e2e tests
```
