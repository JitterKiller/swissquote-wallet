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

async function createProtectedWallet(page: Page, prefix: string) {
  await page.goto(`${APP_URL}/welcome`)
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
  await shot(page, `${prefix}-02d-daily-limit`)
  await page.getByRole('button', { name: 'Activate protection' }).click()
  await page.getByRole('heading', { name: 'Your wallet is protected' }).waitFor()
  await shot(page, `${prefix}-03-protected`)
  await page.getByRole('link', { name: 'Go to my wallet' }).click()
  await page.getByText('Wallet protected').waitFor()
  await page.waitForTimeout(1500)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  // Desktop, light.
  const desktop = await newPage(browser, { width: 1440, height: 900 })
  await createProtectedWallet(desktop, 'desktop')
  await shot(desktop, 'desktop-04-overview')
  await desktop.goto(`${APP_URL}/send`)
  await desktop.getByLabel('Recipient').fill('0x000000000000000000000000000000000000dEaD')
  await shot(desktop, 'desktop-05-send')
  await desktop.goto(`${APP_URL}/receive`)
  await shot(desktop, 'desktop-06-receive')
  await desktop.goto(`${APP_URL}/activity`)
  await desktop.waitForTimeout(1500)
  await shot(desktop, 'desktop-07-activity')
  await desktop.goto(`${APP_URL}/security`)
  await desktop.getByText('Swissquote Guardian').waitFor()
  await shot(desktop, 'desktop-08-security')

  // Desktop, dark: overview with the same kind of wallet.
  const dark = await newPage(browser, { width: 1440, height: 900, dark: true })
  await createProtectedWallet(dark, 'dark')
  await shot(dark, 'dark-04-overview')

  // Recovery screen on a fresh device.
  const fresh = await newPage(browser, { width: 1440, height: 900 })
  await fresh.goto(`${APP_URL}/recover`)
  await fresh.getByRole('heading', { name: 'Recover your wallet' }).waitFor()
  await shot(fresh, 'desktop-09-recover')

  // Mobile.
  const mobile = await newPage(browser, { width: 390, height: 844 })
  await createProtectedWallet(mobile, 'mobile')
  await shot(mobile, 'mobile-04-overview')
  await mobile.goto(`${APP_URL}/send`)
  await shot(mobile, 'mobile-05-send')

  console.log(`Screenshots saved to ${OUT}/`)
} finally {
  await browser.close()
}
