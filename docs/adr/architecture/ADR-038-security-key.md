# ADR-038: Security key: a third owner through Safe's WebAuthn verifier, and the immediate lock-out with the Kit

- **Status:** Accepted
- **Date:** 2026-10-11
- **Amends:** [ADR-034](ADR-034-security-page.md): the "Security key" slot is no longer "Soon".
- **Related:** [PDR-017](../product/PDR-017-theft-protection-hardware-key.md), [PDR-019](../product/PDR-019-offer-tiers.md), [PDR-014](../product/PDR-014-separation-of-powers.md), [PDR-018](../product/PDR-018-time-locked-eviction.md), [ADR-002](ADR-002-passkey-signing-safe-webauthn.md), [ADR-017](ADR-017-two-safe-account.md), [ADR-019](ADR-019-account-eviction-module.md), [ADR-023](ADR-023-sponsorship-policy-proxy.md), [ADR-030](ADR-030-lost-phone-flow-ui.md), [ADR-037](ADR-037-ui-refinements-no-seal-4px-tab-bar-chart.md), issue #17

## Context

PDR-017 and PDR-019 open a third factor to every level: a FIDO2 key the user keeps at home. With the Kit it locks a stolen phone out at once, so the worst case drops to about one day of the daily limit.

The spike C4b (`npm run spike:two-safe-variants`) proved it on Base Sepolia. A key added as the Account's third owner (threshold stays 2), together with the Kit, swaps the old phone's Key Safe for a new one and moves the daily allowance, in one relayed transaction with no delay.

The Security page showed the slot as "Soon" (ADR-034). In the shape round the user chose to build adding a key plus the immediate lock-out, with any authenticator accepted in the demo.

## Decision

### `lib/securityKey.ts`

- **The key becomes an owner through its proxy.** A key is a WebAuthn credential. Safe's WebAuthn verifier proxy for it (`createWebAuthnSignerVerifierAddress`, the mechanism ADR-002 uses for the passkey) is the address that becomes an owner. Deploying the proxy (`deployKeyProxyCall`) is a security operation.
- **`createSecurityKey`:**
  - Production asks for `authenticatorAttachment: 'cross-platform'`.
  - `DEMO_ANY_AUTHENTICATOR` (in `lib/config.ts`, on unless `NEXT_PUBLIC_DEMO_ANY_AUTHENTICATOR=false`) accepts any authenticator. That covers another computer's Touch ID, or a teammate's phone through the QR code (PDR-017 demo options). The copy says so. It never suggests the user's own phone.
  - **The wallet's own passkey is excluded** (`excludeCredentials`). An authenticator that holds it refuses, whether it is the phone itself or a synced copy, and the panel says "This device can't be your key". The key is a discoverable credential with user verification.
- **`signWithSecurityKey(digest, credentialId?)`:** a WebAuthn assertion over the Safe digest, encoded as the proxy's EIP-1271 contract signature (`v = 0` in `encodeSafeSignatures`). Without a credential id, the authenticator offers its keys.

### Adding a key: `components/account/SecurityKeyAdd.tsx`

This is an in-row panel under "Security key" on the Security page; `/security?change=key` opens it.

1. The worst case before → after (shared `WorstCaseChange`): `lossBound(limit, level)` → `limit`, about one day.
2. "Register a security key".
3. The review plate, led by the approval squares (ADR-037): new owner, "this phone, your Kit, your key", still 2 needed, locked out at once, the worst case and the network fee.
4. The Kit section.
5. "Approve with Kit and biometrics": one UserOp with the proxy deployment (if needed) and `twoFactorCall(addOwnerCall(account, proxy))`. `addOwnerWithThreshold` and the WebAuthn signer factory are security operations, so they are always sponsored (ADR-023).
6. The receipt.

### Records of the key (public data only, ADR-009)

- **On this device:** `sq-security-key:v1` holds the credential id, the public key and the proxy (`saveSecurityKey`).
- **Directory:** `/api/security-keys` (`store()`, keyed by the Account) holds the same record. A new device uses it to ask for the right credential.
  - It lists a key only when its proxy matches its public key and it is an owner on-chain.
  - The first key listed for an Account stays listed while it is an owner. A different credential is refused (409).
  - It stores nothing that can sign.

### Reading the owners: `components/account/useOwnerKinds.ts`

