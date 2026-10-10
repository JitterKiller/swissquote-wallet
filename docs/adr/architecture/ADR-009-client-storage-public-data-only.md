# ADR-009: Client storage — public data only

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-005](../product/PDR-005-recovery-kit.md), [ADR-006](ADR-006-recovery-target-verifier-proxy.md)

## Context

The app has to remember the wallet between visits, and a recovery must survive a page reload. Anything stored in the browser can be read by XSS, malicious extensions or malware.

## Decision

- `localStorage` holds **public data only** (`web/src/lib/storage.ts`):

  | Key | Content |
  |---|---|
  | `sq-wallet:v1` | Credential ID, passkey public key, address, name |
  | `sq-activity:v1` | Local transaction history |
  | `sq-recovery:v1` | Recovery in progress: the new passkey's public key and new owner address, saved **before** the request is sent |

- Secrets are never stored. The Recovery Kit key is held in memory only, while a recovery is in progress.
- Every read and write is wrapped in try/catch, so the app keeps working when storage is unavailable.

## Consequences

- ✅ Compromising the browser storage reveals nothing that can sign.
- ✅ A recovery can be resumed after a reload.
- ⚠️ Clearing storage before the Safe is deployed loses the public key, and with it the ability to recompute the address. Production: register wallets with the Swissquote backend (open question).
