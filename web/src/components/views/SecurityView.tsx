'use client'

import {
  Check,
  FileKey,
  FingerprintPattern,
  Landmark,
  Minus,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge, Skeleton } from '@/components/ui/feedback'
import { PageHeader } from '@/components/ui/page'
import { api } from '@/lib/api'
import { RECOVERY_DELAY_LABEL } from '@/lib/config'
import { shortAddress } from '@/lib/format'

type Cell = 'yes' | 'no' | ReactNode

const PERMISSIONS: { who: string; detail: string; icon: ReactNode; cells: [Cell, Cell, Cell] }[] = [
  {
    who: 'You',
    detail: 'Passkey on this device',
    icon: <FingerprintPattern className="h-[18px] w-[18px]" />,
    cells: ['yes', 'no', 'yes'],
  },
  {
    who: 'Recovery Kit',
    detail: 'Kept offline by you',
    icon: <FileKey className="h-[18px] w-[18px]" />,
    cells: ['no', '1 of 2', 'no'],
  },
  {
    who: 'Swissquote',
    detail: 'After identity verification',
    icon: <Landmark className="h-[18px] w-[18px]" />,
    cells: ['no', '1 of 2', 'no'],
  },
]

const COLUMNS = ['Move funds', 'Approve a recovery', 'Cancel a recovery']

export function SecurityView() {
  return (
    <div className="space-y-6">
      <PageHeader title="Security" description="Who can do what with your wallet, and how you get it back." />
      <PermissionsCard />
      <div className="grid gap-6 lg:grid-cols-2">
        <RecoveryCard />
        <DeviceCard />
      </div>
      <DangerZone />
    </div>
  )
}

function PermissionsCard() {
  return (
    <Card>
      <CardHeader
        icon={<ShieldCheck className="h-[18px] w-[18px]" />}
        title="Who can do what"
        description="Self-custody: only your passkey can move funds. Recovery needs two independent approvals."
      />
      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="pb-3 font-medium" />
                {COLUMNS.map((c) => (
                  <th key={c} className="pb-3 text-center font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {PERMISSIONS.map((row) => (
                <tr key={row.who}>
                  <td className="py-3.5">
                    <span className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2">{row.icon}</span>
                      <span>
                        <span className="block font-medium">{row.who}</span>
                        <span className="block text-xs text-muted">{row.detail}</span>
                      </span>
                    </span>
                  </td>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="py-3.5 text-center">
                      <PermissionCell cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  )
}

function PermissionCell({ cell }: { cell: Cell }) {
  if (cell === 'yes')
    return (
      <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-success-soft text-success" aria-label="Yes">
        <Check className="h-4 w-4" />
      </span>
    )
  if (cell === 'no')
    return (
      <span className="inline-grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-muted" aria-label="No">
        <X className="h-4 w-4" />
      </span>
    )
  return <Badge tone="accent">{cell}</Badge>
}

function RecoveryCard() {
  const { chain } = useLoadedWallet()
  const status = chain.recovery
  const [swissquoteGuardian, setSwissquoteGuardian] = useState<string | null>(null)

  useEffect(() => {
    api<{ guardian: string }>('/api/guardian')
      .then(({ guardian }) => setSwissquoteGuardian(guardian.toLowerCase()))
      .catch(() => {})
  }, [])

  const protectedWallet = !!status && status.guardians.length > 0

  return (
    <Card>
      <CardHeader
        icon={
          protectedWallet ? (
            <ShieldCheck className="h-[18px] w-[18px] text-success" />
          ) : (
            <ShieldAlert className="h-[18px] w-[18px] text-warning" />
          )
        }
        title="Recovery"
        description="How you get your wallet back if you lose this device."
        action={
          status === null ? null : protectedWallet ? (
            <Badge tone="success">Protected</Badge>
          ) : (
            <Badge tone="warning">Not set up</Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        {status === null ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : protectedWallet ? (
          <>
            <ul className="space-y-2">
              {status.guardians.map((g) => {
                const isSwissquote = g.toLowerCase() === swissquoteGuardian
                return (
                  <li key={g} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-surface-2">
                      {isSwissquote ? <Landmark className="h-[18px] w-[18px]" /> : <FileKey className="h-[18px] w-[18px]" />}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{isSwissquote ? 'Swissquote Guardian' : 'Recovery Kit'}</span>
                      <span className="block text-xs text-muted">
                        {isSwissquote ? 'Signs only after identity verification' : 'File kept offline by you'}
                      </span>
                    </span>
                    <AddressPill address={g} />
                  </li>
                )
              })}
            </ul>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-xs text-muted">Approvals needed</dt>
                <dd className="mt-0.5 font-medium">
                  {status.threshold} of {status.guardians.length}
                </dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-xs text-muted">Delay before effect</dt>
                <dd className="mt-0.5 font-medium">{RECOVERY_DELAY_LABEL}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted">
              During the delay you can cancel any recovery from this device. Swissquote alone can never take control.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              Without recovery, losing this device means losing access to your wallet. Set it up in under a minute.
            </p>
            <ButtonLink href="/welcome/protect" className="w-full">
              Set up recovery
            </ButtonLink>
          </>
        )}
      </CardBody>
    </Card>
  )
}

function DeviceCard() {
  const { wallet, chain } = useLoadedWallet()
  return (
    <Card>
      <CardHeader
        icon={<Smartphone className="h-[18px] w-[18px]" />}
        title="This device"
        description="Your passkey is the only key that can move funds."
      />
      <CardBody>
        <dl className="divide-y divide-border text-sm">
          <DeviceRow label="Passkey">{wallet.name}</DeviceRow>
          <DeviceRow label="Credential ID">
            <span className="font-mono text-xs">{shortAddress(wallet.credentialId)}</span>
          </DeviceRow>
          <DeviceRow label="Stored in">Your device’s password manager (secure hardware)</DeviceRow>
          <DeviceRow label="Smart account">
            <AddressPill address={wallet.address} />
          </DeviceRow>
          <DeviceRow label="Status">
            {chain.deployed === null ? (
              <Minus className="h-4 w-4 text-muted" />
            ) : chain.deployed ? (
              <Badge tone="success">Active on-chain</Badge>
            ) : (
              <Badge>Activates with first transaction</Badge>
            )}
          </DeviceRow>
        </dl>
      </CardBody>
    </Card>
  )
}

function DeviceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

function DangerZone() {
  const { forget } = useLoadedWallet()
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  return (
    <Card className="border-danger/30">
      <CardHeader
        icon={<TriangleAlert className="h-[18px] w-[18px] text-danger" />}
        title="Forget this wallet on this device"
        description="Your funds stay safe on-chain, but you will need your Recovery Kit and Swissquote’s identity check to use this wallet here again."
        action={
          confirming ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  forget()
                  router.replace('/welcome')
                }}
              >
                Forget wallet
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
              Forget
            </Button>
          )
        }
      />
      <div className="h-5" />
    </Card>
  )
}
