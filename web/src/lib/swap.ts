import type { MetaTransaction } from 'abstractionkit'
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeFunctionData,
  encodeFunctionData,
  erc20Abi,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hex,
} from 'viem'

import { batchCalls, twoFactorCall, type AccountCall, type SecondFactor } from './account'
import { assetByAddress, formatAsset, formatAssetExact, type Asset } from './assets'
import { UNISWAP_V3_ROUTER } from './dapps'
import { publicClient } from './wallet'

/**
 * Swaps (PDR-028, ADR-032): USDC ↔ EURC and USDC ↔ ETH (WETH) at Uniswap v3 on Base Sepolia, through
 * SwapRouter02, an approved contract (sponsored). Every swap is a dApp action: Face ID + the Kit, an
 * exact approval, the Account as the only recipient, a minimum out (0.5% slippage) and a deadline.
 */

const QUOTER = '0xC5290058841028F1614F3A6F0F5816cAd0df5E27' as const // Uniswap QuoterV2, Base Sepolia
const FEE_TIERS = [100, 500, 3000, 10000] as const
export const SLIPPAGE_BPS = 50n // 0.5%
const DEADLINE_SECONDS = 600n

const quoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
])
const routerAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
  'function multicall(uint256 deadline, bytes[] data) payable returns (bytes[])',
])

export type Quote = { amountIn: bigint; amountOut: bigint; minOut: bigint; fee: number }

/**
 * The best quote over Uniswap's fee tiers (like an aggregator would), or null when no pool can fill
 * it (every tier reverts). Throws when the node did not answer: that is not "no pool".
 */
export async function quoteSwap(tokenIn: Asset, tokenOut: Asset, amountIn: bigint): Promise<Quote | null> {
  const results = await Promise.allSettled(
    FEE_TIERS.map((fee) =>
      publicClient
        .simulateContract({
          address: QUOTER,
          abi: quoterAbi,
          functionName: 'quoteExactInputSingle',
          args: [{ tokenIn: tokenIn.address, tokenOut: tokenOut.address, amountIn, fee, sqrtPriceLimitX96: 0n }],
        })
        .then((r) => ({ fee, amountOut: r.result[0] })),
    ),
  )
  const quotes = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  const unanswered = results.find(
    (r) => r.status === 'rejected' && !(r.reason instanceof BaseError && r.reason.walk((e) => e instanceof ContractFunctionRevertedError)),
  )
  if (!quotes.length && unanswered) throw (unanswered as PromiseRejectedResult).reason
  const best = quotes.reduce<{ fee: number; amountOut: bigint } | null>((top, q) => (!top || q.amountOut > top.amountOut ? q : top), null)
  if (!best || best.amountOut === 0n) return null
  return { amountIn, amountOut: best.amountOut, minOut: (best.amountOut * (10_000n - SLIPPAGE_BPS)) / 10_000n, fee: best.fee }
}

/** The Account's steps: allow the router to take exactly `amountIn`, then swap it for at least `minOut`, back to the Account. */
export function swapSteps(params: { account: Address; tokenIn: Asset; tokenOut: Asset; quote: Quote; now?: bigint }): AccountCall[] {
  const { account, tokenIn, tokenOut, quote } = params
  const deadline = (params.now ?? BigInt(Math.floor(Date.now() / 1000))) + DEADLINE_SECONDS
  const swap = encodeFunctionData({
    abi: routerAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: quote.fee,
        recipient: account,
        amountIn: quote.amountIn,
        amountOutMinimum: quote.minOut,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })
  return [
    { to: tokenIn.address, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [UNISWAP_V3_ROUTER, quote.amountIn] }) },
    { to: UNISWAP_V3_ROUTER, data: encodeFunctionData({ abi: routerAbi, functionName: 'multicall', args: [deadline, [swap]] }) },
  ]
}

/** One 2-factor Key Safe UserOp for the swap (Kit owner key or security key + Key Safe as msg.sender). */
export async function swapCalls(
  params: { account: Address; keySafe: Address; tokenIn: Asset; tokenOut: Asset; quote: Quote } & SecondFactor,
): Promise<MetaTransaction[]> {
  const { account, keySafe } = params
  const call = batchCalls(swapSteps(params))
  return [await twoFactorCall(params.key ? { account, keySafe, call, key: params.key } : { account, keySafe, call, kit: params.kit })]
}

/**
 * What the Account received, read from the transaction's own Transfer logs (not a balance read
 * that a lagging node could miss). Null when the receipt cannot be read.
 */
export async function receivedBy(account: Address, token: Asset, txHash: Hex): Promise<bigint | null> {
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 20_000 })
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs })
    const received = transfers
      .filter((log) => log.address.toLowerCase() === token.address.toLowerCase() && log.args.to.toLowerCase() === account.toLowerCase())
      .reduce((sum, log) => sum + log.args.value, 0n)
    return received > 0n ? received : null
  } catch {
    return null
  }
}

/** The router call in words, for the preview before Face ID: "Swap 0.50 USDC for at least 0.49 EURC". */
export function describeSwap(data: Hex): string | null {
  const outer = decodeFunctionData({ abi: routerAbi, data })
  if (outer.functionName !== 'multicall') return null
  const lines = outer.args[1].map((inner) => {
    const call = decodeFunctionData({ abi: routerAbi, data: inner })
    if (call.functionName !== 'exactInputSingle') return null
    const { tokenIn, tokenOut, amountIn, amountOutMinimum } = call.args[0]
    const given = assetByAddress(tokenIn)
    const got = assetByAddress(tokenOut)
    if (!given || !got) return null
    return `Swap ${formatAssetExact(amountIn, given)} ${given.symbol} for at least ${formatAsset(amountOutMinimum, got, 'down')} ${got.symbol}`
  })
  return lines.every(Boolean) ? lines.join(', ') : null
}
