'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { readAccount, type AccountState } from '@/lib/account'
import { DEFAULT_LOOKBACK_BLOCKS, currentBlock, fetchTransfers, mergeTransfers, type Transfer } from '@/lib/activity'
import { isEvicted } from '@/lib/eviction'
import { useIsClient } from '@/lib/hooks'
import { getRecoveryStatus, isPasskeyOwner, type RecoveryStatus } from '@/lib/recovery'
import { clearAll, loadWallet, saveWallet, toPublicKey, type StoredWallet } from '@/lib/storage'
import { getUsdcBalance, isDeployed } from '@/lib/wallet'

/**
 * Single source of truth for the wallet on this device + its on-chain state,
 * shared by every page. Polls the chain while a wallet is loaded.
 */

export type ChainState = {
  /** USDC on the funds address: the Account once it exists (ADR-017), else the Key Safe. */
  balance: bigint | null
  /** USDC left on the phone's Key Safe once an Account exists (received before it): to sweep. */
  keySafeBalance: bigint | null
  /** Key Safe (the passkey Safe) deployed. */
  deployed: boolean | null
  recovery: RecoveryStatus | null
  isOwner: boolean | null
  /** Account owners, allowance left today, pending eviction (null before protection). */
  account: AccountState | null
}

type WalletContextValue = {
  /** false during SSR/hydration: browser-only data is not available yet. */
  ready: boolean
  wallet: StoredWallet | null
  /** The Account Safe holding the funds (ADR-017), null until protection is activated. */
  account: `0x${string}` | null
  /** Where funds live and are received: the Account, or the Key Safe before protection. */
  fundsAddress: `0x${string}` | null
  setWallet: (wallet: StoredWallet) => void
  forget: () => void
  chain: ChainState
  /** null while the first history scan is running. */
  transfers: Transfer[] | null
  refresh: () => void
}

const EMPTY_CHAIN: ChainState = {
  balance: null,
  keySafeBalance: null,
  deployed: null,
  recovery: null,
  isOwner: null,
  account: null,
}

/** Chain state and history are keyed by wallet + Account, so protecting a wallet never shows stale data. */
const keyOf = (wallet: StoredWallet) => `${wallet.address}:${wallet.account ?? ''}`

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
    const account = wallet.account
    const load = () =>
      Promise.all([
        getUsdcBalance(account ?? wallet.address),
        account ? getUsdcBalance(wallet.address) : Promise.resolve(null),
        isDeployed(wallet.address),
        getRecoveryStatus(wallet.address),
        isPasskeyOwner(wallet.address, toPublicKey(wallet)),
        account ? readAccount(account, { keySafe: wallet.address }) : Promise.resolve(null),
      ])
        .then(([balance, keySafeBalance, deployed, recovery, isOwner, accountState]) => {
          if (!cancelled) {
            // Revoked if the passkey lost the Key Safe (legacy recovery) or the Key Safe lost the Account (eviction, #16).
            const owner = isOwner && !isEvicted(accountState, wallet.address)
            setChainState({
              address: keyOf(wallet),
              state: { balance, keySafeBalance, deployed, recovery, isOwner: owner, account: accountState },
            })
          }
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
        const { transfers, toBlock } = await fetchTransfers(wallet.account ?? wallet.address, from)
        if (cancelled) return
        cursor = toBlock + 1n
        items = mergeTransfers(items, transfers)
        setHistory({ address: keyOf(wallet), items })
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
      account: wallet?.account ?? null,
      fundsAddress: wallet ? (wallet.account ?? wallet.address) : null,
      setWallet,
      forget,
      refresh,
      chain: chainState && wallet && chainState.address === keyOf(wallet) ? chainState.state : EMPTY_CHAIN,
      transfers: history && wallet && history.address === keyOf(wallet) ? history.items : null,
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
