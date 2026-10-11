'use client'

import { ExternalLink, KeyRound, Smartphone, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'

import { lossBound } from '@/components/account/LossBound'
import { WorstCaseChange } from '@/components/account/WorstCaseChange'
import { useLoadedWallet } from '@/components/providers/WalletProvider'
import { AddressPill } from '@/components/ui/address'
import { Button } from '@/components/ui/button'
import { ApprovalSquares, FactorSquare } from '@/components/ui/factor'
import { Alert, Badge, Spinner } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { Plate, PlateRow } from '@/components/ui/plate'
import { addOwnerCall, twoFactorCall, type AccountState } from '@/lib/account'
import { DEMO_ANY_AUTHENTICATOR, EVICTION_DAYS, EXPLORER_URL, type Level } from '@/lib/config'
import { errorMessage, formatUsdc, shortAddress } from '@/lib/format'
import { startPairing, waitForPairing, type KeyPairing } from '@/lib/keyRelay'
import { KitPassphraseError, unlockKit } from '@/lib/recoveryKit'
import { createSecurityKey, deployKeyProxyCall, keyErrorMessage, keyProxyAddress, registerSecurityKey, type NewSecurityKey } from '@/lib/securityKey'
import { loadLocalKit, saveSecurityKey, toPublicKey, type SecurityKeyRecord } from '@/lib/storage'
import { isDeployed, SEND_STEP_LABEL, sendCalls, type SendStep } from '@/lib/wallet'

/** The directory checks the key is an owner onchain: retry while the node catches up. */
async function listKey(record: SecurityKeyRecord) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await registerSecurityKey(record)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2_500))
    }
  }
  return null
}

/**
 * Add a security key (#17, PDR-017, ADR-038, surface brief web-src-components-account-securitykeyadd-tsx):
 * a WebAuthn key becomes the Account's third owner (threshold stays 2), signed by Face ID and the Kit
 * in one sponsored UserOp. Its point is speed: with the Kit, it locks a stolen phone out at once, so the
 * worst case drops to about one day of the limit.
 */