The hook names the Kit's owner key (an EOA) and the key (a contract, the verifier proxy). It uses this device's records first, then the chain: the app only adds the Kit and at most one key as the other owners. The Security page reads it to:

- show the key in the owners plate, with the new factor code `key`, an orange outline square (`components/ui/factor.tsx`), and "2 of 3 needed · all yours". Without a key, the slot shows the same square, dimmed;
- set the worst case to one day of the limit, if the owner acts before the next daily reset (`LossBound withKey`);
- give the powers matrix a Key column:
  - paying more, changing a rule and stopping a lock-out need any two of phone, Kit and key;
  - the lock-out row shows the Kit alone after the delay, or the key with the Kit at once;
- add the scenario "Someone takes your phone and your key": two of three factors, so the copy says to keep them apart;
- show the rule row "Added", with its proxy address.

### Immediate lock-out

- **In `/lost` (`EvictionView`):** `openKit` detects the key (the owner that is neither the old phone nor the Kit, and a contract). The start step then leads with `LockOutNow`, at every level: the Kit and the key are two owners, so no identity check is needed.
  1. The Kit signs `replaceKeySafeCall` (swap the Key Safe, move the allowance).
  2. The key signs the same Safe digest. Its credential id comes from the directory, used only when the directory's proxy is the key that is an owner. Otherwise the authenticator offers its keys.
  3. `/api/evict-now` submits.
- **While a time-locked lock-out runs:** the pending step offers the same action ("Have your security key?"), and asks for the Kit passphrase when the Kit is closed. `replaceKeySafeCall` with `cancelEviction` cancels the running lock-out in the same transaction, so nothing is left pending.
- **`/api/evict-now`:**
  - Checks that the old phone, the Kit owner and the key are owners and that the old phone holds the allowance.
  - **Rebuilds the call from the chain**: owners, the current allowance, and the cancel when a lock-out is pending. It never relays calldata it was given.
  - Encodes the two signatures and dry-runs `execTransaction` from the relayer (a bad signature returns the Safe's GS026 reason).
  - Relays it through the Swissquote relayer (ADR-007), sponsored.
  - Notifies the client.
- **The result:** the old phone shows "This phone was locked out"; the new device holds the Account and the phone's daily limit.

### Test

`npm run e2e:key` (`scripts/e2e-key.mts`), about 1 minute, no funds needed:

1. Phone A protects a wallet. Registering the phone itself as the key is refused (`key-00`). A separate virtual USB authenticator registers the key, which Face ID and the Kit add.
2. The key's credential is exported from the USB authenticator and imported into device B's, as a physical key would be plugged in.
3. B opens `/lost`, then the Kit, then Face ID. The start step leads with "Lock out now with Kit and key" (captured). B starts the time-locked lock-out, then ends it from the pending step with the Kit and the key: one transaction cancels it and replaces the old phone. The start step's button runs the same action without the cancel.
4. A no longer controls the Account.

## Consequences

- ✅ The third factor is real at every level. The worst case is about one day of the limit, shown before signing. The lock-out becomes one action instead of a wait.
- ✅ Swissquote's role stays a relayer: the Kit and the key, two of the user's owners, sign. The server can only submit the exact call they signed.
- ⚠️ **Midnight UTC edge.** The client and the server each build the allowance move with `lastUtcMidnightMin()`. A lock-out signed just before 00:00 UTC and relayed after it would not match, and the dry run refuses it: sign again.
- ⚠️ **Not built yet:**
  - a key tap for large payments (instead of the Kit);
  - replacing a lost Kit with phone + key;
  - replacing or removing a key;
  - attestation checks for Premium's shipped key (#22).
- ⚠️ **Two of three:** a thief who takes the phone and the key together controls the Account. The Security page says to keep the phone, the key and the passphrase in three places.
- ⚠️ **Demo authenticators:** the demo accepts platform authenticators. The app refuses an authenticator that holds the wallet's passkey, but it cannot tell a second device of the same person apart until production asks for a roaming key.

## Alternatives considered

- **The key as an EOA (hardware wallet signing ECDSA):** needs a dedicated device app. A FIDO2 key, through Safe's WebAuthn verifier, works with any browser.
- **Find the key's credential on the new device with a discoverable prompt only:** with several passkeys for the site on one authenticator, the prompt can pick the wrong one. The directory gives the credential id.
- **Let the client send the full `execTransaction` to relay:** the server would relay arbitrary calldata. Rebuilding from the chain keeps the relayer's role minimal.
