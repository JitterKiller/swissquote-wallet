'use client'

import { Check, Copy, ExternalLink, Landmark } from 'lucide-react'
import QRCode from 'react-qr-code'

import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { useCopy } from '@/components/ui/address'
import { Button, buttonClasses } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Alert, Badge } from '@/components/ui/feedback'
import { PageHeader } from '@/components/ui/page'
import { USDC_FAUCET_URL } from '@/lib/config'

export function ReceiveView() {
  const { wallet } = useLoadedWallet()
  const { copied, copy } = useCopy()

  return (
    <div className="space-y-6">
      <PageHeader title="Receive" description="Share your address to receive USDC." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardBody className="flex flex-col items-center py-8 text-center">
            <div className="rounded-2xl border border-border bg-white p-4">
              <QRCode value={wallet.address} size={184} fgColor="#121418" bgColor="#ffffff" />
            </div>
            <p className="mt-6 text-sm text-muted">Your wallet address</p>
            <p className="mt-1 max-w-sm break-all font-mono text-sm">{wallet.address}</p>
            <Button className="mt-5 w-full max-w-xs" onClick={() => copy(wallet.address, 'Address copied')}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy address'}
            </Button>
            <div className="mt-6 w-full max-w-sm text-left">
              <Alert tone="warning" title="Base Sepolia only">
                Only send USDC on Base Sepolia (testnet) to this address. Assets sent from other networks may be lost.
              </Alert>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              icon={<Landmark className="h-[18px] w-[18px]" />}
              title="Top up from your Swissquote account"
              description="Move funds from your trading account to this wallet in one tap. Your ownership of this wallet is already verified."
              action={<Badge>Soon</Badge>}
            />
            <CardBody>
              <Button variant="secondary" className="w-full" disabled>
                Top up
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Get test USDC" description="This prototype runs on a testnet. Free USDC is available from Circle." />
            <CardBody className="space-y-4">
              <ol className="space-y-2 text-sm">
                {['Open the Circle faucet', 'Choose Base Sepolia', 'Paste your address and request USDC'].map((s, i) => (
                  <li key={s} className="flex items-center gap-3">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <a
                href={USDC_FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses('secondary', 'md', 'w-full')}
              >
                Open Circle faucet <ExternalLink className="h-4 w-4" />
              </a>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
