/**
 * E2E of Earn (#25, PDR-025, ADR-028) on Base Sepolia, in real Chrome with a virtual passkey, with a
 * screenshot of every step at 390×844 (viewport + full page) and 1440×900.
 *
 *  1. Protect a wallet (Kit, 0.50 USDC daily limit) and fund it with 1 USDC from the Swissquote treasury.
 *  2. Deposit 0.50 USDC to Aave v3 with Face ID + the Kit (exact approval + supply, risks acknowledged).
 *  3. Withdraw the whole position back to the Account.
 *  4. "Demo: try an unlisted dApp": the paymaster refuses to sponsor Uniswap.
 *  5. Send the USDC back to the treasury.
 *
 * Prereqs: `npm run dev`, Google Chrome, a funded demo treasury. About 2 minutes.
 * Run:     node scripts/e2e-earn.mts [outDir]   (default: ./screenshots)
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
  const kitPath = `${OUT}/earn-kit.json`
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

/** Review → acknowledge → Kit → Face ID → done plate. */
async function approve(page: Page, name: string, deposit: boolean) {
  await page.getByText('Protocol contract screened', { exact: false }).waitFor({ timeout: 60_000 })
  await page.getByText('Simulation: these steps would succeed', { exact: false }).waitFor({ timeout: 60_000 })
  await both(page, `${name}-review`)
  await confirmLarge(page)
  if (deposit) await page.getByLabel(/I understand: this is not a bank deposit/).check()
  await page.locator('#earn-kit-passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Approve with Kit and Face ID' }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).waitFor({ timeout: 120_000 })
  const tx = await page.getByRole('link', { name: /View on Basescan/ }).getAttribute('href')
  await both(page, `${name}-done`)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
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

  await P.goto(`${APP_URL}/earn`)
  await P.getByText('a year, variable', { exact: false }).first().waitFor({ timeout: 60_000 })
  await P.waitForTimeout(1500)
  await both(P, 'earn-01-overview')

  const aave = P.locator('section', { has: P.getByRole('heading', { name: 'Aave v3' }) })
  await aave.getByRole('button', { name: 'Deposit', exact: true }).click()
  // Let the panel's scroll into view finish before typing (the capture shows what the phone shows).
  await P.waitForTimeout(900)
  await P.locator('#earn-amount').fill('0.5')
  await both(P, 'earn-02-amount', true)
  await P.getByRole('button', { name: 'Continue' }).click()
  const deposited = await approve(P, 'earn-03-deposit', true)
  log(`Deposited 0.50 USDC to Aave v3 with Face ID + Kit → ${deposited} ✓`)

  await aave.getByRole('button', { name: 'Withdraw', exact: true }).waitFor({ timeout: 60_000 })
  await P.waitForTimeout(1500)
  await both(P, 'earn-04-lent')
  await aave.getByRole('button', { name: 'Withdraw', exact: true }).click()
  await P.getByRole('button', { name: 'Max' }).click()
  await P.getByRole('button', { name: 'Continue' }).click()
  const withdrawn = await approve(P, 'earn-05-withdraw', false)
  log(`Withdrew the whole Aave position back to the Account → ${withdrawn} ✓`)

  await P.getByRole('button', { name: /Demo: try Uniswap/ }).click()
  const verdict = P.getByText(/Not sponsored by Swissquote|Not sent/)
  await verdict.waitFor({ timeout: 90_000 })
  await shot(P, 'earn-06-unlisted', true)
  await desk(P, 'earn-06-unlisted')
  if ((await verdict.textContent())?.startsWith('Not sponsored')) log('Unlisted dApp (Uniswap): Swissquote refused to sponsor it ✓')
  else failures.push(`unlisted demo: ${await P.getByRole('alert').last().textContent()}`)

  // Back to the treasury (Kit route: the balance is above today's limit).
  await P.goto(`${APP_URL}/send`)
  await P.getByLabel('Recipient').fill(treasury)
  await P.getByRole('button', { name: 'Max' }).click()
  await P.getByText(/Needs your Kit:|Face ID alone:/).first().waitFor({ timeout: 60_000 })
  const kit = (await P.getByText('Needs your Kit:', { exact: false }).count()) > 0
  await P.getByRole('button', { name: 'Continue' }).click()
  await P.getByText('Recipient screened', { exact: false }).waitFor({ timeout: 30_000 })
  await confirmLarge(P)
  if (kit) await P.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await P.getByRole('button', { name: kit ? 'Approve with Kit and Face ID' : 'Approve with Face ID' }).click()
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
console.log(`\nAll Earn steps passed. Screenshots in ${OUT}/`)
