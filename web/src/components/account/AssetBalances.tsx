'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'

import { ASSETS, ASSET_IDS, formatAsset, readBalances, shows, type AssetId } from '@/lib/assets'

/** USDC, EURC and ETH (WETH) held by the Account, refreshed every 15 s and whenever `refreshKey` changes (ADR-032). */
export function useAssetBalances(account: Address | null, refreshKey = 0) {
  const [state, setState] = useState<{ account: Address; balances: Record<AssetId, bigint> } | null>(null)
  useEffect(() => {
    if (!account) return
    let cancelled = false
    const load = () =>
      readBalances(account)
        .then((balances) => !cancelled && setState({ account, balances }))
        .catch(() => {
          // RPC hiccup: keep the last values.
        })
    load()
    const id = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [account, refreshKey])
  return state && state.account === account ? state.balances : null
}

/** "0.49 EURC · 0.000791 ETH": the other assets, only when the Account holds some. */
export function otherBalancesLine(balances: Record<AssetId, bigint> | null) {
  if (!balances) return null
  const parts = ASSET_IDS.filter((id) => id !== 'USDC' && shows(balances[id], ASSETS[id])).map(
    (id) => `${formatAsset(balances[id], ASSETS[id])} ${ASSETS[id].symbol}`,
  )
  return parts.length ? parts.join(' · ') : null
}
