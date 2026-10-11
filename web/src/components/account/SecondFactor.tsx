'use client'

import { KeyRound, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Address } from 'viem'

import { useOwnerKinds } from '@/components/account/useOwnerKinds'
import { ApprovalSquares, FactorSquare } from '@/components/ui/factor'
import { Badge, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import type { AccountState, SecondFactor } from '@/lib/account'
import type { KeyRequestLine } from '@/lib/keyRelay'
import { unlockKit } from '@/lib/recoveryKit'
import { findSecurityKey, keyApprover } from '@/lib/securityKey'
import { loadLocalKit, loadSecurityKey, type SecurityKeyRecord } from '@/lib/storage'

export type SecondFactorChoice = 'kit' | 'key'
type KeyRef = Pick<SecurityKeyRecord, 'proxy' | 'credentialId' | 'kind'>
type Waiting = 'asked' | 'shown' | null

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/** The words for each second factor, on the review plate, the receipt and the Approve button (DESIGN.md, ADR-043). */
export const SECOND_FACTOR = {
  kit: { approval: 'Face ID + your Recovery Kit', plate: 'Face ID and your Kit will approve', button: 'Approve with Kit and biometrics' },
  key: { approval: 'Face ID + your security key', plate: 'Face ID and your key will approve', button: 'Approve with key and biometrics' },
} as const

/** The Approve button's icon: the Kit's key, or the security key's factor code (an outline square, ink on orange). */
export function SecondFactorIcon({ choice }: { choice: SecondFactorChoice }) {
  return choice === 'key' ? <span aria-hidden className="h-2.5 w-2.5 shrink-0 ring-[1.5px] ring-inset ring-accent-fg" /> : <KeyRound className="h-5 w-5" />
}

/** The busy label while the second factor is being opened (the Kit) or is answering (the key). */
export const openingLabel = (choice: SecondFactorChoice, waiting: Waiting) =>
  choice === 'kit' ? 'Opening your Kit…' : waiting === 'shown' ? 'Touch your key…' : 'Waiting for your key…'

/**
 * The factor that approves with Face ID when today's limit doesn't cover it (ADR-043): the Recovery Kit,
 * or the security key once it is an owner of the Account. The key comes first: a tap replaces the
 * passphrase (PDR-016). The passphrase and a picked Kit file stay in memory; nothing is stored.
 */
export function useSecondFactor(state: Pick<AccountState, 'owners'> | null, keySafe: Address, account: Address | undefined) {
  const { keyOwner } = useOwnerKinds(state ?? { owners: [] }, keySafe)
  const [record, setRecord] = useState<KeyRef | null>(() => loadSecurityKey())
  const [looked, setLooked] = useState<string | null>(null)
  const matches = !!keyOwner && same(record?.proxy, keyOwner)

  // A device that took the Account over (/lost) has no record of a key added elsewhere: the directory names it.
  useEffect(() => {
    if (!keyOwner || !account || matches) return
    let cancelled = false
    findSecurityKey(account)
      .then((found) => {
        if (cancelled) return
        if (found && same(found.proxy, keyOwner)) setRecord(found)
        setLooked(keyOwner)
      })
      .catch(() => !cancelled && setLooked(keyOwner))
    return () => {
      cancelled = true
    }
  }, [keyOwner, account, matches])

  // An owner the directory doesn't know is a FIDO2 key: its authenticator offers its credential.
  const key: KeyRef | null = keyOwner ? (matches ? record : { proxy: keyOwner, credentialId: '', kind: 'fido2' }) : null
  const keyKnown = matches || (!!keyOwner && same(looked, keyOwner))

  const [picked, setPicked] = useState<SecondFactorChoice | null>(null)
  const choice: SecondFactorChoice = picked ?? (key ? 'key' : 'kit')
  const [passphrase, setPassphrase] = useState('')
  const [kitFile, setKitFile] = useState<{ name: string; text: string } | null>(null)
  const [hasLocalKit] = useState(() => loadLocalKit() !== null)
  const [waiting, setWaiting] = useState<Waiting>(null)

  const ready = choice === 'key' ? !!key && keyKnown : passphrase.length > 0 && (hasLocalKit || !!kitFile)

  /** Opens the Kit, or prepares the key's approval: the key signs inside `twoFactorCall`, once the nonce is read. */
  async function resolve(describe: { title: string; lines: KeyRequestLine[] }): Promise<SecondFactor> {
    if (choice === 'key' && key) return { key: keyApprover(key, { describe, onWaiting: setWaiting }) }
    return { kit: (await unlockKit(passphrase, kitFile?.text)).owner }
  }

  return {
    choice,
    setChoice: setPicked,
    key,
    ready,
    passphrase,
    setPassphrase,
    kitFile,
    setKitFile,
    hasLocalKit,
    waiting,
    resolve,
    /** After a payment: forget the passphrase. */
    clear: () => setPassphrase(''),
  }
}

export type SecondFactorState = ReturnType<typeof useSecondFactor>

/**
 * The second factor's section on a review: the choice between the key and the Kit when the Account has a
 * key, then the Kit's passphrase (and file, when this device has no encrypted copy) or what the key does.
 */
export function SecondFactorSection({
  factor,
  idPrefix,
  kitTitle = 'Your Recovery Kit approves with Face ID',
  reason,
  className = 'space-y-4 border-t border-border pt-5',
  disabled = false,
}: {
  factor: SecondFactorState
  idPrefix: string
  kitTitle?: string
  /** Why a second factor is needed here, one sentence. */
  reason: string
  className?: string
  disabled?: boolean
}) {
  const { choice, key, kitFile, hasLocalKit } = factor
  const pickFile = async (file: File | undefined) => file && factor.setKitFile({ name: file.name, text: await file.text() })

  return (
    <section className={className} aria-label="Second factor">
      {key && (
        <div role="radiogroup" aria-label="Approve with" className="inline-flex rounded-xl border border-border bg-surface p-1">
          {(['key', 'kit'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={choice === option}
              disabled={disabled}
              onClick={() => factor.setChoice(option)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm transition-colors sm:min-h-9 ${
                choice === option ? 'bg-surface-2 font-medium text-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              <FactorSquare factor={option} />
              {option === 'key' ? 'Security key' : 'Recovery Kit'}
            </button>
          ))}
        </div>
      )}

      {choice === 'key' && key ? (
        <div className="flex gap-3">
          <ApprovalSquares kit second="key" className="mt-[5px]" />
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              Your security key approves with Face ID
              {key.kind === 'demo' && <Badge tone="warning">MOCK</Badge>}
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              {reason}{' '}
              {key.kind === 'demo'
                ? 'In this demo another phone plays your key: it shows this request, and a touch there replaces your Kit passphrase.'
                : 'Touch your key when it asks: that replaces your Kit passphrase.'}
            </p>
            <KeyWaiting waiting={factor.waiting} demo={key.kind === 'demo'} className="mt-3" />
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <ApprovalSquares kit className="mt-[5px]" />
            <div>
              <h3 className="text-sm font-semibold">{kitTitle}</h3>
              <p className="mt-0.5 text-sm text-muted">
                {reason} Your passphrase opens the encrypted Kit{hasLocalKit && !kitFile ? ' stored on this device' : ''}; it never leaves it.
              </p>
            </div>
          </div>
          {(!hasLocalKit || kitFile) && (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-3 text-sm transition-[border-color,box-shadow] hover:border-accent-ink focus-within:border-accent-ink focus-within:ring-4 focus-within:ring-accent-soft">
              <Upload className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 truncate">{kitFile ? kitFile.name : 'Choose your Kit file'}</span>
              <input type="file" accept="application/json,.json" aria-label="Recovery Kit file" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
            </label>
          )}
          <Field label="Kit passphrase" htmlFor={`${idPrefix}-kit-passphrase`}>
            <Input
              id={`${idPrefix}-kit-passphrase`}
              type="password"
              value={factor.passphrase}
              onChange={(e) => factor.setPassphrase(e.target.value)}
              autoComplete="off"
            />
          </Field>
          {hasLocalKit && !kitFile && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted hover:text-foreground">
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
              Use my Kit file instead
            </label>
          )}
        </>
      )}
    </section>
  )
}

/** While the key is asked: where to look. The demo key is another phone, so the request is waiting there. */
export function KeyWaiting({ waiting, demo, className = '' }: { waiting: Waiting; demo: boolean; className?: string }) {
  if (!waiting) return null
  return (
    <p role="status" className={`flex items-start gap-2 text-sm ${className}`}>
      <Spinner />
      <span>
        {waiting === 'shown' ? (
          <span className="font-medium">Your key shows the request. Touch it to approve.</span>
        ) : demo ? (
          <>
            <span className="font-medium">Waiting for your key…</span>{' '}
            <span className="text-muted">Open SQure Key on the other phone: the request is there.</span>
          </>
        ) : (
          <span className="font-medium">Touch your key…</span>
        )}
      </span>
    </p>
  )
}
