/**
 * UI review: walks through the app with a virtual passkey and saves
 * screenshots of every screen (desktop light/dark + mobile).
 *
 * Prereqs: `npm run dev`, Google Chrome.
 * Run:     node scripts/ui-screenshots.mts [outDir]   (default: ./screenshots)
 */
import fs from 'node:fs'

import { chromium, type Browser, type Page } from 'playwright-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? 'screenshots'
fs.mkdirSync(OUT, { recursive: true })

async function newPage(browser: Browser, opts: { width: number; height: number; dark?: boolean }) {
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    colorScheme: opts.dark ? 'dark' : 'light',
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(90_000)
  page.on('console', (message) => message.type() === 'error' && console.log(`[browser] ${message.text()}`))
  page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`))
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

const PASSPHRASE = 'orange glacier violin 42'

// Let entrance animations and colour transitions settle before each capture.
const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
}

async function createProtectedWallet(page: Page, prefix: string, dailyLimit?: string) {
  await page.goto(`${APP_URL}/wallet/welcome`)
  await page.getByLabel('Your name').fill('Alice')
  await shot(page, `${prefix}-01-welcome`)
  await page.getByRole('button', { name: 'Create wallet with passkey' }).click()
  await page.getByRole('heading', { name: 'Protect your wallet' }).waitFor()
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(PASSPHRASE)
  await shot(page, `${prefix}-02-protect`)
  await page.getByRole('button', { name: 'Create my Recovery Kit' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Recovery Kit' }).click(),
  ])
  await shot(page, `${prefix}-02b-save-kit`)
  await page.getByRole('button', { name: 'I saved it, continue' }).click()
  await page.getByLabel('Recovery Kit file').setInputFiles(await download.path())
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await shot(page, `${prefix}-02c-test-kit`)
  await page.getByRole('button', { name: 'Test my Kit' }).click()
  await page.getByRole('heading', { name: 'Choose your daily limit' }).waitFor()
  if (dailyLimit) await page.locator('#daily-limit').fill(dailyLimit)
  await shot(page, `${prefix}-02d-daily-limit`)
  await page.getByRole('button', { name: 'Activate protection' }).click()
  await page.getByRole('heading', { name: 'Your wallet is protected' }).waitFor()
  await shot(page, `${prefix}-03-protected`)
  await page.getByRole('link', { name: 'Go to my wallet' }).click()
  await page.getByText('Wallet protected').waitFor()
  await page.waitForTimeout(1500)
}

/** Link to the (MOCK) Swissquote account with Face ID and move `amount` USDC from the demo treasury. */
async function fundFromSwissquote(page: Page, amount: string) {
  await page.goto(`${APP_URL}/wallet/swissquote`)
  await page.getByLabel('Name on your Swissquote account').fill('Alice Meier')
  await page.getByRole('button', { name: 'Sign in with Swissquote' }).click()
  await page.getByRole('button', { name: 'Link with Face ID' }).click()
  // Once linked, /swissquote replaces the link card with the transfer cards.
  await page.locator('#to-wallet').waitFor({ timeout: 60_000 })
  await page.locator('#to-wallet').fill(amount)
  await page.getByRole('button', { name: 'Move to my wallet' }).click()
  await page.getByText(`${amount} USDC moved to your wallet`).waitFor({ timeout: 90_000 })
}

/** One payment through the Send flow; `kit` = above today's limit (passphrase, then Face ID). */
async function pay(page: Page, prefix: string, to: string, amount: string, kit: boolean) {
  await page.goto(`${APP_URL}/wallet/send`)
  await page.getByLabel('Recipient').fill(to)
  await page.locator('#amount').fill(amount)
  // The route note under the amount, not the side card: "Face ID alone:" / "Needs your Kit:".
  await page.getByText(kit ? 'Needs your Kit:' : 'Face ID alone:', { exact: false }).waitFor({ timeout: 60_000 })
  await shot(page, `${prefix}-details`)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByText('Recipient screened', { exact: false }).waitFor({ timeout: 30_000 })
  const confirm = page.getByPlaceholder(amount)
  if (await confirm.count()) await confirm.fill(amount)
  if (kit) await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await shot(page, `${prefix}-review`)
  await page.getByRole('button', { name: kit ? 'Approve with Kit and biometrics' : 'Approve with biometrics' }).click()
  try {
    await page.getByText('Sent · live onchain').waitFor({ timeout: 120_000 })
  } catch (error) {
    await shot(page, `${prefix}-failed`)
    throw error
  }
  await shot(page, `${prefix}-done`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const { relayer: treasury } = (await (await fetch(`${APP_URL}/api/guardian`)).json()) as { relayer: string }

  // Desktop, light: a funded wallet with a 1 USDC limit, so both approval routes show; the
  // payments go back to the demo treasury.
  const desktop = await newPage(browser, { width: 1440, height: 900 })
  await createProtectedWallet(desktop, 'desktop', '0.5')
  await fundFromSwissquote(desktop, '1')
  await desktop.goto(`${APP_URL}/wallet`)
  // Loaded: the allowance cells' caption and the custody card both come from the chain.
  await desktop.getByText('USDC left', { exact: false }).waitFor({ timeout: 60_000 })
  await desktop.getByText('Wallet protected').waitFor()
  await shot(desktop, 'desktop-04-overview')
  await pay(desktop, 'desktop-05-send-kit', treasury, '0.8', true)
  await pay(desktop, 'desktop-05-send-limit', treasury, '0.2', false)
  await desktop.goto(`${APP_URL}/wallet`)
  await desktop.getByText('USDC left', { exact: false }).waitFor({ timeout: 60_000 })
  await desktop.waitForTimeout(2000)
  await shot(desktop, 'desktop-04b-overview-after')
  await desktop.goto(`${APP_URL}/wallet/receive`)
  await shot(desktop, 'desktop-06-receive')
  await desktop.goto(`${APP_URL}/wallet/activity`)
  await desktop.waitForTimeout(1500)
  await shot(desktop, 'desktop-07-activity')
  await desktop.goto(`${APP_URL}/wallet/security`)
  await desktop.getByText('Swissquote Guardian').waitFor()
  await shot(desktop, 'desktop-08-security')
  // Finished pages stop polling the public RPC (it rate-limits per IP).
  await desktop.context().close()

  // Desktop, dark: overview with the same kind of wallet.
  const dark = await newPage(browser, { width: 1440, height: 900, dark: true })
  await createProtectedWallet(dark, 'dark')
  await shot(dark, 'dark-04-overview')
  await dark.context().close()

  // Recovery screen on a fresh device.
  const fresh = await newPage(browser, { width: 1440, height: 900 })
  await fresh.goto(`${APP_URL}/wallet/recover`)
  await fresh.getByRole('heading', { name: 'Recover your wallet' }).waitFor()
  await shot(fresh, 'desktop-09-recover')
  await fresh.context().close()

  // Mobile.
  const mobile = await newPage(browser, { width: 390, height: 844 })
  await createProtectedWallet(mobile, 'mobile')
  await shot(mobile, 'mobile-04-overview')
  await mobile.goto(`${APP_URL}/wallet/send`)
  await mobile.getByLabel('Recipient').fill(treasury)
  await mobile.locator('#amount').fill('1')
  // The wallet is not funded: wait until the balance and today's limit are read.
  await mobile.getByText('More than your balance', { exact: false }).waitFor({ timeout: 60_000 })
  await shot(mobile, 'mobile-05-send')

  console.log(`Screenshots saved to ${OUT}/`)
} finally {
  await browser.close()
}
