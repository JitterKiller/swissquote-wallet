/**
 * Acceptance check for issue #9 (Kit v3, library part). Local, no chain needed.
 *
 *  K1  encryptKit → decryptKit round trip (owner + guardian keys).
 *  K2  A wrong passphrase is rejected (KitPassphraseError).
 *  K3  Neither the file nor the local copy contains a plaintext key.
 *  K4  unlockKit works from the local copy and from a picked file.
 *  K5  parseKitFile reads v3, still reads v1 (legacy), rejects garbage.
 *  K6  Passphrase rules: at least 12 characters, not only digits.
 *  K7  The decrypted owner key co-signs an Account transaction (lib/account.ts).
 *
 * Run: npm run check:kit
 */
import { verifyTypedData, type Address } from 'viem'

import { accountTypedData, kitSignature, tokenTransferCall } from '../src/lib/account'
import {
  KitPassphraseError,
  createKitKeys,
  createRecoveryKit,
  decryptKit,
  encryptKit,
  kitAccounts,
  kitAddresses,
  parseKitFile,
  passphraseIssue,
  unlockKit,
} from '../src/lib/recoveryKit'
import { loadLocalKit, saveLocalKit } from '../src/lib/storage'
import { createReport } from './helpers/chain'

// Minimal localStorage for node (storage.ts reads window.localStorage at call time).
const memory = new Map<string, string>()
;(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
  },
}

const report = createReport()
const { log, record } = report
const PASSPHRASE = 'correct horse battery staple'
const account = '0x000000000000000000000000000000000000acc0' as Address
const keySafe = '0x000000000000000000000000000000000000ce11' as Address

async function main() {
  const keys = createKitKeys()
  const expected = kitAccounts(keys)

  let t = Date.now()
  const kit = await encryptKit(keys, PASSPHRASE, { account, keySafe })
  log(`encryptKit: ${Date.now() - t} ms (scrypt N=2^17, two keystores)`)
  t = Date.now()
  const unlocked = await decryptKit(kit, PASSPHRASE)
  log(`decryptKit: ${Date.now() - t} ms`)
  const addresses = kitAddresses(kit)
  record('K1', unlocked.owner.address === expected.owner.address && unlocked.guardian.address === expected.guardian.address
    && addresses.owner === expected.owner.address && addresses.guardian === expected.guardian.address,
    `round trip ok; public addresses readable without the passphrase (owner ${addresses.owner.slice(0, 10)}…, guardian ${addresses.guardian.slice(0, 10)}…)`)

  let wrongRejected = false
  try {
    await decryptKit(kit, 'not the right passphrase')
  } catch (error) {
    wrongRejected = error instanceof KitPassphraseError
  }
  record('K2', wrongRejected, 'wrong passphrase → KitPassphraseError')

  saveLocalKit(kit)
  const fileText = JSON.stringify(kit, null, 2)
  const stored = [...memory.values()].join('')
  const leaks = [keys.owner, keys.guardian].flatMap((k) => [k.toLowerCase(), k.slice(2).toLowerCase()])
  const clean = leaks.every((secret) => !fileText.toLowerCase().includes(secret) && !stored.toLowerCase().includes(secret))
  record('K3', clean && loadLocalKit() !== null, 'no plaintext key in the file nor in the local copy (sq-kit:v3)')

  const fromLocal = await unlockKit(PASSPHRASE)
  const fromFile = await unlockKit(PASSPHRASE, fileText)
  record('K4', fromLocal.owner.address === expected.owner.address && fromFile.guardian.address === expected.guardian.address,
    'unlockKit(passphrase) reads the local copy; unlockKit(passphrase, fileText) reads a picked file')

  const v3 = parseKitFile(fileText)
  const v1 = parseKitFile(JSON.stringify(createRecoveryKit(keySafe)))
  let garbageRejected = false
  try {
    parseKitFile('{"type":"swissquote-wallet-recovery-kit","version":3}')
  } catch {
    garbageRejected = true
  }
  let v1RefusedForAccount = false
  try {
    await unlockKit(PASSPHRASE, JSON.stringify(createRecoveryKit(keySafe)))
  } catch (error) {
    v1RefusedForAccount = error instanceof Error && /old Recovery Kit/.test(error.message)
  }
  record('K5', v3.version === 3 && v1.version === 1 && garbageRejected && v1RefusedForAccount,
    'v3 parsed; v1 still parsed (legacy recovery) but refused for Account signing; incomplete file rejected')

  const issues = [passphraseIssue('short'), passphraseIssue('123456789012'), passphraseIssue(PASSPHRASE)]
  record('K6', issues[0] !== null && issues[1] !== null && issues[2] === null, `rules: "${issues[0]}" / "${issues[1]}" / ok`)

  const call = tokenTransferCall({ to: keySafe, amount: 1n })
  const signature = await kitSignature(unlocked.owner, account, call, 0n)
  const valid = signature.kind === 'ecdsa' && (await verifyTypedData({ ...accountTypedData(account, call, 0n), address: expected.owner.address, signature: signature.data }))
  record('K7', valid, 'the decrypted owner key produces a valid Account co-signature (kitSignature)')
}

main().then(() => report.finish(), (error) => report.finish(error))
