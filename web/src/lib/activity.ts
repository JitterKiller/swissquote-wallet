import { createPublicClient, http, parseAbiItem } from 'viem'
import { baseSepolia } from 'viem/chains'

import { LOGS_NODE_URL, USDC_ADDRESS } from './config'

/**
 * Transaction history read from the chain: USDC Transfer events to/from the
 * wallet. No indexer needed. Timestamps are derived from block numbers (Base
 * produces a block every 2 seconds), which avoids one RPC call per block.
 */

const TRANSFER = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
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
}

export const currentBlock = () => client.getBlockNumber()

export async function fetchTransfers(address: `0x${string}`, fromBlock: bigint) {
  const latest = await client.getBlock()
  const toBlock = latest.number
  const ranges: [bigint, bigint][] = []
  for (let start = fromBlock; start <= toBlock; start += MAX_RANGE + 1n) {
    ranges.push([start, start + MAX_RANGE < toBlock ? start + MAX_RANGE : toBlock])
  }

  const logs = await Promise.all(
    ranges.flatMap(([from, to]) => [
      client.getLogs({ address: USDC_ADDRESS, event: TRANSFER, args: { from: address }, fromBlock: from, toBlock: to }),
      client.getLogs({ address: USDC_ADDRESS, event: TRANSFER, args: { to: address }, fromBlock: from, toBlock: to }),
    ]),
  )

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
    })
  }
  return { transfers: [...byId.values()], toBlock }
}

export function mergeTransfers(current: Transfer[], incoming: Transfer[]) {
  const byId = new Map(current.map((t) => [t.id, t]))
  for (const t of incoming) byId.set(t.id, t)
  return [...byId.values()].sort((a, b) => (a.blockNumber === b.blockNumber ? 0 : a.blockNumber > b.blockNumber ? -1 : 1))
}
