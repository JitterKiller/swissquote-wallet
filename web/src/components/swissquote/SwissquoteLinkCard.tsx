'use client'

import { BadgeCheck, Link2, LogOut, ShieldCheck } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Alert, Badge } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'

import type { SwissquoteLink } from './useSwissquoteLink'

/** MOCK Swissquote sign-in + link this wallet to the account with one Face ID (PDR-015, PDR-022). */
export function SwissquoteLinkCard({ link, description }: { link: SwissquoteLink; description: string }) {
  const [name, setName] = useState('')
  const { session, linked, busy, error } = link

  return (
    <Card>
      <CardHeader
        icon={<ShieldCheck className="h-[18px] w-[18px]" />}
        title="Swissquote account"
        description={description}
        action={<Badge tone="warning">MOCK</Badge>}
      />
      <CardBody className="space-y-4">
        {!session ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              link.signIn(name)
            }}
          >
            <Field label="Name on your Swissquote account" htmlFor="name" hint="Mock e-banking sign-in for the demo.">
              <Input id="name" placeholder="Adam Meier" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" disabled={name.trim().length < 2}>
              Sign in with Swissquote
            </Button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{session.displayName}</p>
              <p className="text-xs text-muted">Client {session.clientId}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={link.signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        )}

        {session && link.checked && !linked && (
          <Alert
            tone="info"
            title="Link this wallet to your account"
            action={
              <Button disabled={busy} onClick={() => void link.link()}>
                <Link2 className="h-4 w-4" /> {busy ? 'Waiting for Face ID…' : 'Link with Face ID'}
              </Button>
            }
          >
            One Face ID signs a statement that this wallet is yours. Swissquote keeps it as proof of ownership (FINMA travel rule) and will see this wallet&apos;s on-chain activity.
          </Alert>
        )}
        {linked && (
          <p className="flex items-center gap-2 text-sm">
            <BadgeCheck className="h-4 w-4 text-success" /> Linked as <span className="font-medium">{linked.maskedName}</span>
          </p>
        )}
        {error && <Alert tone="danger" title="Could not link this wallet">{error}</Alert>}
      </CardBody>
    </Card>
  )
}
