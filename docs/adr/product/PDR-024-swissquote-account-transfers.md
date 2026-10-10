# PDR-024: Transfers between the Swissquote account and the wallet — one tap, both directions, travel rule filled in

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-015](PDR-015-open-wallet-and-levels.md), [PDR-022](PDR-022-wallet-registry-ownership-proof.md), [PDR-007](PDR-007-prototype-scope-real-vs-mocked.md), [ADR-025](../architecture/ADR-025-swissquote-transfers.md), issue #19

## Context

- The brief asks for a wallet that stays "one step away" from the Swissquote account. Today, moving crypto out means whitelisting, fees and manual checks, and depositing back means proving ownership (screenshots for exchange deposits).
- FINMA Guidance 02/2019: Swissquote may only transact with an external wallet that belongs to its client. The registry (PDR-022) now proves that with one Face ID.
- The demo must not depend on a faucet.

## Decision

- **Linked clients only (level 1).** Both directions use the registered Account; no manual whitelisting, no screenshots.
- **Swissquote → wallet ("Move to my wallet"):** Swissquote debits the client's (MOCK) account balance and sends real test USDC on-chain from its treasury to the client's Account.
- **Wallet → Swissquote ("Move to Swissquote"):** the wallet sends USDC to Swissquote's deposit address with Face ID. Swissquote credits the account **automatically** once it sees an on-chain transfer coming from the client's registered Account (or its Key Safe), once per transaction.
- **Travel rule by construction:** originator and beneficiary are the same verified client. Each transfer is recorded with the client, the Account, the amount, the transaction and the registry proof.
- **MOCK parts:** the Swissquote account balance (opening balance 1,000 USDC), the client authentication (client id from the mock session), and the treasury, which is Swissquote's relayer Safe. It must be funded once by a human with test USDC from the Circle faucet, since the faucet has a CAPTCHA. Deposits refill it, so the money circulates during the demo.
- **Fees:** none in the prototype. The business case (#31) decides whether instant transfers to one's own wallet are free (retention) or priced.

## Consequences

- ✅ "One step away" made concrete: one tap each way, settled on-chain in seconds on Base.
- ✅ The FINMA ownership check is automatic, and the travel-rule record is complete without asking the client anything.
- ✅ Demo without a faucet once the treasury is funded.
- ⚠️ The account balance is a mock, and it is not backed by real money.
- ⚠️ With the two-Safe Account (ADR-017), "Move to Swissquote" spends from the daily limit with Face ID. Above it, it needs the 2-factor send flow (#12).

## Alternatives considered

- **Faucet links in the demo:** slow, CAPTCHA, and it shows nothing about the bank link.
- **Manual review of deposits:** exactly the friction the registry removes.
