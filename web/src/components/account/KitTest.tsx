'use client'

import { Check, ChevronDown, CircleCheck, Download, KeyRound, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Address } from 'viem'

import { nextKitTest } from '@/components/account/useKitTest'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { Button } from '@/components/ui/button'
import { FactorSquare } from '@/components/ui/factor'
import { Alert, Badge, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { readAccount } from '@/lib/account'
import { errorMessage, formatDay, shortAddress } from '@/lib/format'
import { KitPassphraseError, decryptKit, downloadKit, kitFileName, parseKitFile } from '@/lib/recoveryKit'
import { loadLocalKit, saveKitTestedAt } from '@/lib/storage'

const FILE_ID = 'kit-test-file'
const PASSPHRASE_ID = 'kit-test-passphrase'

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

type Result = { owner: Address; guardian: Address; testedAt: number }

/**
 * "Test your Recovery Kit" (#9, PDR-016, ADR-041, surface brief web-src-components-account-kittest-tsx):
 * an In-Row Panel under the Security page's "Recovery Kit" row. The owner opens the Kit file from their
 * cloud drive with its passphrase, as on a new phone; the app checks onchain that its owner key is an
 * owner of the Account and its guardian key a lock-out guardian. Nothing is signed or sent, and the file
 * and the passphrase never leave this device.
 */
export function KitTest({ onClose, onTested }: { onClose: () => void; onTested?: () => void }) {
  const { wallet } = useLoadedWallet()
  const account = wallet.account
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState<'opening' | 'checking' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [help, setHelp] = useState<'file' | 'passphrase' | null>(null)
  const [saved, setSaved] = useState(false)
  // This phone's encrypted copy (ADR-018): what a lost cloud file is saved again from.
  const [localKit] = useState(() => loadLocalKit())
  const panel = useRef<HTMLElement>(null)

  // Opened under its row (or from the Overview): bring the whole row into view, its "Due" above the form,
  // and focus the file. On the result, the row again (its new "Tested today"), and focus the result.
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = panel.current?.closest('li') ?? panel.current
    target?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
    // The section, not the file input: the drop zone's ring is for keyboard focus (Tab reaches it next).
    panel.current?.focus({ preventScroll: true })
  }, [result])

  if (!account) return null
  const expectedName = localKit ? kitFileName(localKit) : `swissquote-recovery-kit-${account.toLowerCase()}.json`

  async function test() {
    if (!file || !passphrase || !account) return
    setError(null)
    try {
      const parsed = parseKitFile(file.text)
      if (parsed.version !== 3) {
        throw new Error('This Kit is from before your Account and can’t open it. Choose the Kit you saved when you protected this wallet.')
      }
      if (!same(parsed.kit.account, account)) throw new Error(`This Kit is for another Account (${shortAddress(parsed.kit.account)}).`)
      setBusy('opening')
      const keys = await decryptKit(parsed.kit, passphrase)
      setBusy('checking')
      const state = await readAccount(account)
      const owns = state.owners.some((owner) => same(owner, keys.owner.address))
      const guards = state.guardians.some((guardian) => same(guardian, keys.guardian.address))
      if (!owns || !guards) throw new Error('This Kit opens, but its keys no longer guard your Account. Choose the Kit you saved most recently.')
      const testedAt = Date.now()
      saveKitTestedAt(testedAt)
      setResult({ owner: keys.owner.address, guardian: keys.guardian.address, testedAt })
      onTested?.()
    } catch (e) {
      setError(e instanceof KitPassphraseError ? 'Wrong passphrase. Check it and try again.' : errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  if (result) {
    return (
      <section ref={panel} tabIndex={-1} className="scroll-mt-20 space-y-4 outline-none" aria-label="Recovery Kit tested">
        <div className="animate-enter space-y-4">
          <div role="status">
            <p className="flex items-center gap-2.5 font-semibold">
              <FactorSquare factor="kit" />
              Kit tested
            </p>
            <p className="mt-1 text-sm text-muted">
              It opens with your passphrase and still guards your Account. Next test on {formatDay(nextKitTest(result.testedAt))}.
            </p>
          </div>
          <ul className="border-t border-border">
            <Checked>The file opens with your passphrase, on this device only</Checked>
            <Checked address={result.owner}>Its owner key is an owner of your Account, onchain</Checked>
            <Checked address={result.guardian}>Its guardian key guards the lock-out of a lost phone, onchain</Checked>
          </ul>
        </div>
        <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
          Done
        </Button>
      </section>
    )
  }

  return (
    <section ref={panel} tabIndex={-1} className="scroll-mt-20 space-y-5 outline-none" aria-label="Test your Recovery Kit">
      <p className="text-sm text-muted">
        Open the Kit file from iCloud Drive or Google Drive with its passphrase, as on a new phone. Nothing is signed or sent: both stay on this
        device.
      </p>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          test()
        }}
      >
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-sm transition-[border-color,box-shadow] focus-within:ring-4 focus-within:ring-accent-soft ${
            file ? 'border-success bg-success-soft' : 'border-border bg-surface-2 hover:border-accent-ink focus-within:border-accent-ink'
          }`}
        >
          {file ? <CircleCheck className="h-5 w-5 shrink-0 text-success" /> : <Upload className="h-5 w-5 shrink-0 text-muted" />}
          <span className="min-w-0">
            <span className="block font-medium">{file ? 'Kit file selected' : 'Choose your Kit file'}</span>
            <span className="block truncate text-xs text-muted">{file ? file.name : expectedName}</span>
          </span>
          <input
            id={FILE_ID}
            type="file"
            accept="application/json,.json"
            aria-label="Recovery Kit file"
            className="sr-only"
            onChange={async (e) => {
              const picked = e.target.files?.[0]
              if (!picked) return
              setFile({ name: picked.name, text: await picked.text() })
              setError(null)
            }}
          />
        </label>
        <Field label="Kit passphrase" htmlFor={PASSPHRASE_ID}>
          <Input id={PASSPHRASE_ID} type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" />
        </Field>

        {error && (
          <Alert tone="danger" title="Kit not tested">
            {error}
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <Button type="button" variant="secondary" size="lg" disabled={!!busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={!file || !passphrase || !!busy}>
            {busy ? (
              <>
                <Spinner /> {busy === 'opening' ? 'Opening your Kit…' : 'Checking onchain…'}
              </>
            ) : (
              <>
                <KeyRound className="h-5 w-5" /> Test my Kit
              </>
            )}
          </Button>
        </div>
      </form>

      <div className="border-t border-border pt-3">
        <div className="flex flex-wrap gap-x-6">
          <HelpToggle id="kit-help-file" open={help === 'file'} onToggle={() => setHelp(help === 'file' ? null : 'file')}>
            Can’t find the file?
          </HelpToggle>
          <HelpToggle id="kit-help-passphrase" open={help === 'passphrase'} onToggle={() => setHelp(help === 'passphrase' ? null : 'passphrase')}>
            Forgot the passphrase?
          </HelpToggle>
        </div>
        {help === 'file' && (
          <div id="kit-help-file" className="mt-2 space-y-3 text-sm text-muted">
            {localKit ? (
              <>
                <p>
                  This phone keeps an encrypted copy of your Kit. Save it again, move it to iCloud Drive or Google Drive, then choose it above: it opens
                  with the same passphrase.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="max-sm:h-11"
                  onClick={() => {
                    downloadKit(localKit)
                    setSaved(true)
                  }}
                >
                  <Download className="h-4 w-4" /> Save my Kit again
                </Button>
                {saved && (
                  <p role="status" className="text-foreground">
                    Saved to your downloads as {kitFileName(localKit)}. Move it to your cloud drive, then test it here.
                  </p>
                )}
              </>
            ) : (
              <p>Look for {expectedName} in iCloud Drive, Google Drive or your downloads. This phone keeps no copy to save again.</p>
            )}
          </div>
        )}
        {help === 'passphrase' && (
          <div id="kit-help-passphrase" className="mt-2 space-y-2 text-sm text-muted">
            <p>Nobody can reset it, not even Swissquote: only you know it. Try the ones you might have used; a test is free and stays on this device.</p>
            <p>
              Your money is safe while this phone works, but losing the phone as well would lock you out. Until then, Face ID alone can still move
              it out, up to your daily limit each day, to a new wallet with a new Kit.
            </p>
            <p>
              With a security key, this phone and the key will replace a forgotten Kit at once. <Badge>Soon</Badge>
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

/** A disclosure under the form: an Ember Ink text button, 44px tall on phones. */
function HelpToggle({ id, open, onToggle, children }: { id: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={id}
      onClick={onToggle}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-accent-ink underline-offset-4 hover:underline sm:min-h-9"
    >
      {children}
      <ChevronDown className={`h-4 w-4 transition-transform duration-150 ease-out ${open ? 'rotate-180' : ''}`} aria-hidden />
    </button>
  )
}

/** One verified fact: an ink check (never green, DESIGN.md), the fact, and the key it was checked against. */
function Checked({ address, children }: { address?: Address; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3 border-b border-border py-2.5 text-sm sm:grid-cols-[1rem_minmax(0,1fr)_auto] sm:items-center">
      <Check className="mt-0.5 h-4 w-4 sm:mt-0" aria-hidden />
      <span>{children}</span>
      {address && (
        <span className="col-start-2 mt-1.5 sm:col-start-auto sm:mt-0">
          <AddressPill address={address} />
        </span>
      )}
    </li>
  )
}
