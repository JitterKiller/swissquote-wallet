---
version: 1
slug: "web-src-components-views-securityview-tsx"
primary_target: "web/src/components/views/SecurityView.tsx"
related_targets: ["web/src/components/views/AccountSetupStep.tsx","web/src/components/account/CustodyCard.tsx","web/src/components/shell/AppShell.tsx"]
---

# Surface brief: Security

- **Scope:** `/security` (SecurityView) rebuilt for the two-Safe Account (#26).
  - The owners, read live onchain, with "Swissquote · not an owner" verifiable on Basescan.
  - The worst case if the phone is stolen, as an amount.
  - Who can do what: a matrix of powers × parties, then scenarios.
  - The daily limit, read only, with "Change limit" as "Soon" (#13).
  - The security key slot as "Soon" (#17).
  - The level and the lock-out delay.
  - The pending lock-out state.
  - This phone's passkey, and "Forget this wallet on this device".
  - The worst-case block becomes one shared component with the protect flow.
- **Mode:** Read. The owner, and the jury on the projector, must understand and be able to check who can move the money; nothing here is signed.
- **Audience and job:**
  - **The owner** wants to know what protects their money and what a stolen phone would cost.
  - **The jury** verifies the custody claim (PDR-013): the user holds the majority and Swissquote is never an owner.
- **Proof and content:**
  - The Account's `getOwners` and threshold, and the Allowance Module's limit, spent today and reset time.
  - The eviction module's guardians (level 0: the Kit; level 1: the Kit + Swissquote), the pending eviction, and the Swissquote guardian and treasury addresses from `/api/guardian`.
  - The Kit owner address from the local encrypted Kit. Without a local copy, it is the Account's other owner, since the protect flow creates the Account with the Key Safe and the Kit.
- **Constraints:**
  - Every figure is live or derived from live data.
  - The loss bound is the protect flow's formula: limit × (days + 1), with DaySquares.
  - Demo delays are labelled (3 min on testnet).
  - Upcoming features are disabled and say "Soon", never faked (PRODUCT.md).
  - No new transaction on this page.
  - Factor codes: phone = orange square, Kit = ink square.
  - English copy.
- **Out of scope:** changing the limit (#13), adding a security key (#17), the level upgrade transaction (#21), retiring the legacy recovery (#33).
- **Unresolved:** none blocking.

## Direction contract

THESIS: The security page is a proof, not a settings list. It opens on the Account's owners as the chain reports them, puts the one sentence that matters next to it ("Swissquote · not an owner"), then the worst case as an amount, then who can do what. It refuses the shield-and-checkmark security dashboard, the green "you're safe" score, and toggles that pretend to be settings.

OWN-WORLD:
- DESIGN.md as built.
- The ink plate carries live chain facts: a green live square and the "live onchain" token, mono addresses as AddressPills, and factor squares as the only colour inside it.
- The worst case sits on the Apricot Field with DaySquares, the same block as in the protect flow.
- The matrix and scenarios are hairline lists on white, with factor squares in the cells.
- "Soon" slots are white cards with a disabled control and a neutral "Soon" badge.
- One committed orange: the factor square and the day squares, never decoration.

STORY:
1. The owner (or the jury) arrives from the Overview's "Who can do what".
2. They see the two owners with their addresses, "2 of 2 · both yours", and Swissquote's line "Not an owner", with a link to check it on Basescan.
3. Beside it: "If your phone is stolen, a thief can take at most 4.00 USDC".
4. Below, the matrix shows that Face ID alone only spends up to the limit, that everything else needs the Kit too, that the Kit locks a lost phone out after 7 days, and that Swissquote never moves the money.
5. Three scenarios say it in plain words.
6. The limit and the security key show what comes next.
7. When a lock-out is pending, the phone's row says so with the countdown, under the global alert.

FIRST VIEWPORT:
- **Header:** "Security", with "Who can move your money, read live onchain."
- **Desktop:** the owners plate (left, wider) and the worst case (right) side by side.
- **Phone:** the plate, then the worst case.
- **Plate rows:**
  1. This phone (orange square, Face ID, Key Safe address);
  2. Recovery Kit (ink square, passphrase, owner key address);
  3. Security key (hollow square, "Soon");
  4. a footer line "2 of 2 needed · both yours";
  5. "Swissquote · Not an owner", with "Verify on Basescan".

FORM: chosen by the user in the shape round, inside the established world, with no roll:
- the owners plate first;
- the matrix, then the scenarios;
- the limit read only and the key slots as "Soon".

FINISH: unreviewed and undocumented is unfinished. This build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
