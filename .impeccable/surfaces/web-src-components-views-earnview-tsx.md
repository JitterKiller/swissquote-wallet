---
version: 1
slug: "web-src-components-views-earnview-tsx"
primary_target: "web/src/components/views/EarnView.tsx"
related_targets: ["web/src/components/account/EarnCard.tsx","web/src/components/views/OverviewView.tsx","web/src/components/send/ComplianceChecks.tsx"]
---

# Surface brief: Earn (issue #25)

- **Scope:** `/earn` (EarnView), its entries (the Overview plate's Earn tile, the Overview Earn card, the sidebar), and the compliance checks' wording for dApp actions.
- **Mode:** Operate.
- **Audience and job:** the wallet's owner who wants idle USDC to earn something, without leaving self-custody; the jury, who must see a compliant dApp interaction (bonus criterion).
- **Proof and content:**
  - read on-chain: the approved list (Aave v3, Compound III, `lib/dapps.ts`), each protocol's live supply APY and the Account's position;
  - before Face ID: the readable steps (exact approval, supply / withdraw back to the Account), screening and simulation;
  - the paymaster's real refusal of an unlisted dApp (the Uniswap v3 router on Base Sepolia).
- **Constraints:**
  - every action needs Face ID + the Kit (PDR-025);
  - exact approvals only;
  - funds only return to the Account;
  - risks disclosed and acknowledged before signing;
  - variable rates, never promised;
  - testnet rates labelled;
  - English copy;
  - no Swissquote yield product.
- **Out of scope:** WalletConnect, borrowing, other assets, rewards.
- **Unresolved:** none blocking.

## Direction contract

THESIS: Earning without giving anything away: the Account lends directly to a short list Swissquote vetted, every move is signed by the user's two factors, and the money can only come back to the Account. It refuses the yield-farm dashboard (APY bait, leaderboards) and the bank savings product it is not.

OWN-WORLD:
- DESIGN.md as built: an ink plate for what is live onchain (the positions) and a sealed 2-of-2 plate for what the Kit and Face ID sign.
- Rates and amounts in mono, two decimals for USDC, percentages with two decimals and "variable".
- The approved list as hairline-ruled cards in white, with no logos.
- Factor squares on the approval; the apricot field is not used (no loss bound here).
- One committed orange.

STORY: The owner sees what is lent and where, at what variable rate, picks a protocol, reads what it is and what can go wrong, types an amount, reviews the exact steps (allow exactly N, supply N) with screening and simulation, accepts the risks, then approves with the Kit and Face ID; withdrawing is the same, back to the Account. A demo shows that an unlisted dApp is not sponsored.

FIRST VIEWPORT:
- An ink plate "Lent · live onchain" with the total in the balance figure and one row per protocol (amount, APY).
- Under it, the two protocol cards side by side on desktop, stacked on phones. Each card has the name, the APY in mono with "variable", one line of what it is, its risks, the position, and Deposit / Withdraw.
- The action opens under the cards: amount, then the sealed review plate, then the checks, the risk checkbox, the Kit, and "Approve with Kit and Face ID".

FORM: user-picked in the shape round (positions first, risk checkbox at review, "Demo: try an unlisted dApp" proof); no roll, inside the established world.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
