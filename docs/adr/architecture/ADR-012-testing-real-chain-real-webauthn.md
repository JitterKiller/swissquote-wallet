# ADR-012: Testing — real chain, real Chrome WebAuthn

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [ADR-002](ADR-002-passkey-signing-safe-webauthn.md), [ADR-005](ADR-005-social-recovery-module.md)

## Context

Passkey and on-chain bugs (signature encoding, `clientDataJSON` fields, signer proxies, recovery ABIs) only show up on the real path. Touch ID cannot be automated.

## Decision

Three scripts in `web/scripts`, all run from `web/`:

| Command | What it does |
|---|---|
| `npm run smoke` | P-256 passkey simulated with `ox`, sends two sponsored UserOps (deploy, then use). No browser. |
| `npm run e2e` | Real Chrome with a **virtual authenticator**: creates the wallet through the UI, signs two UserOps with Chrome's WebAuthn output, checks the UI. |
| `npm run e2e:recovery` | Two browser contexts, i.e. two devices with their own passkeys. Covers: attacker refused, owner cancels, full recovery after the delay, new passkey signs, old device revoked. About 5 minutes. |

The e2e scripts drive the installed Google Chrome through `playwright-core` (`channel: 'chrome'`), so no browser download is needed, and they require `npm run dev` to be running.

## Consequences

- ✅ Catches real integration bugs without anyone touching Touch ID.
- ⚠️ Depends on public testnet infrastructure, so it can be flaky or rate-limited.
- ⚠️ There are no unit tests yet.
