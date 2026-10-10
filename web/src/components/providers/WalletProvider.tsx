'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { DEFAULT_LOOKBACK_BLOCKS, currentBlock, fetchTransfers, mergeTransfers, type Transfer } from '@/lib/activity'
import { useIsClient } from '@/lib/hooks'
import { getRecoveryStatus, isPasskeyOwner, type RecoveryStatus } from '@/lib/recovery'
import { clearAll, loadWallet, saveWallet, toPublicKey, type StoredWallet } from '@/lib/storage'
import { getUsdcBalance, isDeployed } from '@/lib/wallet'

/**
 * Single source of truth for the wallet on this device + its on-chain state,
 * shared by every page. Polls the chain while a wallet is loaded.
 */

export type ChainState = {
  balance: bigint | null
  deployed: boolean | null
  recovery: RecoveryStatus | null
  isOwner: boolean | null
}

type WalletContextValue = {
  /** false during SSR/hydration: browser-only data is not available yet. */
  ready: boolean
  wallet: StoredWallet | null
  setWallet: (wallet: StoredWallet) => void
  forget: () => void
  chain: ChainState
  /** null while the first history scan is running. */
  transfers: Transfer[] | null
  refresh: () => void
}

const EMPTY_CHAIN: ChainState = { balance: null, deployed: null, recovery: null, isOwner: null }

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const ready = useIsClient()
  const [wallet, setWalletState] = useState<StoredWallet | null>(() =>
    typeof window === 'undefined' ? null : loadWallet(),
  )
  // On-chain state is keyed by address so a wallet switch never shows stale data.
  const [chainState, setChainState] = useState<{ address: string; state: ChainState } | null>(null)
  const [history, setHistory] = useState<{ address: string; items: Transfer[] } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!wallet) return
    let cancelled = false
    const load = () =>
      Promise.all([
        getUsdcBalance(wallet.address),
        isDeployed(wallet.address),
        getRecoveryStatus(wallet.address),
        isPasskeyOwner(wallet.address, toPublicKey(wallet)),
      ])
        .then(([balance, deployed, recovery, isOwner]) => {
          if (!cancelled) setChainState({ address: wallet.address, state: { balance, deployed, recovery, isOwner } })
        })
        .catch(() => {
          // RPC hiccup: keep the last known values.
        })
    load()
    const id = setInterval(load, 5_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [wallet, refreshKey])

  useEffect(() => {
    if (!wallet) return
    let cancelled = false
    let cursor: bigint | null = null
    let items: Transfer[] = []
    const sync = async () => {
      try {
        const from =
          cursor ?? (wallet.createdBlock ? BigInt(wallet.createdBlock) : (await currentBlock()) - DEFAULT_LOOKBACK_BLOCKS)
        const { transfers, toBlock } = await fetchTransfers(wallet.address, from)
        if (cancelled) return
        cursor = toBlock + 1n
        items = mergeTransfers(items, transfers)
        setHistory({ address: wallet.address, items })
      } catch {
        // Retry on the next tick.
      }
    }
    sync()
    const id = setInterval(sync, 10_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [wallet, refreshKey])

  const setWallet = useCallback((next: StoredWallet) => {
    saveWallet(next)
    setWalletState(next)
  }, [])

  const forget = useCallback(() => {
    clearAll()
    setWalletState(null)
  }, [])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const value = useMemo<WalletContextValue>(
    () => ({
      ready,
      wallet,
      setWallet,
      forget,
      refresh,
      chain: chainState && wallet && chainState.address === wallet.address ? chainState.state : EMPTY_CHAIN,
      transfers: history && wallet && history.address === wallet.address ? history.items : null,
    }),
    [ready, wallet, setWallet, forget, refresh, chainState, history],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet must be used inside <WalletProvider>')
  return context
}

/** For pages inside the app shell, where a wallet is guaranteed. */
export function useLoadedWallet() {
  const context = useWallet()
  if (!context.wallet) throw new Error('No wallet loaded')
  return { ...context, wallet: context.wallet }
}
