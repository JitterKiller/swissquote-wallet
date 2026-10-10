# ADR-003: Network — Base Sepolia + Circle testnet USDC

- **Status:** Accepted
- **Date:** 2026-10-10
- **Related:** [ADR-001](ADR-001-safe-smart-account.md), [ADR-004](ADR-004-bundler-and-paymaster.md)

## Context

The demo must sign and send real transactions; a testnet is accepted. The chain needs cheap transactions, efficient P-256 verification, and every contract we depend on already deployed.

## Decision

- **Chain:** Base Sepolia, chain ID `84532`, RPC `https://sepolia.base.org`, explorer `https://sepolia.basescan.org`.
- **Asset:** Circle's official testnet USDC at `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, 6 decimals. Faucet: https://faucet.circle.com.
- Configured in `web/src/lib/config.ts`. The RPC can be overridden with `NEXT_PUBLIC_NODE_URL`.

## Consequences

- ✅ Checked on-chain: EntryPoint v0.9, the Safe 4337 module, the WebAuthn signer factory and shared signer, and the recovery modules are all deployed.
- ✅ Has the RIP-7212 precompile and Candide's public infrastructure.
- Production: Base mainnet or another L2, a business decision for Swissquote.

## Alternatives considered

- **Ethereum Sepolia**: works, but slower, and mainnet costs would be much higher.
- **Arbitrum Sepolia**: the default network in Candide's examples, and equally viable.
