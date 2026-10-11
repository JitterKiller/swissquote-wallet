import { erc20Abi, type Address } from 'viem'

import { USDC_ADDRESS } from './config'
import { formatDecimal } from './format'
import { INPUT_DECIMALS } from './inputs'
import { publicClient } from './wallet'

/**
 * The assets the Account can hold (ADR-032): USDC (the wallet's currency), EURC (Circle's euro) and
 * ETH, held as WETH so every asset is a token and swaps work the same both ways. Fees stay sponsored:
 * ETH is an asset, never fuel (PDR-003).
 */
export type AssetId = 'USDC' | 'EURC' | 'ETH'

export type Asset = { id: AssetId; symbol: string; name: string; address: Address; decimals: number; fraction: number }

export const ASSETS: Record<AssetId, Asset> = {
  USDC: { id: 'USDC', symbol: 'USDC', name: 'US dollar', address: USDC_ADDRESS, decimals: 6, fraction: 2 },
  EURC: { id: 'EURC', symbol: 'EURC', name: 'Euro', address: '0x808456652fdb597867f38412077A9182bf77359F', decimals: 6, fraction: 2 },
  ETH: { id: 'ETH', symbol: 'ETH', name: 'Ether (held as WETH)', address: '0x4200000000000000000000000000000000000006', decimals: 18, fraction: 6 },
}

export const ASSET_IDS = Object.keys(ASSETS) as AssetId[]

export const assetByAddress = (address: string) => ASSET_IDS.map((id) => ASSETS[id]).find((a) => a.address.toLowerCase() === address.toLowerCase()) ?? null

/**
 * Balances and quotes at each asset's precision: two decimals for the stablecoins, up to six for ETH.
 * Rounded down, like `formatUsdc`: never more than there is, and an ETH holding reads the same here
 * and on a receipt (0.000323, not 0.000324 beside it).
 */
export function formatAsset(amount: bigint, asset: Asset, round: 'nearest' | 'down' = 'down') {
  return formatDecimal(amount, asset.decimals, { places: asset.fraction, round })
}

/** What is given or received, to the last unit the app deals in: "0.499512 EURC" after a Max. */
export const formatAssetExact = (amount: bigint, asset: Asset) => formatDecimal(amount, asset.decimals, { places: INPUT_DECIMALS, round: 'down' })

/** An amount for the input field (Max, flip): plain digits, never more than the amount. */
export const toInput = (amount: bigint, asset: Asset) =>
  formatDecimal(amount, asset.decimals, { places: INPUT_DECIMALS, round: 'down', group: false, min: 0 })

/** At least one unit at the asset's precision: dust left by a Max is not shown as "0.00 ETH". */
export const shows = (amount: bigint, asset: Asset) => amount >= 10n ** BigInt(Math.max(asset.decimals - asset.fraction, 0))

/** All three balances of `owner` in one multicall. */
export async function readBalances(owner: Address): Promise<Record<AssetId, bigint>> {
  const results = await publicClient.multicall({
    contracts: ASSET_IDS.map((id) => ({ address: ASSETS[id].address, abi: erc20Abi, functionName: 'balanceOf' as const, args: [owner] as const })),
    allowFailure: false,
  })
  return Object.fromEntries(ASSET_IDS.map((id, i) => [id, results[i] as bigint])) as Record<AssetId, bigint>
}
