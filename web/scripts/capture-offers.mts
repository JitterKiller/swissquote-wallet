/**
 * Visual check of the Offers page (#22, ADR-039) in real Chrome with a virtual passkey. Captures
 * /offers at 390×844 (viewport and full page) and at 1440×900 (full page) into `offers-*.png`:
 *
 *  1. Free: a wallet protected at level 0 (onchain, sponsored), no Swissquote session.
 *  2. Client at level 0: after the MOCK sign-in as Alice Meier and "Link with Face ID".
 *  3. Client at level 1: after "Shorten the lock-out to 3 days" (Face ID + the Kit, onchain).
 *  4. With --send: 1 USDC from the demo treasury, sent back above the daily limit with the Kit;
 *     Send's receipt shows the line to Offers.
 *  5. Premium after the MOCK subscribe, then after the MOCK key order.
 *
 * Alice's MOCK subscription is ended before and after the run.
 *
 * Prereqs: `npm run dev`, Google Chrome. About 2 minutes, 3 with --send. No funds needed without --send.
 * Run:     node scripts/capture-offers.mts [outDir] [--send]   (default: ./screenshots)
 */
import fs from 'node:fs'

import { chromium, type Browser, type Page } from 'playwright-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const args = process.argv.slice(2)
const SEND = args.includes('--send')
const OUT = args.find((arg) => !arg.startsWith('--')) ?? 'screenshots'
fs.mkdirSync(OUT, { recursive: true })
const PASSPHRASE = 'orange glacier violin 42'
const CLIENT = 'Alice Meier'
const CLIENT_ID = 'sq-alice-meier' // mockSignIn's id for that name (lib/session.ts)
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

/** The phone viewport, the phone full page (bars static) and the desktop full page. */
async function capture(page: Page, name: string) {
  await page.waitForTimeout(500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/offers-${name}.png` })
  const bars = await page.addStyleTag({ content: 'nav.fixed, header.sticky { position: static !important; }' })
  await page.screenshot({ path: `${OUT}/offers-${name}-full.png`, fullPage: true })
  await bars.evaluate((node) => (node as Element).remove())
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/offers-${name}-desktop.png`, fullPage: true })
  await page.setViewportSize(PHONE)
  await page.waitForTimeout(250)
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
  await page.getByRole('button', { name: 'I saved it, continue' }).click()
  await page.getByLabel('Recovery Kit file').setInputFiles(await download.path())
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Test my Kit' }).click()
  await page.getByRole('heading', { name: 'Choose your daily limit' }).waitFor()
  await page.locator('#daily-limit').fill('0.5')
  await page.getByRole('button', { name: 'Activate protection' }).click()
  await page.getByRole('heading', { name: 'Your wallet is protected' }).waitFor()
  await page.getByRole('link', { name: 'Go to my wallet' }).click()
  await page.getByText('Wallet protected').waitFor()
}

/** Pages stay alive hidden (Next 16 Activity): only visible matches count. */
const visible = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first()

async function openOffers(page: Page, offer: string, worstCase: string) {
  await page.goto(`${APP_URL}/offers`)
  await page.getByRole('heading', { name: `Your offer: ${offer}` }).waitFor({ timeout: 60_000 })
  await visible(page, worstCase).waitFor({ timeout: 60_000 }) // the worst case, from the daily limit read onchain
}

const endPremium = () =>
  fetch(`${APP_URL}/api/offers`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, action: 'end' }),
  })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const failures: string[] = []
