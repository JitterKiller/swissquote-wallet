# ADR-043: The demo security key on another phone (MOCK relay), and Face ID + a key tap above the limit

- **Status:** Accepted
- **Date:** 2026-10-11
- **Amends:** [ADR-038](ADR-038-security-key.md) (the key also approves payments, swaps, Earn and the limit; a demo kind), [ADR-039](ADR-039-offers-page.md) (the key tap is no longer "Soon"), [ADR-029](ADR-029-approval-route-from-chain-events.md) (Activity tells the key from the Kit), and the demo options of [PDR-017](../product/PDR-017-theft-protection-hardware-key.md)
- **Related:**
  - [PDR-016](../product/PDR-016-recovery-kit-encrypted-cloud-backup.md) ("with a hardware key, a tap replaces the passphrase"), [PDR-019](../product/PDR-019-offer-tiers.md) (Premium includes the key);
  - [ADR-002](ADR-002-passkey-signing-safe-webauthn.md), [ADR-017](ADR-017-two-safe-account.md), [ADR-020](ADR-020-deployment-vercel-upstash.md) (`store()`), [ADR-023](ADR-023-sponsorship-policy-proxy.md);
  - surface brief `web-src-components-views-demokeyview-tsx` (the `/wallet/key` screen).

## Context

The security key is a real third owner of the Account (ADR-038). Two gaps remained:

- **The demo.** The team has no FIDO2 key. The script used a teammate's phone through WebAuthn's QR code and Bluetooth (PDR-017, option 1). That is the real mechanism, but on stage it means a QR scan and a Bluetooth link, and the jury never sees what the key approves.
- **The key did one thing.** It only locked a lost phone out at once (with the Kit). PDR-016 promises that "a tap replaces the passphrase" and the Offers page sold "Face ID + a tap on the key" as "Soon". `twoFactorCall` hard-coded the Kit.

## Decision

### 1. The demo key: another phone plays the key (MOCK)

- **`/wallet/key`** (`components/views/DemoKeyView.tsx`, outside the app shell: the phone holds no wallet). It reads as a simulation from across the room, in two named layers:
  - on ink, the key drawn as a real one behaves: blind, "SIMULATED" engraved, one contact (the key factor code). The contact pulses while a request waits;
  - on white, a **Demo screen**, "what a real key can't show": the request.
  - It has a MOCK badge, and a footnote says a real FIDO2 key has no screen and signs blind.
- **The key is real.** `createSecurityKey(label, walletCredentialId, 'platform')` creates a WebAuthn credential with this phone's own Face ID. The wallet's passkey is excluded, so the wallet's own phone (or a synced copy of its passkey) cannot be its key. The verifier proxy is the third owner exactly as in ADR-038. On this phone, `sq-demo-key:v1` (`DemoKeyRecord`) keeps public data only: credential id, public key, proxy, Account.
- **The relay is the MOCK part.** It stands in for USB or NFC. It is `/api/key-relay` (`server/keyRelay.ts`, `lib/keyRelay.ts`) in `store()`:
  - `keyPairings` by a 6-character code (no 0/O/1/I/L), valid 10 minutes. The wallet's "Use a demo key on another phone" shows the code and a QR code to `/wallet/key?pair=CODE`, and computes the key's address from the public key that comes back. Both screens show that address.
  - `keyRequests` by the key's proxy, one request at a time, valid 3 minutes. A request holds the SafeTx (`to`, `value`, `data`, `operation`), the nonce, and the wallet's own description: a title and up to 8 rows (`KeyRequestLine`: label, figure, words, what it does). The relay accepts a request only for a key that is an owner of that Account onchain. The key marks it seen, then answers with a signature or a refusal.
- **The key decides what it signs.** It reads the Account's nonce onchain and refuses a request that is not the next transaction. It computes the digest itself (`accountTxDigest`), never from the relay. Then it signs with `signWithSecurityKey`. Its screen says the rows are "as your wallet describes it", and that the nonce was checked onchain.
- **The relay can sign nothing.** One key signature alone never moves funds or changes a rule: every action needs 2 of the 3 owners. Swissquote is not one of them.
- **Which key the wallet calls.** `SecurityKeyRecord.kind` is `'fido2'` (the default) or `'demo'`, stored on the wallet and in the directory (`/api/security-keys`). A demo key gets its requests through the relay; a FIDO2 key signs through WebAuthn on the device. That device is the wallet for a payment, or the new device for a lock-out.

