/**
 * E2E of the demo security key (ADR-043) on Base Sepolia, in real Chrome with three virtual devices, with
 * screenshots at 390×844 (viewport + full page) and 1440×900.
 *
 *  1. Phone A protects a wallet (limit 0.50 USDC a day).
 *  2. Phone K opens /wallet/key: it plays the security key (MOCK relay, its own Face ID). A shows a pairing
 *     code, K types it and registers; A adds K's key as the Account's third owner with Face ID + the Kit.
 *  3. Phone + key, no passphrase: A raises its limit to 1.00. K first refuses (A says so, nothing signed),
 *     then approves: the Key Safe and the key's contract signature in one execTransaction.
 *  4. With a funded treasury: A gets 1.00 USDC and sends 0.75 (above the limit) back with Face ID + the key;
 *     Activity marks it "Face ID + key"; the last 0.25 goes back with Face ID alone. Skipped, and said so,
 *     when the treasury is empty.
 *  5. Device B: "Phone lost or stolen?" → Kit → Face ID → "Lock out now with Kit and key": K shows the
 *     lock-out and approves; A is locked out at once.
 *
 * Prereqs: `npm run dev`, Google Chrome. Step 4 needs a funded demo treasury (1.00 USDC, returned).
 * About 3 minutes.
 * Run:     node scripts/e2e-demo-key.mts [outDir]   (default: ./screenshots)
 */
import fs from 'node:fs'

import { chromium, type Browser, type Page } from 'playwright-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? 'screenshots'
fs.mkdirSync(OUT, { recursive: true })
const PASSPHRASE = 'orange glacier violin 42'
const PHONE = { width: 390, height: 844 }
const kitPath = `${OUT}/demo-key-kit.json`
const start = Date.now()
const log = (message: string) => console.log(`[${String(Math.round((Date.now() - start) / 1000)).padStart(3)}s] ${message}`)

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

const INTERNAL = { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } as const