let current: Page | null = null
try {
  await endPremium()
  const P = await newPhone(browser)
  current = P
  await protect(P)
  log('Wallet protected at level 0 ✓')

  await openOffers(P, 'Free', '4.00 USDC')
  await capture(P, 'free')
  await P.getByRole('tab', { name: 'Premium' }).click()
  await P.waitForTimeout(300)
  await P.screenshot({ path: `${OUT}/offers-free-tab-premium.png` })
  log('Free: captured, and the Premium tab on the phone ✓')

  await P.goto(`${APP_URL}/swissquote`)
  await P.getByLabel('Name on your Swissquote account').fill(CLIENT)
  await P.getByRole('button', { name: 'Sign in with Swissquote' }).click()
  await P.getByRole('button', { name: 'Link with Face ID' }).click()
  await P.getByText('Your Account is at level 0').waitFor({ timeout: 60_000 })
  await openOffers(P, 'Client', '2.00 USDC')
  await capture(P, 'client-level0')
  log('Linked: Client at level 0 ✓')

  // The header's next step: the level 1 upgrade on the Security page (ADR-036).
  try {
    await P.getByRole('link', { name: 'Shorten the lock-out to 3 days' }).click()
    await P.getByText('With level 1, Swissquote').waitFor({ timeout: 30_000 })
    await P.locator('#level-kit-passphrase').fill(PASSPHRASE)
    await P.getByRole('button', { name: 'Approve with Kit and biometrics' }).click()
    await P.getByText('Level 1 · onchain').waitFor({ timeout: 120_000 })
    await openOffers(P, 'Client', '2.00 USDC')
    await P.getByRole('button', { name: 'Subscribe to Premium' }).waitFor({ timeout: 60_000 })
    await capture(P, 'client')
    log('Client at level 1 ✓')
  } catch (error) {
    failures.push(`level 1 upgrade: ${error instanceof Error ? error.message.split('\n')[0] : error}`)
    await P.screenshot({ path: `${OUT}/offers-failure-level.png`, fullPage: true }).catch(() => {})
  }

  if (SEND) {
    try {
      const { relayer: treasury } = (await (await fetch(`${APP_URL}/api/guardian`)).json()) as { relayer: string }
      await P.goto(`${APP_URL}/swissquote`)
      await P.locator('#to-wallet').waitFor({ timeout: 60_000 })
      await P.locator('#to-wallet').fill('1')
      await P.getByRole('button', { name: 'Move to my wallet' }).click()
      await P.getByText('1 USDC moved to your wallet').waitFor({ timeout: 90_000 })
      // Back to the treasury, above the 0.50 limit: Face ID + the Kit.
      await P.goto(`${APP_URL}/send`)
      await P.getByLabel('Recipient').fill(treasury)
      await P.locator('#amount').fill('1')
      await P.getByText('Needs your Kit:', { exact: false }).waitFor({ timeout: 60_000 })
      await P.getByRole('button', { name: 'Continue' }).click()
      await P.getByText('Recipient screened', { exact: false }).waitFor({ timeout: 30_000 })
      const confirm = P.getByPlaceholder('1.00')
      if (await confirm.count()) await confirm.fill('1.00')
      await P.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
      await P.getByRole('button', { name: 'Approve with Kit and biometrics' }).click()
      await P.getByText('Sent · live onchain').waitFor({ timeout: 120_000 })
      // The first payment that needed the Kit on this device: the line shows once (ADR-039).
      await P.getByText('a tap on a security key instead of your passphrase', { exact: false }).waitFor({ timeout: 30_000 })
      await P.waitForTimeout(500)
      const bars = await P.addStyleTag({ content: 'nav.fixed, header.sticky { position: static !important; }' })
      await P.screenshot({ path: `${OUT}/offers-send-hint.png`, fullPage: true })
      await bars.evaluate((node) => (node as Element).remove())
      await P.setViewportSize({ width: 1440, height: 900 })
      await P.waitForTimeout(500)
      await P.screenshot({ path: `${OUT}/offers-send-hint-desktop.png`, fullPage: true })
      await P.setViewportSize(PHONE)
      log("Send's receipt after a Kit payment shows the line to Offers ✓")
    } catch (error) {
      failures.push(`send: ${error instanceof Error ? error.message.split('\n')[0] : error}`)
      await P.screenshot({ path: `${OUT}/offers-failure-send.png`, fullPage: true }).catch(() => {})
    }
  }

  await openOffers(P, 'Client', '2.00 USDC')
  await P.getByRole('button', { name: 'Subscribe to Premium' }).click()
  await P.getByRole('heading', { name: 'Your offer: Premium' }).waitFor({ timeout: 30_000 })
  await capture(P, 'premium')
  log('Premium after the MOCK subscribe ✓')

  await P.getByRole('button', { name: 'Order my security key' }).click()
  await P.getByText('Your security key was ordered', { exact: false }).waitFor({ timeout: 30_000 })
  await capture(P, 'premium-key')
  log('Premium with the MOCK key order ✓')
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
  await current?.screenshot({ path: `${OUT}/offers-failure.png`, fullPage: true }).catch(() => {})
} finally {
  await endPremium().catch(() => {})
  await browser.close()
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} failure(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nOffers captured in ${OUT}/offers-*.png`)