### 2. Face ID + the key, without the passphrase

- **`lib/account.ts`.** `twoFactorCall` takes a `SecondFactor`: `{ kit }` or `{ key: KeyApprover }`.
  - `KeyApprover.sign({ account, call, nonce, digest })` returns the proxy's EIP-1271 contract signature.
  - With the Key Safe's `senderSignature`, the key's signature makes the blob: a static part with `v = 0`, then the dynamic part.
  - `spend` / `kitSpendCalls`, `limitChangeCalls`, `dappActionCalls` and `swapCalls` accept either factor.
  - `keyApprover(record, { describe })` in `lib/securityKey.ts` builds a `KeyApprover` for either kind of key.
- **`components/account/SecondFactor.tsx`.** `useSecondFactor` and `SecondFactorSection` replace the copied Kit sections of Send, Earn, Swap and the limit change.
  - When the Account has a key (`useOwnerKinds`; the record comes from this device, else from the directory), a choice reads "Security key | Recovery Kit". **The key is the default.**
  - The Kit section is unchanged (passphrase, the file when this device has no encrypted copy).
  - The wording comes from `SECOND_FACTOR`: "Face ID and your key will approve", "Face ID + your security key", "Approve with key and biometrics". `KeyWaiting` says where to look: "Open SQure Key on the other phone", then "Your key shows the request. Touch it to approve".
- **Lock-out now.** It is unchanged (Kit + key, `/api/evict-now`). With a demo key, the key's signature comes through the relay.
- **Unchanged.** The level upgrade, adding the key itself and stopping a lock-out still take the Kit.

### 3. Activity tells the key from the Kit

The Account is a SafeL2, so `SafeMultiSigTransaction` carries the signatures. `fetchTransfers` reads it for Accounts. A 2-factor transfer whose signatures hold a contract signature (`v = 0`, the key's proxy) is `via: 'face-id+key'`. The row shows the phone and key squares ("Approved with Face ID and your security key"), and the legend adds "Face ID + key".

### 4. Test

`npm run e2e:demo-key` (`scripts/e2e-demo-key.mts`) uses three Chrome contexts with virtual authenticators and takes about 2 minutes.

1. Phone A protects a wallet.
2. Phone K pairs on `/wallet/key`, and A adds K's key with Face ID + the Kit.
3. A raises the limit with Face ID + the key. K refuses once (A says so, nothing signed), then approves. This is the first onchain run of the Key Safe sender plus the key's contract signature. Passed on Base Sepolia, tx `0xfaa7d3d8…a49be6`; its `SafeMultiSigTransaction` signatures start with `v = 0`.
4. With a funded treasury, A pays 0.75 USDC above the limit with the key, Activity marks it "Face ID + key", and the last 0.25 goes back with Face ID. This step is skipped, and said so, when the treasury is empty.
5. Device B locks A out at once with the Kit and K's key: tx `0xe4e85053…bd996`.

## Consequences

- ✅ The demo needs no Bluetooth or QR scan at the lock-out, and the jury sees on the key's phone what it approves. Premium's key gets a daily use: no passphrase above the limit.
- ✅ The onchain mechanism is the production one. Only the channel (relay instead of USB/NFC) and the screen (a real key has none) are simulated, and both say so.
- ⚠️ The relay is an extra party for demo keys. It can't sign or swap a transaction unseen, because the key recomputes the digest from the chain. But it could show a misleading description, as a real key's blind signing could. The wallet's own review is the one the owner trusts.
- ⚠️ Activity reads one more log query per range (`SafeMultiSigTransaction`) for Accounts.
- ⚠️ The demo key lives on one phone. "Forget this key on this phone" only clears the local record: the key stays an owner onchain until it is replaced, which is not built yet (ADR-038).

## Alternatives considered

- **Keep the WebAuthn QR code and Bluetooth (hybrid transport):** real, and still possible with "Register a security key". But it is fragile on stage and shows nothing of the request.
- **A software key in the wallet's own app (P-256 with ox, PDR-017 option 4):** the same device as the phone, which defeats the point of a second factor, and a private key in page storage.
- **A software key on the second phone (WebCrypto):** no Face ID moment, and a key in page storage. The platform passkey keeps the private key in the phone's secure hardware.
- **The Kit as the default even with a key:** it keeps the passphrase where Premium promises a tap.