/** A device with its own virtual platform authenticator (its "Face ID"). */
async function newDevice(browser: Browser) {
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
  await cdp.send('WebAuthn.addVirtualAuthenticator', { options: INTERNAL })
  return page
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

/** Moves `amount` from the treasury; false when the treasury is empty (the page says so). */
async function fund(page: Page, amount: string) {
  await page.goto(`${APP_URL}/wallet/swissquote`)
  await page.getByLabel('Name on your Swissquote account').fill('Alice Meier')
  await page.getByRole('button', { name: 'Sign in with Swissquote' }).click()
  await page.getByRole('button', { name: 'Link with Face ID' }).click()
  await page.locator('#to-wallet').waitFor({ timeout: 60_000 })
  await page.locator('#to-wallet').fill(amount)
  await page.getByRole('button', { name: 'Move to my wallet' }).click()
  const moved = page.getByText(`${amount} USDC moved to your wallet`)
  const empty = page.getByText('The demo treasury needs test USDC', { exact: false })
  await moved.or(empty).first().waitFor({ timeout: 90_000 })
  return moved.isVisible()
}

/** Send `amount` USDC to `to` up to the review, compliance checks done. */
async function review(page: Page, to: string, amount: string) {
  await page.goto(`${APP_URL}/wallet/send`)
  await page.getByLabel('Recipient').fill(to)
  await page.locator('#amount').fill(amount)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByText('Recipient screened', { exact: false }).waitFor({ timeout: 60_000 })
  const confirm = page.getByLabel('Type the amount to confirm')
  if (await confirm.count()) await confirm.fill((await confirm.getAttribute('placeholder')) ?? '')
}

/** The key phone: wait for the request, screenshot it, then refuse or touch the key. */
async function answerOnKey(K: Page, title: string, name: string, answer: 'approve' | 'refuse') {
  await K.getByRole('heading', { name: title }).waitFor({ timeout: 60_000 })
  await K.getByText('Checked onchain', { exact: false }).waitFor({ timeout: 30_000 })
  await both(K, name)
  await K.getByRole('button', { name: answer === 'approve' ? 'Touch the key' : 'Refuse', exact: true }).click()
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const failures: string[] = []
let current: Page | null = null
try {
  const { relayer: treasury } = (await (await fetch(`${APP_URL}/api/guardian`)).json()) as { relayer: string }
  const A = await newDevice(browser)
  current = A
  await protect(A)
  log('Phone A: wallet protected (limit 0.50 a day) ✓')

  // ── Pairing ────────────────────────────────────────────────────────────────
  const K = await newDevice(browser)
  await K.goto(`${APP_URL}/wallet/key`)
  await K.getByRole('heading', { name: 'Set up this key' }).waitFor()
  await both(K, 'demo-key-01-setup')

  await A.goto(`${APP_URL}/wallet/security`)
  await A.getByRole('button', { name: 'Add a key' }).click()
  await A.getByRole('button', { name: 'Use a demo key on another phone' }).click()
  const code = (await A.getByText(/^[A-Z2-9]{6}$/).first().textContent())?.trim() ?? ''
  if (code.length !== 6) throw new Error(`No pairing code on the wallet (got "${code}")`)
  await A.getByText('Waiting for the other phone').scrollIntoViewIfNeeded()
  await both(A, 'demo-key-02-code', true)

  current = K
  await K.locator('#key-code').fill(code)
  await K.getByRole('button', { name: 'Register with Face ID' }).click()
  await K.getByRole('heading', { name: 'Not an owner yet' }).waitFor({ timeout: 60_000 })
  const keyAddress = (await K.locator('li', { hasText: 'This key' }).locator('span').last().textContent())?.trim()
  await both(K, 'demo-key-03-registered')
  log(`Phone K registered its key with its own Face ID (${keyAddress}) ✓`)

  current = A
  await A.getByText('Demo key registered').waitFor({ timeout: 60_000 })
  await A.locator('#key-kit-passphrase').fill(PASSPHRASE)
  await both(A, 'demo-key-04-review', true)
  await A.getByRole('button', { name: 'Approve with Kit and biometrics' }).click()
  await A.getByText('Security key added · onchain').waitFor({ timeout: 120_000 })
  await A.waitForTimeout(900)
  log(`Key added as the third owner with Face ID + Kit → ${await A.getByRole('link', { name: /View on Basescan/ }).getAttribute('href')} ✓`)

  current = K
  await K.getByRole('heading', { name: 'Waiting', exact: true }).waitFor({ timeout: 60_000 })
  await K.getByText('Third owner, 2 of 3 needed').waitFor({ timeout: 30_000 })
  await both(K, 'demo-key-05-waiting')
  log('Phone K: the key is an owner onchain and waits ✓')

  // ── Phone + key, no passphrase: the limit, refused once, then approved ─────
  current = A
  await A.goto(`${APP_URL}/wallet/security?change=limit`)
  await A.locator('#limit-new').fill('1')
  await A.getByText('Face ID and your key will approve').waitFor({ timeout: 30_000 })
  // The choice, the key's section and the Approve button in one phone viewport (below the sticky header).
  await A.getByRole('radiogroup', { name: 'Approve with' }).evaluate((el) => {
    el.scrollIntoView({ block: 'start' })
    window.scrollBy(0, -140)
  })
  await both(A, 'demo-key-06-limit-review', true)
  await A.getByRole('button', { name: 'Approve with key and biometrics' }).click()
  current = K
  await answerOnKey(K, 'Change the daily limit', 'demo-key-07-request', 'refuse')
  current = A
  await A.getByText('Your key refused this request', { exact: false }).waitFor({ timeout: 60_000 })
  await A.waitForTimeout(300)
  await A.screenshot({ path: `${OUT}/demo-key-08-refused.png` })
  log('K refused: the wallet says so, nothing signed ✓')
  await A.getByRole('button', { name: 'Approve with key and biometrics' }).click()
  current = K
  await answerOnKey(K, 'Change the daily limit', 'demo-key-09-request-again', 'approve')
  await K.getByRole('heading', { name: 'Approved', exact: true }).waitFor({ timeout: 60_000 })
  await shot(K, 'demo-key-10-approved')
  current = A
  await A.getByText('Limit changed · onchain').waitFor({ timeout: 120_000 })
  await A.getByText('Face ID + your security key').first().waitFor()
  await A.waitForTimeout(900)
  const limitTx = await A.getByRole('link', { name: /View on Basescan/ }).getAttribute('href')
  await both(A, 'demo-key-11-limit-done', true)
  log(`Limit raised to 1.00 with Face ID + the key, no passphrase (Key Safe sender + key contract signature) → ${limitTx} ✓`)

  // ── With funds: a payment above the limit with the key ─────────────────────
  if (!(await fund(A, '1'))) {
    log('⚠ Treasury empty: the payment with the key is skipped (fund the treasury to run it)')
  } else {
    await review(A, treasury, '0.75')
    await A.getByText('Face ID and your key will approve').waitFor({ timeout: 30_000 })
    await both(A, 'demo-key-12-send-review', true)
    await A.getByRole('button', { name: 'Approve with key and biometrics' }).click()
    current = K
    await answerOnKey(K, 'Pay 0.75 USDC', 'demo-key-13-pay-request', 'approve')
    current = A
    await A.getByText('Sent · live onchain').waitFor({ timeout: 120_000 })
    await A.getByText('Face ID + your security key').first().waitFor()
    const payTx = await A.getByRole('link', { name: /View on Basescan/ }).getAttribute('href')
    await both(A, 'demo-key-14-sent', true)
    log(`0.75 sent with Face ID + the key, no passphrase → ${payTx} ✓`)

    await A.goto(`${APP_URL}/wallet/activity`)
    await A.getByText('Approved with Face ID and your security key').first().waitFor({ timeout: 90_000 })
    await both(A, 'demo-key-15-activity')
    log('Activity marks the payment "Face ID + key" (from the SafeMultiSigTransaction signatures) ✓')

    await review(A, treasury, '0.25')
    await A.getByRole('button', { name: 'Approve with biometrics' }).click()
    await A.getByText('Sent · live onchain').waitFor({ timeout: 120_000 })
    log('The last 0.25 back to the treasury with Face ID alone ✓')
  }

  // ── Lost phone: Kit + the demo key lock it out at once ─────────────────────
  for (let i = 0; i < 20; i++) {
    const record = JSON.parse((await A.evaluate(() => localStorage.getItem('sq-security-key:v1'))) ?? 'null') as { account: string } | null
    if (record && (await fetch(`${APP_URL}/api/security-keys?account=${record.account}`)).ok) break
    await A.waitForTimeout(1500)
  }
  const B = await newDevice(browser)
  current = B
  await B.goto(`${APP_URL}/wallet/lost`)
  await B.getByLabel('Recovery Kit file').setInputFiles(kitPath)
  await B.locator('#lost-kit-passphrase').fill(PASSPHRASE)
  await B.getByRole('button', { name: 'Open my Kit' }).click()
  await B.locator('#lost-name').fill('Alice')
  await B.getByRole('button', { name: 'Create my key with Face ID' }).click()
  await B.getByRole('button', { name: 'Lock out now with Kit and key' }).click({ timeout: 60_000 })
  current = K
  await answerOnKey(K, 'Lock out a lost phone', 'demo-key-16-lock-out', 'approve')
  current = B
  await B.getByRole('heading', { name: 'This device now holds your Account' }).waitFor({ timeout: 120_000 })
  const lockOutTx = await B.getByRole('link', { name: /Locked out at once/ }).getAttribute('href')
  await both(B, 'demo-key-17-done')
  log(`New device: old phone locked out at once with the Kit + the demo key → ${lockOutTx} ✓`)

  current = A
  await A.goto(`${APP_URL}/wallet`)
  await A.getByText('This phone was locked out').waitFor({ timeout: 60_000 })
  log('Old phone A no longer controls the Account ✓')
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
  await current?.screenshot({ path: `${OUT}/demo-key-failure.png`, fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} failure(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nAll demo key steps passed. Screenshots in ${OUT}/`)
