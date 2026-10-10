# ADR-018: Recovery Kit encryption and storage — Ethereum keystore V3 via ethers, cloud + local copies

- **Status:** Accepted, amended by [ADR-019](ADR-019-account-eviction-module.md) (the Kit file carries a second encrypted key, the guardian key)
- **Date:** 2026-10-10
- **Amends:** [ADR-009](ADR-009-client-storage-public-data-only.md) (one secret is now stored client-side, always encrypted)
- **Related:** [PDR-016](../product/PDR-016-recovery-kit-encrypted-cloud-backup.md), [ADR-011](ADR-011-no-custom-cryptography.md), [ADR-017](ADR-017-two-safe-account.md)

## Context

PDR-016 makes the Kit a passphrase-encrypted backup. ADR-011 requires an established library for any cryptography, and viem has no keystore support.

## Decision

- **Format:** Ethereum **keystore V3** (Web3 Secret Storage: scrypt key derivation + AES-128-CTR + MAC), written with ethers v6 `encryptKeystoreJson` and read with `decryptKeystoreJson`.
  - Default ethers scrypt cost: deliberately slow, about 1–2 s in a browser.
  - New dependency: `ethers`, used only for these two functions.
- **File (version 2):**
  ```json
  { "type": "swissquote-wallet-recovery-kit", "version": 2, "chainId": 84532,
    "account": "0xACC…", "keySafe": "0xKEY…", "keystore": { "address": "0xKIT…", "crypto": { … } } }
  ```
  The addresses are public anyway (on-chain).
- **Copies:**
  - **Cloud:**
    - web: the browser downloads `swissquote-recovery-kit-<account>.json`, and the UI asks the user to save it to iCloud Drive or Google Drive;
    - native (roadmap): the app's iCloud container or the Google Drive `appDataFolder`, read automatically.
  - **Local:** the same encrypted JSON in `localStorage` under `sq-kit:v2`. It is the only secret persisted client-side, and it is always encrypted (amends ADR-009).
- **Passphrase:** at least 12 characters, entered twice, with a strength indicator. Never stored, never sent.
- **Use:** decrypt in memory just before signing, then drop the references (best effort in JavaScript).
- **Setup test:** before protection is marked done, the user re-opens the downloaded file with the passphrase.
- **Passphrase change:** decrypt, re-encrypt, write a new file and a new local copy. Nothing changes on-chain.
- **Migration:** version 1 Kits (plain JSON, current demo) stay readable during the hackathon. New Kits are version 2 only.
- **Code:** `web/src/lib/recoveryKit.ts`, the protect-wallet view, the recovery flow.

## Consequences

- ✅ A standard, widely supported format, with no cryptography of our own.
- ✅ A stolen file or local copy is useless without the passphrase.
- ⚠️ Security rests on passphrase strength: the file can be attacked offline.
- ⚠️ XSS could read the encrypted local copy and capture the passphrase as it is typed. Front-end integrity (strict CSP, dependency hygiene) is a production requirement.
- ⚠️ Adds `ethers` to the bundle. Import only the keystore functions.

## Alternatives considered

- **WebCrypto PBKDF2 + AES-GCM assembled by us:** assembling primitives ourselves, which ADR-011 forbids.
- **Other formats (age, …):** less standard in Ethereum tooling.
- **No local copy:** every large payment would need the file picker.
