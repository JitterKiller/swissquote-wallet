/**
 * E2E of the lost or stolen phone flow (#15, #16, PDR-018, PDR-021, ADR-019) on two phones, with
 * virtual passkeys in real Chrome, on Base Sepolia. Saves a screenshot of every step.
 *
 *  1. Old phone (A): create and protect a wallet (Kit + 0.50 USDC daily limit), fund it with 1 USDC.
 *  2. New phone (B): "Phone lost or stolen?" → Kit file + passphrase → Face ID → start the lock-out.
 *  3. A: the red alert shows the countdown. "Demo: try with Face ID only" is refused by the Account;
 *     Kit + Face ID stop the lock-out, and B sees it stopped.
 *  4. B starts again, waits for the delay (3 minutes on testnet), takes over with Kit + Face ID.
 *  5. A shows "This phone was locked out"; B spends within the daily limit.
 *  6. A linked client (level 1) on a third phone: the MOCK identity check and the 3-day terms.
 *
 * Every phone screen is saved twice: the first viewport (390×844) and the full page (fixed tab bar made
 * static). New-phone steps and the old phone's alert are also saved at 1440×900 (`-desktop`).
 *
 * Prereqs: `npm run dev`, Google Chrome, a funded demo treasury. About 6 minutes.
 * Run:     node scripts/e2e-eviction.mts [outDir]   (default: ./screenshots)
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
  // The Next dev indicator is not part of the product.
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

/** First viewport (or, with `keepScroll`, where the user is), plus the full page with the fixed tab bar put back in the flow. */
const shot = async (page: Page, name: string, keepScroll = false) => {
  await page.waitForTimeout(450)
  // The first viewport is judged from the top of the document.
  if (!keepScroll) await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  const tabBar = await page.addStyleTag({ content: 'nav.fixed { position: static !important; }' })
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true })
  await tabBar.evaluate((node) => (node as Element).remove())
}

