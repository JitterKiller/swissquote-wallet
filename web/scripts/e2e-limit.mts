/**
 * E2E of the daily limit change (#13, PDR-020, ADR-035) on Base Sepolia, in real Chrome with a virtual
 * passkey, with a screenshot of every step at 390×844 (viewport + full page) and 1440×900.
 *
 *  1. Protect a wallet (Kit, 0.50 USDC daily limit). A limit change is a sponsored security operation.
 *  2. From the Overview's Face ID meter, "Change" opens the panel on the Security page.
 *  3. Raise the limit to 1.00 USDC with Face ID + the Kit; the worst case shows 4.00 → 8.00 before signing.
 *  4. Lower it to 0.25 USDC, again with both factors. The Overview's meter reads the new limit.
 *  5. The panel's states: 0, above 1,000,000, a wrong passphrase, a new limit below today's spending
 *     (after a 0.10 Face ID payment, funded from and sent back to the treasury), no local Kit.
 *
 * Prereqs: `npm run dev`, Google Chrome, a funded demo treasury (0.10 USDC, returned). About 2 minutes.
 * Run:     node scripts/e2e-limit.mts [outDir]   (default: ./screenshots)
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
  await page.goto(`${APP_URL}/welcome`)
  await page.getByLabel('Your name').fill('Alice')
  await page.getByRole('button', { name: 'Create wallet with passkey' }).click()
  await page.getByRole('heading', { name: 'Protect your wallet' }).waitFor()
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Create my Recovery Kit' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Recovery Kit' }).click()])
  const kitPath = `${OUT}/limit-kit.json`
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

async function fund(page: Page, amount: string) {
  await page.goto(`${APP_URL}/swissquote`)
  await page.getByLabel('Name on your Swissquote account').fill('Alice Meier')
  await page.getByRole('button', { name: 'Sign in with Swissquote' }).click()
  await page.getByRole('button', { name: 'Link with Face ID' }).click()
  await page.locator('#to-wallet').waitFor({ timeout: 60_000 })
  await page.locator('#to-wallet').fill(amount)
  await page.getByRole('button', { name: 'Move to my wallet' }).click()
  await page.getByText(`${amount} USDC moved to your wallet`).waitFor({ timeout: 90_000 })
}

/** The panel's top in the phone viewport: the field, the presets and the worst case before → after. */
async function panelTop(page: Page, name: string) {
  await page.locator('#limit-new').evaluate((el) => el.closest('section')?.scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

/** Open the panel, type the new limit, check the worst case before → after, approve with the Kit and Face ID. */
async function changeLimit(page: Page, name: string, limit: string, change: RegExp) {
  if (!(await page.locator('#limit-new').count())) await page.getByRole('button', { name: 'Change', exact: true }).click()
  await page.locator('#limit-new').fill(limit)
  await page.getByText(change).first().waitFor({ timeout: 30_000 })
  await panelTop(page, `${name}-field`)
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await both(page, name, true)
  await page.getByRole('button', { name: 'Approve with Kit and biometrics' }).click()
  await page.getByText('Limit changed · onchain').waitFor({ timeout: 120_000 })
  await page.waitForTimeout(900) // the receipt scrolls into view
  const tx = await page.getByRole('link', { name: /View on Basescan/ }).getAttribute('href')
  await both(page, `${name}-done`, true)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  return tx
}

/** A state of the panel, with its message in view. */
async function panelState(page: Page, name: string, limit: string, message: RegExp) {
  if (!(await page.locator('#limit-new').count())) await page.getByRole('button', { name: 'Change', exact: true }).click()
  await page.locator('#limit-new').fill(limit)
  await page.getByText(message).first().waitFor({ timeout: 30_000 })
  await panelTop(page, name)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const failures: string[] = []
try {
  const { relayer: treasury } = (await (await fetch(`${APP_URL}/api/guardian`)).json()) as { relayer: string }
  const P = await newPhone(browser)
  await protect(P)
  log('Wallet protected (limit 0.50 USDC/day) ✓')

  // The Overview's meter links to the panel.
  await P.getByRole('link', { name: 'Change', exact: true }).click()
  await P.locator('#limit-new').waitFor({ timeout: 30_000 })
  await P.getByText('That is your current limit', { exact: false }).waitFor()
  await both(P, 'limit-01-open', true)
  log('"Change" on the Overview opens the panel on the Security page ✓')

  log(`Raised to 1.00 with Face ID + Kit → ${await changeLimit(P, 'limit-02-raise', '1', /more than now/)} ✓`)
  await P.getByText(/^1\.00$/).first().waitFor({ timeout: 60_000 })
  log(`Lowered to 0.25 with Face ID + Kit → ${await changeLimit(P, 'limit-03-lower', '0.25', /less than now/)} ✓`)
  await P.goto(APP_URL)
  await P.getByText(/of\s*0\.25/).first().waitFor({ timeout: 60_000 })
  await both(P, 'limit-04-overview')
  log('Security page and Overview meter read the new limit ✓')

  // States of the panel.
  await P.goto(`${APP_URL}/security?change=limit`)
  await P.locator('#limit-new').waitFor({ timeout: 30_000 })
  await panelState(P, 'limit-05-zero', '0', /Choose more than 0/)
  await panelState(P, 'limit-06-over-max', '2000000', /Choose at most 1,000,000 USDC/)
  await P.locator('#limit-new').fill('0.3')
  await P.getByLabel('Kit passphrase', { exact: true }).fill('not my passphrase')
  await P.getByRole('button', { name: 'Approve with Kit and biometrics' }).click()
  await P.getByText('Wrong Kit passphrase', { exact: false }).waitFor({ timeout: 60_000 })
  await P.waitForTimeout(300)
  await P.screenshot({ path: `${OUT}/limit-07-wrong-passphrase.png` })
  log('Panel states: 0, above the maximum, wrong passphrase ✓')

  // Spend 0.10 with Face ID alone, then a new limit below it.
  await fund(P, '0.1')
  await P.goto(`${APP_URL}/send`)
  await P.getByLabel('Recipient').fill(treasury)
  await P.locator('#amount').fill('0.1')
  await P.getByText('Face ID alone:', { exact: false }).first().waitFor({ timeout: 60_000 })
  await P.getByRole('button', { name: 'Continue' }).click()
  await P.getByText('Recipient screened', { exact: false }).waitFor({ timeout: 30_000 })
  const confirm = P.getByLabel('Type the amount to confirm')
  if (await confirm.count()) await confirm.fill((await confirm.getAttribute('placeholder')) ?? '')
  await P.getByRole('button', { name: 'Approve with biometrics' }).click()
  await P.getByText('Sent · live onchain').waitFor({ timeout: 120_000 })
  await P.goto(`${APP_URL}/security?change=limit`)
  await P.locator('#limit-new').waitFor({ timeout: 30_000 })
  await P.getByText(/0\.10\s*spent today/).first().waitFor({ timeout: 60_000 })
  await panelState(P, 'limit-08-below-spent', '0.05', /can’t spend more until the reset/)
  log('0.10 spent with Face ID (back to the treasury); a lower limit says Face ID is done for today ✓')

  // No local Kit: the panel asks for the file.
  await P.evaluate(() => localStorage.removeItem('sq-kit:v3'))
  await P.goto(`${APP_URL}/security?change=limit`)
  await P.locator('#limit-new').waitFor({ timeout: 30_000 })
  await P.locator('#limit-new').fill('0.3')
  await P.getByText('Choose your Kit file').waitFor({ timeout: 30_000 })
  await P.getByText('Choose your Kit file').scrollIntoViewIfNeeded()
  await P.waitForTimeout(300)
  await P.screenshot({ path: `${OUT}/limit-09-no-kit.png` })
  log('Without a local Kit, the panel asks for the file ✓')
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} failure(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nAll limit steps passed. Screenshots in ${OUT}/`)
