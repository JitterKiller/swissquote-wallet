'use client'

import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'

import { EXPLORER_URL, USDC_DECIMALS, USDC_FAUCET_URL } from '@/lib/config'
import { getRecoveryStatus, isPasskeyOwner, type RecoveryStatus } from '@/lib/recovery'
import {
  loadActivity,
  saveActivity,
  toPublicKey,
  type Activity,
  type StoredWallet,
} from '@/lib/storage'
import { getUsdcBalance, isDeployed } from '@/lib/wallet'

import { RecoveryAlert, RevokedNotice, SecurityCard } from './SecurityPanel'
import SendForm from './SendForm'
import { Button, Card, shortAddress } from './ui'

export default function Dashboard({
  wallet,
  onForget,
  onSetupRecovery,
}: {
  wallet: StoredWallet
  onForget: () => void
  onSetupRecovery: () => void
}) {
  const [balance, setBalance] = useState<bigint | null>(null)
  const [deployed, setDeployed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<'send' | 'receive'>('receive')
  const [activity, setActivity] = useState<Activity[]>(() => loadActivity())
  const [copied, setCopied] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [recovery, setRecovery] = useState<RecoveryStatus | null>(null)
  const [isOwner, setIsOwner] = useState<boolean | null>(null)

  // Poll on-chain state: balance, deployment, guardians / pending recovery,
  // and whether this device's passkey still owns the wallet.
  useEffect(() => {
    let cancelled = false
    const load = () =>
      Promise.all([
        getUsdcBalance(wallet.address),
        isDeployed(wallet.address),
        getRecoveryStatus(wallet.address),
        isPasskeyOwner(wallet.address, toPublicKey(wallet)),
      ])
        .then(([usdc, live, status, owner]) => {
          if (cancelled) return
          setBalance(usdc)
          setDeployed(live)
          setRecovery(status)
          setIsOwner(owner)
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

  const refresh = () => setRefreshKey((k) => k + 1)

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(wallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  function onSent(entry: Activity) {
    const next = [entry, ...activity].slice(0, 20)
    setActivity(next)
    saveActivity(next)
    refresh()
  }

  if (isOwner === false) return <RevokedNotice onForget={onForget} />

  return (
    <>
      {recovery?.pending && (
        <RecoveryAlert wallet={wallet} pending={recovery.pending} onCancelled={refresh} />
      )}
      <Card className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted">
          <span>Hi {wallet.name}</span>
          <span className="rounded-full bg-background px-2 py-0.5 text-xs">Self-custody</span>
        </div>
        <div>
          <p className="text-4xl font-semibold tracking-tight">
            {balance === null ? '—' : Number(formatUnits(balance, USDC_DECIMALS)).toFixed(2)}
            <span className="ml-2 text-lg font-medium text-muted">USDC</span>
          </p>
          <p className="mt-1 text-xs text-muted">Network fees: covered by Swissquote</p>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-background px-3 py-2 text-sm">
          <a
            href={`${EXPLORER_URL}/address/${wallet.address}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono hover:underline"
          >
            {shortAddress(wallet.address)}
          </a>
          <button onClick={copyAddress} className="text-accent">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-muted">
          Smart account:{' '}
          {deployed === null
            ? 'checking…'
            : deployed
              ? 'active on-chain'
              : 'activates with your first transaction'}
        </p>
      </Card>

      <SecurityCard status={recovery} onSetup={onSetupRecovery} />

      <div className="grid grid-cols-2 gap-2">
        <Button variant={tab === 'receive' ? 'primary' : 'secondary'} onClick={() => setTab('receive')}>
          Receive
        </Button>
        <Button variant={tab === 'send' ? 'primary' : 'secondary'} onClick={() => setTab('send')}>
          Send
        </Button>
      </div>

      {tab === 'receive' ? (
        <Card className="space-y-3">
          <p className="text-sm font-medium">Your wallet address</p>
          <p className="break-all rounded-xl bg-background p-3 font-mono text-sm">{wallet.address}</p>
          <Button variant="secondary" className="w-full" onClick={copyAddress}>
            {copied ? 'Copied' : 'Copy address'}
          </Button>
          <p className="text-xs text-muted">
            Testnet only. Get free test USDC from the{' '}
            <a href={USDC_FAUCET_URL} target="_blank" rel="noreferrer" className="text-accent underline">
              Circle faucet
            </a>{' '}
            (choose Base Sepolia and paste this address).
          </p>
        </Card>
      ) : (
        <SendForm wallet={wallet} balance={balance} onSent={onSent} />
      )}

      {activity.length > 0 && (
        <Card className="space-y-3">
          <p className="text-sm font-medium">Activity</p>
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.txHash} className="flex items-center justify-between text-sm">
                <span>
                  Sent {a.amount} USDC to <span className="font-mono">{shortAddress(a.to)}</span>
                </span>
                <a
                  href={`${EXPLORER_URL}/tx/${a.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <button onClick={onForget} className="mt-auto text-xs text-muted hover:underline">
        Forget this wallet on this device (demo)
      </button>
    </>
  )
}