/** The same screen on a 1440×900 laptop. */
const desk = async (page: Page, name: string) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${name}-desktop.png` })
  await page.setViewportSize(PHONE)
  await page.waitForTimeout(200)
}

const both = async (page: Page, name: string, keepScroll = false) => {
  await shot(page, name, keepScroll)
  await desk(page, name)
}

/** Create and protect a wallet; returns the downloaded Kit file path. A linked client protects at level 1. */
async function protect(page: Page, kitName = 'eviction-kit', linked = false) {
  await page.goto(`${APP_URL}/welcome`)
  await page.getByLabel('Your name').fill('Alice')
  await page.getByRole('button', { name: 'Create wallet with passkey' }).click()
  await page.getByRole('heading', { name: 'Protect your wallet' }).waitFor()
  if (linked) {
    // MOCK Swissquote session before protecting: the Account gets the Swissquote guardian (level 1).
    await page.goto(`${APP_URL}/swissquote`)
    await page.getByLabel('Name on your Swissquote account').fill('Alice Meier')
    await page.getByRole('button', { name: 'Sign in with Swissquote' }).click()
    await page.getByRole('button', { name: 'Link with Face ID' }).waitFor()
    await page.goto(`${APP_URL}/welcome/protect`)
    await page.getByRole('heading', { name: 'Protect your wallet' }).waitFor()
  }
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Create my Recovery Kit' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download Recovery Kit' }).click()])
  const kitPath = `${OUT}/${kitName}.json`
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
  return kitPath
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

/** New phone: open the Kit; the first time also creates this phone's key. */
async function openKit(page: Page, kitPath: string, firstTime: boolean) {
  await page.getByLabel('Recovery Kit file').setInputFiles(kitPath)
  await page.locator('#lost-kit-passphrase').fill(PASSPHRASE)
  if (firstTime) await both(page, 'lost-01-kit')
  await page.getByRole('button', { name: 'Open my Kit' }).click()
  if (!firstTime) return
  await page.locator('#lost-name').waitFor()
  await page.locator('#lost-name').fill('Alice')
  await both(page, 'lost-02-passkey')
  await page.getByRole('button', { name: 'Create my key with Face ID' }).click()
}

async function startLockOut(page: Page, capture: boolean) {
  await page.getByRole('button', { name: 'Start the lock-out' }).waitFor()
  if (capture) await both(page, 'lost-03-start')
  await page.getByRole('button', { name: 'Start the lock-out' }).click()
  await page.getByText('until the old phone is locked out').waitFor({ timeout: 90_000 })
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const failures: string[] = []
try {
  const { relayer: treasury } = (await (await fetch(`${APP_URL}/api/guardian`)).json()) as { relayer: string }

  // 1. Old phone.
  const A = await newPhone(browser)
  const kitPath = await protect(A)
  await fund(A, '1')
  await A.goto(APP_URL)
  await A.getByText('USDC left', { exact: false }).waitFor({ timeout: 60_000 })
  log('Old phone: wallet protected (limit 0.50 USDC/day) and funded with 1 USDC ✓')

  // 2. New phone starts the lock-out.
  const B = await newPhone(browser)
  await B.goto(`${APP_URL}/welcome`)
  await B.getByRole('link', { name: 'Phone lost or stolen?' }).click()
  await openKit(B, kitPath, true)
  await startLockOut(B, true)
  await both(B, 'lost-04-pending')
  log('New phone: lock-out started onchain, countdown running ✓')

  // 3. Old phone: alert, the thief's attempt is refused, the owner stops it with Kit + Face ID.
  await A.reload()
  await A.getByText('Someone asked to lock this phone out').waitFor({ timeout: 60_000 })
  await both(A, 'old-01-alert')
  await A.getByRole('button', { name: 'This wasn’t me' }).click()
  await both(A, 'old-02-stop')
  await A.getByRole('button', { name: 'Demo: try with Face ID only' }).click()
  const outcome = A.getByText(/Refused by your Account|Not sent|Unexpected/)
  await outcome.waitFor({ timeout: 90_000 })
  const verdict = (await outcome.textContent()) ?? ''
  await both(A, 'old-03-thief-refused', true)
  if (verdict.startsWith('Refused')) log('Old phone: Face ID alone refused by the Account ✓')
  else failures.push(`thief attempt: ${verdict} — ${await A.getByRole('alert').last().textContent()}`)
  await A.locator('#stop-kit-passphrase').fill(PASSPHRASE)
  await A.getByRole('button', { name: 'Stop it with Kit and Face ID' }).click()
  await A.getByText('Someone asked to lock this phone out').waitFor({ state: 'detached', timeout: 120_000 })
  log('Old phone: lock-out stopped with Kit + Face ID ✓')
  await B.getByText('The lock-out was stopped').waitFor({ timeout: 60_000 })
  await both(B, 'lost-05-stopped')
  log('New phone: sees the lock-out stopped ✓')

  // 4. New phone starts again and takes over after the delay.
  await B.getByRole('button', { name: 'Start again' }).click()
  await startLockOut(B, false)
  log('New phone: lock-out started again, waiting for the delay…')
  await A.reload()
  await A.getByText('Someone asked to lock this phone out').waitFor({ timeout: 60_000 })
  await B.getByRole('button', { name: 'Take over', exact: true }).waitFor({ timeout: 300_000 })
  await B.getByRole('button', { name: 'Take over', exact: true }).click()
  await B.getByRole('button', { name: 'Take over with Kit and Face ID' }).waitFor()
  await both(B, 'lost-06-takeover')
  await B.getByRole('button', { name: 'Take over with Kit and Face ID' }).click()
  try {
    await B.getByText('This device now holds your Account').waitFor({ timeout: 180_000 })
  } catch (error) {
    await shot(B, 'lost-06b-takeover-failed')
    console.log(`Takeover screen: ${(await B.getByRole('alert').allTextContents()).join(' | ')}`)
    throw error
  }
  await both(B, 'lost-07-done')
  log('New phone: old phone removed, daily limit moved to this phone ✓')

  // 5. Old phone locked out; the new phone spends within the limit.
  await A.reload()
  await A.getByText('This phone was locked out').waitFor({ timeout: 90_000 })
  await both(A, 'old-04-locked-out')
  log('Old phone: "This phone was locked out" ✓')
  await B.getByRole('link', { name: 'Open my Account' }).click()
  await B.getByText('USDC left', { exact: false }).waitFor({ timeout: 60_000 })
  await both(B, 'lost-08-overview')
  await B.goto(`${APP_URL}/send`)
  await B.getByLabel('Recipient').fill(treasury)
  await B.locator('#amount').fill('0.1')
  await B.getByText('Face ID alone:', { exact: false }).waitFor({ timeout: 60_000 })
  await B.getByRole('button', { name: 'Continue' }).click()
  await B.getByText('Recipient screened', { exact: false }).waitFor({ timeout: 30_000 })
  await B.getByRole('button', { name: 'Approve with Face ID' }).click()
  await B.getByText('Sent · live onchain').waitFor({ timeout: 120_000 })
  const tx = await B.getByRole('link', { name: /View on Basescan/ }).getAttribute('href')
  log(`New phone: spent 0.10 USDC with Face ID alone → ${tx} ✓`)

  // 6. A linked client (level 1): the identity check before Swissquote co-signs, then the 3-day terms.
  const L = await newPhone(browser)
  const linkedKit = await protect(L, 'eviction-kit-level1', true)
  log('Linked client: wallet protected at level 1 (Kit + Swissquote guardian) ✓')
  const C = await newPhone(browser)
  await C.goto(`${APP_URL}/lost`)
  await C.getByLabel('Recovery Kit file').setInputFiles(linkedKit)
  await C.locator('#lost-kit-passphrase').fill(PASSPHRASE)
  await C.getByRole('button', { name: 'Open my Kit' }).click()
  await C.locator('#lost-name').fill('Alice')
  await C.getByRole('button', { name: 'Create my key with Face ID' }).click()
  await C.getByRole('button', { name: 'Start video identification' }).waitFor()
  await both(C, 'lost-02b-identity')
  await C.getByRole('button', { name: 'Start video identification' }).click()
  await C.getByRole('button', { name: 'Start the lock-out' }).waitFor({ timeout: 60_000 })
  await both(C, 'lost-03b-start-level1')
  log('Linked client: identity check shown, then the 3-day terms ✓')
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} failure(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nAll eviction steps passed. Screenshots in ${OUT}/`)
