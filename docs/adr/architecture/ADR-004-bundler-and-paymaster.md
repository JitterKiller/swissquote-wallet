# ADR-004: Bundler and paymaster — Candide public endpoints (ERC-7677)

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [PDR-003](../product/PDR-003-gasless-by-default.md), [ADR-003](ADR-003-network-base-sepolia.md)

## Context

UserOps need a bundler, and gasless UX needs a paymaster (PDR-003). We don't want API keys or ETH to manage during the hackathon.

## Decision

- `https://api.candide.dev/public/v3/84532` serves as both **bundler** and **paymaster**, through `Erc7677Paymaster`. No API key is needed on testnets.
- The URLs can be overridden with `NEXT_PUBLIC_BUNDLER_URL` and `NEXT_PUBLIC_PAYMASTER_URL`.
- Every user transaction goes through **`sendCalls`** in `web/src/lib/wallet.ts`: build → sponsor → sign with the passkey → send → wait for inclusion. The backend relayer follows the same pattern (ADR-007).

## Consequences

- ✅ Free and keyless. The relayer needs no ETH either.
- ⚠️ Rate limits and availability are outside our control.
- Production: our own sponsorship policy (Candide dashboard or Pimlico), optionally an ERC-20 paymaster for paying gas in USDC.

## Alternatives considered

- **Pimlico**: needs an API key.
- **Self-hosted bundler**: too much operational work for a hackathon.
