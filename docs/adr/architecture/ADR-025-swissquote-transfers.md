# ADR-025: Swissquote account transfers — treasury = relayer Safe, deposits verified from on-chain logs

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-024](../product/PDR-024-swissquote-account-transfers.md), [ADR-007](ADR-007-swissquote-guardian-and-relayer.md), [ADR-020](ADR-020-deployment-vercel-upstash.md), [ADR-021](ADR-021-wallet-registry.md), [ADR-017](ADR-017-two-safe-account.md)

## Decision

- **Server** (`web/src/server/swissquoteAccount.ts`):
  - **Account balances (MOCK):** store collection `sqAccounts` (client id → USDC base units as a string). It is opened at 1,000 USDC on first read.
  - **Treasury and deposit address:** the Swissquote relayer Safe (`relayerAddress()`, ADR-007). It holds real test USDC on Base Sepolia.
  - **`withdrawToWallet({ clientId, amount })`:**
    1. checks that the client is linked (registry), that the mock balance covers the amount and that the treasury's on-chain USDC balance covers it;
    2. `relay([USDC.transfer(account, amount)])`;
    3. debits the account, appends a `travelRule` record and notifies the client.

    An empty treasury answers 503 with the address to fund.
  - **`creditDeposit({ clientId, txHash })`:**
    1. a single-use marker per transaction (`setIfAbsent('deposits', txHash)`);
    2. reads the receipt and sums the USDC `Transfer` logs whose sender is the client's Account or Key Safe and whose recipient is the deposit address;
    3. credits that amount, appends a `travelRule` record and notifies the client.
- **Routes** (MOCK auth, client id from the mock session):
  - `GET /api/swissquote/account?clientId=` (balance, deposit address, treasury balance);
  - `POST /api/swissquote/withdraw`;
  - `POST /api/swissquote/deposit`.
- **Client** (`web/src/lib/swissquoteAccount.ts`): `moveToSwissquote(wallet, amount)` sends the transfer with `sendCalls`. It uses the Account's daily allowance (`allowanceTransferCall`, ADR-017) when the wallet has an Account, and a plain Key Safe transfer for legacy wallets. Then it posts the transaction hash.
- **UI:** page `/swissquote` (`SwissquoteView`). The Swissquote sign-in and link card is shared with `/handle` (`useSwissquoteLink`, `SwissquoteLinkCard`).

## Consequences

- ✅ No new contract, key or service: the relayer already exists and is sponsored.
- ✅ Deposits are trusted from on-chain data only: a fake or reused transaction hash credits nothing.
- ⚠️ Read-modify-write of the mock balance is not atomic. That is acceptable for one client clicking in a demo.
- ⚠️ The treasury needs a one-time manual top-up from the Circle faucet (CAPTCHA).
