/**
 * E2E of Swap (PDR-028, ADR-032) on Base Sepolia, in real Chrome with a virtual passkey, with a
 * screenshot of every step at 390×844 (viewport + full page) and 1440×900.
 *
 *  1. Protect a wallet (Kit, 0.50 USDC daily limit) and fund it with 1 USDC from the Swissquote treasury.
 *  2. Swap 0.50 USDC → EURC with Face ID + the Kit (exact approval, at least the minimum, back to the Account).
 *  3. Swap all the EURC back to USDC.
 *  4. Swap 0.20 USDC → ETH (WETH), then all the ETH back to USDC.
 *  5. Send the USDC back to the treasury.
 *
 * Prereqs: `npm run dev`, Google Chrome, a funded demo treasury. About 3 minutes.
 * Run:     node scripts/e2e-swap.mts [outDir]   (default: ./screenshots)
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
  const tabBar = await page.addStyleTag({ content: 'nav.fixed { position: static !important; }' })
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
  const kitPath = `${OUT}/swap-kit.json`
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

/** The large-amount check asks to type the amount: type the one it shows. */
async function confirmLarge(page: Page) {
  const confirm = page.getByLabel('Type the amount to confirm')
  if (await confirm.count()) await confirm.fill((await confirm.getAttribute('placeholder')) ?? '')
}

/** Pick the pair, type the amount (or Max), review, Kit + Face ID, receipt. */
async function swap(page: Page, name: string | null, from: string, to: string, amount: string | 'max') {
  await page.goto(`${APP_URL}/swap`)
  await page.getByLabel('Asset you give').selectOption(from)
  await page.getByLabel('Asset you get').selectOption(to)
  if (amount === 'max') {
    await page.waitForFunction(() => !(document.querySelector('button.token') as HTMLButtonElement | null)?.disabled, null, { timeout: 60_000 })
    await page.getByRole('button', { name: 'Max' }).click()
  } else {
    await page.locator('#swap-amount').fill(amount)
  }
  await page.getByText('At least', { exact: true }).waitFor({ timeout: 60_000 })
  if (name) await both(page, `${name}-details`)
  await page.getByRole('button', { name: 'Review swap' }).click()
  await page.getByText('Protocol contract screened', { exact: false }).waitFor({ timeout: 60_000 })
  await page.getByText('Simulation: these steps would succeed', { exact: false }).waitFor({ timeout: 60_000 })
  await confirmLarge(page)
  if (name) await both(page, `${name}-review`)
  await page.locator('#swap-kit-passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Approve with Kit and biometrics' }).click()
  await page.getByRole('button', { name: 'Swap again' }).waitFor({ timeout: 120_000 })
  const tx = await page.getByRole('link', { name: /View on Basescan/ }).getAttribute('href')
  if (name) await both(page, `${name}-done`)
  return tx
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const failures: string[] = []
try {
  const { relayer: treasury } = (await (await fetch(`${APP_URL}/api/guardian`)).json()) as { relayer: string }
  const P = await newPhone(browser)
  await protect(P)
  await fund(P, '1')
  log('Wallet protected (limit 0.50 USDC/day) and funded with 1 USDC ✓')

  log(`USDC → EURC: 0.50 swapped with Face ID + Kit → ${await swap(P, 'swap-01-eurc', 'USDC', 'EURC', '0.5')} ✓`)
  await P.goto(APP_URL)
  await P.getByText('EURC', { exact: false }).first().waitFor({ timeout: 60_000 })
  await P.waitForTimeout(1500)
  await both(P, 'swap-02-overview')
  log(`EURC → USDC: all back (Max, exact amount confirmed) → ${await swap(P, 'swap-03-back', 'EURC', 'USDC', 'max')} ✓`)
  log(`USDC → ETH: 0.20 swapped → ${await swap(P, 'swap-04-eth', 'USDC', 'ETH', '0.2')} ✓`)
  log(`ETH → USDC: all back → ${await swap(P, null, 'ETH', 'USDC', 'max')} ✓`)
  await P.goto(`${APP_URL}/activity`)
  await P.getByText('Swapped from ETH').first().waitFor({ timeout: 60_000 })
  await both(P, 'swap-05-activity')
  log('Activity shows the swaps (not payments to the pools) ✓')

  // Back to the treasury (Kit route when the balance is above today's limit).
  await P.goto(`${APP_URL}/send`)
  await P.getByLabel('Recipient').fill(treasury)
  await P.getByRole('button', { name: 'Max' }).click()
  await P.getByText(/Needs your Kit:|Face ID alone:/).first().waitFor({ timeout: 60_000 })
  const kit = (await P.getByText('Needs your Kit:', { exact: false }).count()) > 0
  await P.getByRole('button', { name: 'Continue' }).click()
  await P.getByText('Recipient screened', { exact: false }).waitFor({ timeout: 30_000 })
  await confirmLarge(P)
  if (kit) await P.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await P.getByRole('button', { name: kit ? 'Approve with Kit and biometrics' : 'Approve with biometrics' }).click()
  await P.getByText('Sent · live onchain').waitFor({ timeout: 120_000 })
  log('USDC sent back to the treasury ✓')
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} failure(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nAll Swap steps passed. Screenshots in ${OUT}/`)
