/**
 * E2E of the level 1 upgrade (#21, PDR-015, PDR-018, ADR-036) on Base Sepolia, in real Chrome with a
 * virtual passkey, with a screenshot of every step at 390×844 (viewport + full page) and 1440×900.
 *
 *  1. Protect a wallet without a Swissquote session: level 0 (lock-out after 7 days with the Kit alone).
 *  2. On the Security page, "Upgrade to level 1" says it is for linked clients and links to /swissquote.
 *  3. Sign in (MOCK) and link the wallet with Face ID; /swissquote shows "Your Account is at level 0".
 *  4. "Shorten the lock-out to 3 days" opens the panel: worst case 4.00 → 2.00, what Swissquote can and
 *     never can do, the sealed review; Face ID + the Kit add Swissquote's guardian (threshold 2).
 *  5. The Security page and /swissquote read level 1.
 *
 * Prereqs: `npm run dev`, Google Chrome. About 1 minute. No funds needed.
 * Run:     node scripts/e2e-level.mts [outDir]   (default: ./screenshots)
 */
import fs from 'node:fs'

import { chromium, type Browser, type Page } from 'playwright-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? 'screenshots'
fs.mkdirSync(OUT, { recursive: true })
const PASSPHRASE = 'orange glacier violin 42'
const PHONE = { width: 390, height: 844 }
const start = Date.now()
const log = (message: string) => console.log(`[${String(Math.round((Date.now() - start) / 1000)).padStart(3)}s] ${message}`)

async function newPhone(browser: Browser) {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1 })
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = 'nextjs-portal { display: none !important; }'
      document.head.appendChild(style)
    })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(90_000)
  page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`))
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })
  return page
}

const shot = async (page: Page, name: string, keepScroll = false) => {
  await page.waitForTimeout(450)
  if (!keepScroll) await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  const tabBar = await page.addStyleTag({ content: 'nav.fixed, header.sticky { position: static !important; }' })
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true })
  await tabBar.evaluate((node) => (node as Element).remove())
}
const desk = async (page: Page, name: string) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${name}-desktop.png`, fullPage: true })
  await page.setViewportSize(PHONE)
  await page.waitForTimeout(200)
}
const both = async (page: Page, name: string, keepScroll = false) => {
  await shot(page, name, keepScroll)
  await desk(page, name)
}

async function protect(page: Page) {
  await page.goto(`${APP_URL}/wallet/welcome`)
  await page.getByLabel('Your name').fill('Alice')
  await page.getByRole('button', { name: 'Create wallet with passkey' }).click()
  await page.getByRole('heading', { name: 'Protect your wallet' }).waitFor()
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Create my Recovery Kit' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Recovery Kit' }).click()])
  const kitPath = `${OUT}/level-kit.json`
  await download.saveAs(kitPath)
  await page.getByRole('button', { name: 'I saved it, continue' }).click()
  await page.getByLabel('Recovery Kit file').setInputFiles(kitPath)
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Test my Kit' }).click()
  await page.getByRole('heading', { name: 'Choose your daily limit' }).waitFor()
  await page.locator('#daily-limit').fill('0.5')
  await page.getByRole('button', { name: 'Activate protection' }).click()
  await page.getByRole('heading', { name: 'Your wallet is protected' }).waitFor()
  await page.getByRole('link', { name: 'Go to my wallet' }).click()
  await page.getByText('Wallet protected').waitFor()
}


const browser = await chromium.launch({ channel: 'chrome', headless: true })
const failures: string[] = []
let current: Page | null = null
try {
  const P = await newPhone(browser)
  current = P
  await protect(P)
  log('Wallet protected at level 0 (no Swissquote session) ✓')

  await P.goto(`${APP_URL}/wallet/security`)
  await P.getByRole('button', { name: 'Upgrade to level 1' }).click()
  await P.getByText('Level 1 is for Swissquote clients who linked this wallet').waitFor({ timeout: 30_000 })
  await P.waitForTimeout(600)
  await P.screenshot({ path: `${OUT}/level-01-gate.png` })
  log('Not linked: the panel says level 1 is for linked clients ✓')

  await P.getByRole('link', { name: 'Link your Swissquote account' }).click()
  await P.getByLabel('Name on your Swissquote account').fill('Alice Meier')
  await P.getByRole('button', { name: 'Sign in with Swissquote' }).click()
  await P.getByRole('button', { name: 'Link with Face ID' }).click()
  await P.getByText('Your Account is at level 0').waitFor({ timeout: 60_000 })
  await P.getByText('Your Account is at level 0').scrollIntoViewIfNeeded()
  await both(P, 'level-02-callout', true)
  log('Linked with Face ID: /swissquote offers the 3-day lock-out ✓')

  await P.getByRole('link', { name: 'Shorten the lock-out to 3 days' }).click()
  await P.getByText('With level 1, Swissquote').waitFor({ timeout: 30_000 })
  await P.getByText(/Locked out after 3 days instead of 7/).waitFor()
  await P.waitForTimeout(700)
  await P.screenshot({ path: `${OUT}/level-03-panel.png` })
  await P.locator('#level-kit-passphrase').fill(PASSPHRASE)
  await both(P, 'level-03-review', true)
  await P.getByRole('button', { name: 'Approve with Kit and biometrics' }).click()
  await P.getByText('Level 1 · onchain').waitFor({ timeout: 120_000 })
  await P.waitForTimeout(900)
  const tx = await P.getByRole('link', { name: /View on Basescan/ }).getAttribute('href')
  await both(P, 'level-04-done', true)
  log(`Upgraded with Face ID + Kit: Swissquote guards the lock-out → ${tx} ✓`)

  await P.getByRole('button', { name: 'Done', exact: true }).click()
  await P.getByText('Level 1: your Kit and a Swissquote identity check.').waitFor({ timeout: 60_000 })
  await P.getByText('Swissquote checks ID').waitFor({ timeout: 30_000 })
  await both(P, 'level-05-security')
  log('Security page reads level 1 (3 days, Kit + identity check) ✓')

  await P.goto(`${APP_URL}/wallet/swissquote`)
  await P.getByText('Level 1: lock-out after 3 days').waitFor({ timeout: 60_000 })
  await P.getByText('Level 1: lock-out after 3 days').scrollIntoViewIfNeeded()
  await P.waitForTimeout(400)
  await P.screenshot({ path: `${OUT}/level-06-swissquote.png` })
  log('/swissquote reads level 1 ✓')
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
  // The page as it was when the step failed.
  await current?.screenshot({ path: `${OUT}/level-failure.png`, fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} failure(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nAll level steps passed. Screenshots in ${OUT}/`)
