# PDR-003: Gasless by default — users never need ETH

- **Status:** Accepted, sponsorship policy refined by [PDR-015](PDR-015-open-wallet-and-levels.md) (level 0: 10 sponsored operations a month)
- **Date:** 2026-10-10
- **Related:** [ADR-004](../architecture/ADR-004-bundler-and-paymaster.md)

## Context

A new wallet funded with USDC holds no ETH, so it cannot pay gas: the first transfer fails unless the user buys ETH first. That is unacceptable UX for a bank client. Gasless transactions are also a bonus criterion.

## Decision

Every user operation is **sponsored by a paymaster**. The UI shows "Network fee: Free · sponsored by Swissquote". Users never hold or see ETH.

## Consequences

- ✅ USDC works out of the box, and the user never needs to understand gas.
- ✅ Business case: a transfer on an L2 costs Swissquote well under a cent, a marketing and retention cost far below the cost of acquiring a client.
- ⚠️ Production needs a sponsorship policy (Swissquote clients only, rate limits) to prevent abuse.
- Possible later: let users pay gas in USDC through an ERC-20 paymaster, with a margin as a source of revenue.

## Alternatives considered

- **User buys ETH first**: poor UX, users drop off.
- **Pay gas in USDC from day one**: viable, and kept as an option for later.