export function SecurityKeyAdd({
  state,
  level,
  onClose,
  onChanged,
}: {
  state: AccountState
  level: Level
  onClose: () => void
  /** The key is an owner onchain: the receipt replaces the form. */
  onChanged?: () => void
}) {
  const { wallet, refresh } = useLoadedWallet()
  const limit = state.allowance?.amount ?? null
  const [key, setKey] = useState<(NewSecurityKey & { kind: 'fido2' | 'demo' }) | null>(null)
  // MOCK (ADR-043): another phone plays the key on /wallet/key, paired with a code through the relay.
  const [pairing, setPairing] = useState<KeyPairing | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [kitFile, setKitFile] = useState<{ name: string; text: string } | null>(null)
  const [hasLocalKit] = useState(() => loadLocalKit() !== null)
  const [step, setStep] = useState<SendStep | 'opening' | 'registering' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ txHash: string; proxy: `0x${string}`; listed: boolean; demo: boolean } | null>(null)
  const panel = useRef<HTMLElement>(null)

  // Opened below the row (or from Offers): bring it into view. On the receipt, bring the whole row back
  // and move focus to the receipt: the Approve button that had it is gone.
  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = receipt ? (panel.current?.closest('li') ?? panel.current) : panel.current
    target?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' })
    panel.current?.focus({ preventScroll: true })
  }, [receipt])

  const before = limit !== null ? lossBound(limit, level) : null
  const after = limit
  const kitReady = passphrase.length > 0 && (hasLocalKit || !!kitFile)

  async function register() {
    setRegisterError(null)
    setStep('registering')
    try {
      setKey({ ...(await createSecurityKey(wallet.name, wallet.credentialId)), kind: 'fido2' })
    } catch (e) {
      setRegisterError(keyErrorMessage(e))
    } finally {
      setStep(null)
    }
  }

  async function pairDemoKey() {
    if (!wallet.account) return
    setRegisterError(null)
    try {
      setPairing(await startPairing({ account: wallet.account, label: wallet.name, excludeCredentialId: wallet.credentialId }))
    } catch (e) {
      setRegisterError(errorMessage(e))
    }
  }

  // While the code shows, wait for the other phone to register its key on it.
  useEffect(() => {
    if (!pairing) return
    const controller = new AbortController()
    waitForPairing(pairing.code, controller.signal)
      .then((registered) => {
        const x = BigInt(registered.publicKey.x)
        const y = BigInt(registered.publicKey.y)
        setKey({ credentialId: registered.credentialId, publicKey: { x, y }, proxy: keyProxyAddress(x, y), kind: 'demo' })
        setPairing(null)
      })
      .catch((e) => {
        if (controller.signal.aborted) return
        setRegisterError(errorMessage(e))
        setPairing(null)
      })
    return () => controller.abort()
  }, [pairing])

  async function approve() {
    if (!key || !wallet.account) return
    setError(null)
    try {
      setStep('opening')
      const kit = (await unlockKit(passphrase, kitFile?.text)).owner
      const add = await twoFactorCall({ account: wallet.account, keySafe: wallet.address, call: addOwnerCall(wallet.account, key.proxy), kit })
      // The verifier proxy is deployed in the same UserOp the first time (a security operation, sponsored).
      const calls = [...((await isDeployed(key.proxy)) ? [] : [deployKeyProxyCall(key)]), add]
      const result = await sendCalls({
        address: wallet.address,
        credentialId: wallet.credentialId,
        publicKey: toPublicKey(wallet),
        calls,
        onStep: setStep,
      })
      setPassphrase('')
      const record: SecurityKeyRecord = {
        account: wallet.account,
        credentialId: key.credentialId,
        publicKey: { x: key.publicKey.x.toString(), y: key.publicKey.y.toString() },
        proxy: key.proxy,
        addedAt: Date.now(),
        kind: key.kind,
      }
      saveSecurityKey(record)
      // A new device asks Swissquote's directory which credential to use: wait for it, say so if it failed.
      const listed = (await listKey(record)) !== null
      refresh()
      setReceipt({ txHash: result.txHash, proxy: key.proxy, listed, demo: key.kind === 'demo' })
      onChanged?.()
    } catch (e) {
      setError(e instanceof KitPassphraseError ? 'Wrong Kit passphrase. Check it and try again.' : errorMessage(e))
    } finally {
      setStep(null)
    }
  }

  const pickFile = async (file: File | undefined) => file && setKitFile({ name: file.name, text: await file.text() })

  if (receipt) {
    return (
      <section ref={panel} tabIndex={-1} className="scroll-mt-20 space-y-4 outline-none" aria-label="Security key added">
        <Plate title="Security key added · onchain" className="animate-enter">
          <dl>
            <PlateRow label="Owners">
              This phone, your Kit, your key
              <span className="block text-xs font-normal text-hero-muted">2 of 3 needed above your daily limit</span>
            </PlateRow>
            <PlateRow label="Security key">
              <span className="mt-0.5 flex justify-end">
                <AddressPill address={receipt.proxy} tone="hero" />
              </span>
            </PlateRow>
            <PlateRow label="Worst case">
              <span className="font-mono">{after !== null ? formatUsdc(after) : '–'}</span> USDC
              <span className="block text-xs font-normal text-hero-muted">If you act before the next daily reset</span>
            </PlateRow>
            <PlateRow label="Approved by">
              <span className="inline-flex items-center gap-2">
                <ApprovalSquares kit tone="hero" /> Face ID + your Recovery Kit
              </span>
            </PlateRow>
            <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
          </dl>
          <a
            href={`${EXPLORER_URL}/tx/${receipt.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-hero-muted transition-colors hover:text-hero-fg"
          >
            View on Basescan <ExternalLink className="h-3.5 w-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Plate>
        <p className="text-sm text-muted">
          {receipt.demo
            ? 'In this demo the other phone plays your key: keep SQure Key open there. Above your daily limit, a touch on it now replaces your Kit passphrase, and with your Kit it locks a lost phone out as soon as you act.'
            : 'Keep the key at home, apart from this phone. Above your daily limit, a touch on it replaces your Kit passphrase. If the phone is lost or stolen, open “Phone lost or stolen?” on a new device: your Kit and this key lock it out as soon as you act.'}
        </p>
        {!receipt.listed && (
          <Alert tone="warning" title="Not listed with Swissquote yet">
            Swissquote couldn’t record which key this is. A new device will still find it among the keys for this site.
          </Alert>
        )}
        <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
          Done
        </Button>
      </section>
    )
  }

  if (state.pendingEviction) {
    return (
      <section ref={panel} tabIndex={-1} className="scroll-mt-20 space-y-3 outline-none" aria-label="Add a security key">
        <p className="font-medium">A lock-out is in progress</p>
        <p className="text-sm text-muted">Stop it or let it finish before adding an owner.</p>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </section>
    )
  }

  return (
    <section ref={panel} tabIndex={-1} className="scroll-mt-20 space-y-5 outline-none" aria-label="Add a security key">
      <WorstCaseChange before={before} after={after} label="a security key">
        With your Kit and this key, a new device locks a stolen phone out as soon as you act, instead of after {EVICTION_DAYS[level]} days. The{' '}
        <span className="font-mono tabular-nums">{after !== null ? formatUsdc(after) : '–'}</span> holds if you act before the next daily reset;
        each reset adds one more day of your limit.
      </WorstCaseChange>

      <section aria-labelledby="key-title" className="space-y-3">
        <h3 id="key-title" className="flex items-center gap-2 text-sm font-semibold">
          <FactorSquare factor="key" /> Your security key
        </h3>
        {key ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3 text-sm">
            <span>
              <span className="flex items-center gap-2 font-medium">
                {key.kind === 'demo' ? 'Demo key registered' : 'Key registered'}
                {key.kind === 'demo' && <Badge tone="warning">MOCK</Badge>}
              </span>
              <span className="block text-muted">
                {key.kind === 'demo' ? 'Check the other phone shows the same address. ' : ''}It becomes an owner when you approve below.
              </span>
            </span>
            <span className="flex items-center gap-2">
              <AddressPill address={key.proxy} />
              <Button variant="ghost" size="sm" disabled={!!step} onClick={() => setKey(null)} className="max-sm:h-11">
                Use another key
              </Button>
            </span>
          </div>
        ) : pairing ? (
          <DemoKeyPairing pairing={pairing} onCancel={() => setPairing(null)} />
        ) : (
          <>
            <p className="text-sm text-muted">
              A FIDO2 key you keep at home, never this phone.
              {DEMO_ANY_AUTHENTICATOR && ' In this demo another device can play it: a computer’s Touch ID, or a teammate’s phone through the QR code.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" disabled={!!step} onClick={register}>
                {step === 'registering' ? (
                  <>
                    <Spinner /> Waiting for your key…
                  </>
                ) : (
                  'Register a security key'
                )}
              </Button>
              <Button variant="ghost" disabled={!!step} onClick={pairDemoKey}>
                <Smartphone className="h-4 w-4" /> Use a demo key on another phone
              </Button>
            </div>
            {registerError && (
              <p role="alert" className="text-sm text-danger">
                {registerError}
              </p>
            )}
          </>
        )}
      </section>

      {key && (
        <Plate
          title={
            <span className="inline-flex items-center gap-2">
              <ApprovalSquares kit tone="hero" />
              Face ID and your Kit will approve
            </span>
          }
        >
          <dl>
            <PlateRow label="New owner">
              <span className="inline-flex items-center gap-2">
                <FactorSquare factor="key" tone="hero" /> Your security key
              </span>
              <span className="mt-1.5 flex justify-end">
                <AddressPill address={key.proxy} tone="hero" />
              </span>
            </PlateRow>
            <PlateRow label="Owners after">
              This phone, your Kit, your key
              <span className="block text-xs font-normal text-hero-muted">Still 2 needed above your daily limit</span>
            </PlateRow>
            <PlateRow label="Lost or stolen phone">
              Locked out as soon as you act
              <span className="block text-xs font-normal text-hero-muted">Your Kit + this key, from a new device</span>
            </PlateRow>
            <PlateRow label="Worst case">
              <span className="font-mono">{after !== null ? formatUsdc(after) : '–'}</span> USDC
              <span className="block text-xs font-normal text-hero-muted">If you act before the next daily reset</span>
            </PlateRow>
            <PlateRow label="Network fee">Covered by Swissquote</PlateRow>
          </dl>
        </Plate>
      )}

      <section className="space-y-4 border-t border-border pt-5">
        <div className="flex gap-3">
          <ApprovalSquares kit className="mt-[5px]" />
          <div>
            <h3 className="text-sm font-semibold">Your Recovery Kit approves with Face ID</h3>
            <p className="mt-0.5 text-sm text-muted">
              Adding an owner changes your Account’s rules: it takes your Kit, so a thief with your phone can’t add a key of their own. Your
              passphrase opens the encrypted Kit{hasLocalKit && !kitFile ? ' stored on this device' : ''}; it never leaves it.
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
        <Field label="Kit passphrase" htmlFor="key-kit-passphrase">
          <Input id="key-kit-passphrase" type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" />
        </Field>
      </section>

      {error && (
        <Alert tone="danger" title="Key not added">
          {error}
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <Button variant="secondary" size="lg" disabled={!!step} onClick={onClose}>
          Cancel
        </Button>
        <Button size="lg" disabled={!key || !kitReady || !!step} onClick={approve}>
          {step && step !== 'registering' ? (
            <>
              <Spinner /> {step === 'opening' ? 'Opening your Kit…' : SEND_STEP_LABEL[step]}
            </>
          ) : (
            <>
              <KeyRound className="h-5 w-5" /> Approve with Kit and biometrics
            </>
          )}
        </Button>
      </div>
    </section>
  )
}

/**
 * MOCK (ADR-043): the code and QR code the phone playing the key reads on /wallet/key. The key it
 * registers comes back through the relay; the wallet computes its address from its public key.
 */
function DemoKeyPairing({ pairing, onCancel }: { pairing: KeyPairing; onCancel: () => void }) {
  const url = `${window.location.origin}/wallet/key?pair=${pairing.code}`
  return (
    <div className="space-y-4 rounded-2xl border border-border p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold">Pair a demo key</h4>
        <Badge tone="warning">MOCK</Badge>
      </div>
      <p className="text-sm text-muted">
        Another phone plays your key: never this one. On it, scan this code, or open <span className="font-mono text-foreground">/wallet/key</span> and type the
        code. Its Face ID registers the key.
      </p>
      <div className="flex flex-wrap items-center gap-5">
        <div className="rounded-lg border border-border bg-white p-2">
          <QRCode value={url} size={128} fgColor="#171717" bgColor="#ffffff" aria-label="QR code to pair the demo key" />
        </div>
        <div>
          <p className="text-xs text-muted">Code</p>
          <p className="font-mono text-3xl font-semibold tracking-[0.3em]" aria-live="polite">
            {pairing.code}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted" role="status">
            <Spinner /> Waiting for the other phone…
          </p>
          <p className="mt-1 text-xs text-muted">
            For Account <span className="font-mono">{shortAddress(pairing.account)}</span>, valid 10 minutes
          </p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="max-sm:h-11" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
