---
version: 1
slug: "web-src-components-account-securitykeyadd-tsx"
primary_target: "web/src/components/account/SecurityKeyAdd.tsx"
related_targets: ["web/src/components/views/SecurityView.tsx","web/src/components/views/EvictionView.tsx","web/src/lib/securityKey.ts","web/src/app/api/evict-now/route.ts"]
---

# Surface brief: Security key

- **Scope:** the security key (#17, PDR-017, PDR-019).
  - "Add a key" on the Security page's "Security key" row stops being "Soon" and opens an in-row panel. `/security?change=key` opens it too, from the Offers page.
  - The panel registers a key (WebAuthn) and adds it as the Account's third owner (threshold stays 2), signed by Face ID + the Kit.
  - The owners plate, the worst case and the rules read the key.
  - In "Phone lost or stolen?" on the new device, "Lock out now with your security key" replaces the old phone at once: the Kit and the key sign, the Swissquote relayer submits, no delay.
- **Mode:** Operate.
- **Audience and job:**
  - **The owner** wants a stolen phone locked out at once, so the worst case drops to about one day of their limit.
  - **The jury** sees the third factor and the immediate lock-out live.
- **Proof and content:**
  - **The key:** a WebAuthn credential and its Safe verifier proxy (`SafeAccount.createWebAuthnSignerVerifierAddress`).
  - **Adding it:** `addOwnerCall` plus the proxy deployment, in one sponsored UserOp (security operations, ADR-023).
  - **The lock-out:** `replaceKeySafeCall`, signed by the Kit (ECDSA) and the key (EIP-1271 contract signature over the Safe digest), relayed by `/api/evict-now`. The spike C4b proved it on Base Sepolia.
  - **Labels:** the owners come from the chain. The key is recognised from this device's public record, or as the only other contract owner.
- **Constraints:**
  - Never the user's own phone as the key (PDR-017). Production enrolment asks for a cross-platform authenticator.
  - The demo flag (`NEXT_PUBLIC_DEMO_ANY_AUTHENTICATOR`, on by default) also accepts this computer's Touch ID or a teammate's phone via QR, and the copy says so.
  - Nothing secret is stored: only the credential id, the public key and the proxy address (ADR-009).
  - Factor code for the key: an orange outline square.
  - English copy, "biometrics" on approve buttons (ADR-037).
- **Out of scope:**
  - replacing or removing a key;
  - paying above the limit with a key tap;
  - replacing a lost Kit with phone + key;
  - attestation checks;
  - Premium shipping (#22, MOCK).
- **Unresolved:** none blocking.

## Direction contract

THESIS: A security key is a third owner the user keeps at home. Its whole point is speed: with the Kit, it locks a stolen phone out at once instead of after 7 days. The panel shows that trade as an amount before signing. On the new device, the lock-out becomes one action instead of a wait. It refuses the hardware-wallet shop page, gadget imagery, and any wording that makes the key a requirement for basic security.

OWN-WORLD:
- DESIGN.md as built: the In-Row Panel, Worst Case Change (before → after), review plates led by the approval squares (ADR-037), the Kit section, the receipt plate, Gate Blocks, Third-Party Powers, the Soon Slot for what is still not built.
- A new factor code for the key: an orange outline square, distinct from the phone's orange fill, the Kit's ink fill and the cloud's ink outline. It is used in the owners plate, the review and `/lost`.
- One committed orange: the primary action.

STORY:
1. On the Security page the owner taps "Add a key" beside "None". The panel opens under the row.
2. The panel shows "4.00 → 0.50 USDC: locked out at once instead of after 7 days".
3. The owner registers the key (a WebAuthn prompt; the demo accepts this computer or a teammate's phone).
4. The review plate shows the new owner and "2 of 3 needed". The Kit and biometrics approve.
5. The receipt confirms the key is an owner on-chain. The owners plate now lists it.
6. Later, on a new device, "Phone lost or stolen?" opens the Kit and creates the new passkey, then offers "Lock out now with your security key". The Kit and the key sign, the old phone is out at once, and this device holds the Account.

FIRST VIEWPORT:
- **The Security panel:**
  1. the worst case before → after;
  2. the key step (register, or the registered key with its proxy address);
  3. the review plate;
  4. the Kit;
  5. the actions.
- **`/lost`, with a key:** the "Lock out now" block leads the start step, above the 7-day lock-out.

FORM: chosen by the user in the shape round:
- add the key, plus the immediate lock-out;
- any authenticator in the demo.

It sits inside the established world, with no roll.

FINISH: unreviewed and undocumented is unfinished. This build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
