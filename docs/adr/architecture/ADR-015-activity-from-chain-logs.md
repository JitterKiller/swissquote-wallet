# ADR-015: Activity history read from on-chain USDC Transfer logs

- **Status:** Accepted
- **Date:** 2026-10-10
- **Amends:** [ADR-009](ADR-009-client-storage-public-data-only.md) (the local `sq-activity:v1` log is removed; `createdBlock` is added to the stored wallet)
- **Related:** [PDR-012](../product/PDR-012-web-first-banking-ux.md), [ADR-014](ADR-014-routing-and-wallet-state.md)

## Context

The first version only remembered transfers sent from this browser. It showed nothing that was received, and nothing after a recovery on a new device. We want the real history without running an indexer.

## Decision

- `src/lib/activity.ts` reads the USDC `Transfer` events where the wallet is the sender or the recipient, using `eth_getLogs`.
- **RPC:** `https://base-sepolia-rpc.publicnode.com` (`LOGS_NODE_URL`). `sepolia.base.org` caps log queries at 200 blocks; publicnode allows 50k. Queries are split into 49k-block chunks and run in parallel.
- **Start block:**
  - `StoredWallet.createdBlock`, recorded when the wallet is created;
  - otherwise the last ~7 days (recovered wallets).
- **Updates:** `WalletProvider` then fetches only the new blocks every 10 s and merges them, deduplicated by `txHash:logIndex`.
- **Timestamps** are computed from block numbers (Base produces one block every 2 s) instead of one `getBlock` call per transfer.

## Consequences

- ✅ Received and sent transfers appear within seconds, on any device, with no backend.
- ⚠️ A recovered wallet only shows the last ~7 days, because its creation block is unknown on the new device. Fix later through the wallet registry (open question).
- ⚠️ Depends on a free public RPC (limits, availability). Production: an indexer or a paid RPC.
- Only USDC is listed. Other tokens would need more event sources.
