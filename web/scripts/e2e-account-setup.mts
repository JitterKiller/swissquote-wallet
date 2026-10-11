/**
 * Acceptance test for issue #10 (and the protect screens of #9), in real Chrome with a virtual
 * passkey, on Base Sepolia:
 *
 *  S1  Protect flow: passphrase → download → a wrong passphrase is refused at the test step →
 *      test passes → daily limit (250 preset) → activate (one sponsored UserOp).
 *  S2  Level 0: readAccount shows owners [Key Safe, Kit owner], threshold 2, the Allowance Module
 *      and the 7-day (demo: 3-minute) eviction module, guardian = Kit guardian key, allowance 250
 *      for the Key Safe.
 *  S3  The wallet stored on the device has account, level and daily limit, and the encrypted Kit copy.
 *  S4  Transitional (ADR-026): the Key Safe keeps the legacy recovery (Kit guardian + Swissquote, 2 of 2).
 *  S5  Level 1 (signed in with Swissquote, MOCK session): guardians Kit + Swissquote, threshold 2.
 *
 * Prereqs: `npm run dev`, Google Chrome. About 2 minutes. Run: npm run e2e:account-setup
 */
import fs from 'node:fs'

import { chromium, type Browser, type Page } from 'playwright-core'
import { parseUnits, type Address } from 'viem'

import { readAccount } from '../src/lib/account'
import { ACCOUNT_RECOVERY_MODULE, ALLOWANCE_MODULE_ADDRESS, EXPLORER_URL, USDC_DECIMALS } from '../src/lib/config'
import { getRecoveryStatus } from '../src/lib/recovery'
import { kitAddresses, parseKitFile, type RecoveryKitV3 } from '../src/lib/recoveryKit'
import { createReport } from './helpers/chain'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const SCREENSHOTS = process.env.SCREENSHOTS
const PASSPHRASE = 'orange glacier violin 42'
const report = createReport()
const { log, record } = report
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.some((y) => same(x, y)))

async function device(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  return page
}

const shot = async (page: Page, name: string) => {
  if (SCREENSHOTS) await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: true })
}

/** Create a wallet and go through the protect flow. Returns the Kit file and the stored wallet. */
async function createAndProtect(page: Page, name: string, limitPreset?: string) {
  await page.goto(`${APP_URL}/wallet/welcome`)
  await page.getByLabel('Your name').fill(name)
  await page.getByRole('button', { name: 'Create wallet with passkey' }).click()
  await page.getByRole('heading', { name: 'Protect your wallet' }).waitFor()
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Create my Recovery Kit' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Recovery Kit' }).click(),
  ])
  const kitPath = await download.path()
  await page.getByRole('button', { name: 'I saved it, continue' }).click()

  await page.getByLabel('Recovery Kit file').setInputFiles(kitPath)
  await page.getByLabel('Kit passphrase', { exact: true }).fill('not the passphrase')
  await page.getByRole('button', { name: 'Test my Kit' }).click()
  const refused = await page
    .getByText('Wrong passphrase. Check it and try again.')
    .waitFor({ timeout: 30_000 })
    .then(() => true, () => false)
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Test my Kit' }).click()
  await page.getByRole('heading', { name: 'Choose your daily limit' }).waitFor()
  if (limitPreset) await page.getByRole('button', { name: new RegExp(`^${limitPreset}`) }).click()
  await shot(page, `account-${name}-limit`)
  await page.getByRole('button', { name: 'Activate protection' }).click()
  await page.getByRole('heading', { name: 'Your wallet is protected' }).waitFor()
  await shot(page, `account-${name}-protected`)

  const parsed = parseKitFile(fs.readFileSync(kitPath, 'utf8'))
  if (parsed.version !== 3) throw new Error('Expected a v3 Kit')
  const stored = await page.evaluate(() => ({
    wallet: JSON.parse(localStorage.getItem('sq-wallet:v1')!),
    kit: JSON.parse(localStorage.getItem('sq-kit:v3') ?? 'null'),
  }))
  return { kit: parsed.kit, refused, stored }
}

async function checkAccount(kit: RecoveryKitV3, level: 0 | 1, limit: bigint, swissquote: Address) {
  const { owner, guardian } = kitAddresses(kit)
  const state = await readAccount(kit.account, { keySafe: kit.keySafe })
  const guardians = level === 1 ? [guardian, swissquote] : [guardian]
  const ok =
    state.deployed &&
    sameSet(state.owners, [kit.keySafe, owner]) &&
    state.threshold === 2 &&
    state.modules.some((m) => same(m, ALLOWANCE_MODULE_ADDRESS)) &&
    !!state.evictionModule &&
    same(state.evictionModule, ACCOUNT_RECOVERY_MODULE[level]) &&
    sameSet(state.guardians, guardians) &&
    state.guardianThreshold === guardians.length &&
    !!state.allowance &&
    same(state.allowance.delegate, kit.keySafe) &&
    state.allowance.amount === limit &&
    state.allowance.remaining === limit
  return { ok, state }
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const { guardian: swissquote } = (await (await fetch(`${APP_URL}/api/guardian`)).json()) as { guardian: Address }

  // Level 0, 250 USDC preset.
  const A = await device(browser)
  const level0 = await createAndProtect(A, 'Alice', '250')
  record('S1', level0.refused, `wrong passphrase refused at the test step, then the flow completed`)
  const limit250 = parseUnits('250', USDC_DECIMALS)
  const a = await checkAccount(level0.kit, 0, limit250, swissquote)
  record(
    'S2',
    a.ok,
    `Account ${EXPLORER_URL}/address/${level0.kit.account} owners=${a.state.owners.length} threshold=${a.state.threshold} modules=${a.state.modules.length} guardians=${a.state.guardians.length} allowance=${a.state.allowance?.amount}`,
  )
  const w = level0.stored.wallet
  record(
    'S3',
    same(w.account ?? '', level0.kit.account) && w.level === 0 && w.dailyLimit === limit250.toString() && same(level0.stored.kit?.account ?? '', level0.kit.account),
    `stored account=${w.account} level=${w.level} dailyLimit=${w.dailyLimit} encrypted Kit copy=${!!level0.stored.kit}`,
  )
  const legacy = await getRecoveryStatus(level0.kit.keySafe)
  record(
    'S4',
    sameSet(legacy.guardians, [kitAddresses(level0.kit).guardian, swissquote]) && legacy.threshold === 2,
    `Key Safe legacy guardians=${legacy.guardians.length} threshold=${legacy.threshold}`,
  )

  // Level 1: signed in with Swissquote before protecting (suggested 500 limit).
  const B = await device(browser)
  await B.goto(`${APP_URL}/wallet/welcome`)
  await B.evaluate(() => localStorage.setItem('sq-session:v1', JSON.stringify({ clientId: 'sq-bob-e2e', displayName: 'Bob E2E' })))
  const level1 = await createAndProtect(B, 'Bob')
  const b = await checkAccount(level1.kit, 1, parseUnits('500', USDC_DECIMALS), swissquote)
  record(
    'S5',
    b.ok && level1.stored.wallet.level === 1,
    `Account ${EXPLORER_URL}/address/${level1.kit.account} guardians=${b.state.guardians.length} (Kit + Swissquote) guardianThreshold=${b.state.guardianThreshold} allowance=${b.state.allowance?.amount}`,
  )
  log('done')
  await browser.close()
  report.finish()
} catch (error) {
  await browser.close()
  report.finish(error)
}
