import { createPublicClient, http, parseAbiItem } from 'viem'
import { baseSepolia } from 'viem/chains'

import { ALLOWANCE_MODULE_ADDRESS, LOGS_NODE_URL, USDC_ADDRESS } from './config'

/**
 * Transaction history read from the chain: USDC Transfer events to/from the
 * wallet. No indexer needed. Timestamps are derived from block numbers (Base
 * produces a block every 2 seconds), which avoids one RPC call per block.
 *
 * For an Account, each outgoing transfer also says which factors approved it:
 * a payment within today's limit is executed by the Allowance Module (Face ID
 * alone, one ExecuteAllowanceTransfer event in the same transaction); any other
 * transfer out of the Account needs its 2 of 2 (Face ID + the Kit).
 */

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const ALLOWANCE_TRANSFER = parseAbiItem(
  'event ExecuteAllowanceTransfer(address indexed safe, address delegate, address token, address to, uint96 value, uint16 nonce)',
)
const client = createPublicClient({ chain: baseSepolia, transport: http(LOGS_NODE_URL) })

const MAX_RANGE = 49_000n // RPC limit is 50k blocks per eth_getLogs
const BLOCK_TIME_S = 2
export const DEFAULT_LOOKBACK_BLOCKS = 7n * 24n * 1800n // ~7 days

export type Transfer = {
  id: string
  direction: 'in' | 'out'
  counterparty: `0x${string}`
  amount: bigint
  txHash: `0x${string}`
  blockNumber: bigint
  timestamp: number // ms
  /** Outgoing only: Face ID alone, or Face ID + the Kit. */
  via?: 'face-id' | 'face-id+kit'
}

export const currentBlock = () => client.getBlockNumber()

/** `kind`: an Account (two routes out) or the phone's Key Safe (Face ID only). */
export async function fetchTransfers(address: `0x${string}`, fromBlock: bigint, kind: 'account' | 'key-safe' = 'key-safe') {
  const latest = await client.getBlock()
  const toBlock = latest.number
  const ranges: [bigint, bigint][] = []
  for (let start = fromBlock; start <= toBlock; start += MAX_RANGE + 1n) {
    ranges.push([start, start + MAX_RANGE < toBlock ? start + MAX_RANGE : toBlock])
  }

  const [logs, limitLogs] = await Promise.all([
    Promise.all(
      ranges.flatMap(([from, to]) => [
        client.getLogs({ address: USDC_ADDRESS, event: TRANSFER, args: { from: address }, fromBlock: from, toBlock: to }),
        client.getLogs({ address: USDC_ADDRESS, event: TRANSFER, args: { to: address }, fromBlock: from, toBlock: to }),
      ]),
    ),
    kind === 'account'
      ? Promise.all(
          ranges.map(([from, to]) =>
            client.getLogs({ address: ALLOWANCE_MODULE_ADDRESS, event: ALLOWANCE_TRANSFER, args: { safe: address }, fromBlock: from, toBlock: to }),
          ),
        )
      : [],
  ])
  const withinLimit = new Set(limitLogs.flat().map((log) => log.transactionHash))

  const me = address.toLowerCase()
  const byId = new Map<string, Transfer>()
  for (const log of logs.flat()) {
    const { from, to, value } = log.args
    if (!from || !to || !value) continue
    const id = `${log.transactionHash}:${log.logIndex}`
    const outgoing = from.toLowerCase() === me
    byId.set(id, {
      id,
      direction: outgoing ? 'out' : 'in',
      counterparty: outgoing ? to : from,
      amount: value,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp: (Number(latest.timestamp) - Number(toBlock - log.blockNumber) * BLOCK_TIME_S) * 1000,
      via: outgoing ? (kind === 'account' && !withinLimit.has(log.transactionHash) ? 'face-id+kit' : 'face-id') : undefined,
    })
  }
  return { transfers: [...byId.values()], toBlock }
}

export function mergeTransfers(current: Transfer[], incoming: Transfer[]) {
  const byId = new Map(current.map((t) => [t.id, t]))
  for (const t of incoming) byId.set(t.id, t)
  return [...byId.values()].sort((a, b) => (a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1))
}
