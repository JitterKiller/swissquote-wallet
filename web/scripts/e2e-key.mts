/**
 * E2E of the security key (#17, PDR-017, ADR-038) on Base Sepolia, in real Chrome with virtual
 * authenticators, with a screenshot of every step at 390×844 (viewport + full page) and 1440×900.
 *
 *  1. Phone A: protect a wallet (level 0), then "Add a key" on the Security page. The phone itself is
 *     refused as its own key (it holds the wallet's passkey); a separate USB authenticator registers the
 *     key, which becomes the Account's third owner with Face ID + the Kit.
 *  2. The key is "carried" to a new device B: its credential is exported from the USB authenticator and
 *     imported into B's, as a physical key would be plugged in.
 *  3. Device B: "Phone lost or stolen?" → Kit file + passphrase → Face ID. The start step leads with
 *     "Lock out now with Kit and key"; B first starts the time-locked lock-out, then ends it from the
 *     pending step with the Kit and the key: one transaction cancels it and replaces the old phone at once.
 *     (The start step's button runs the same action without the cancel.)
 *  4. Phone A no longer controls the Account.
 *
 * Prereqs: `npm run dev`, Google Chrome. About 1 minute. No funds needed.
 * Run:     node scripts/e2e-key.mts [outDir]   (default: ./screenshots)
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
  const kitPath = `${OUT}/key-kit.json`
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


const INTERNAL = { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } as const
const USB_KEY = { ...INTERNAL, transport: 'usb' } as const

/** A device with its own virtual authenticator, and the handles to move credentials in or out. */
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
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: INTERNAL })
  return { page, cdp, authenticatorId }
}

const kitPath = `${OUT}/key-kit.json`
const b64url = (value: string) => value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const failures: string[] = []
let current: Page | null = null
try {
  const A = await newDevice(browser)
  current = A.page
  await protect(A.page)
  log('Phone A: wallet protected (level 0) ✓')

  await A.page.goto(`${APP_URL}/security`)
  await A.page.getByRole('button', { name: 'Add a key' }).click()
  // The phone alone: it already holds the wallet's passkey, so it can't be the key (excludeCredentials).
  await A.page.getByRole('button', { name: 'Register a security key' }).click()
  await A.page.getByText('This device can’t be your key').waitFor({ timeout: 60_000 })
  await A.page.waitForTimeout(400)
  await A.page.screenshot({ path: `${OUT}/key-00-same-device-refused.png` })
  log('The phone is refused as its own key ✓')

  // Plug a separate key in: the phone's authenticator steps aside while the USB key registers.
  const { credentials: phoneCredentials } = await A.cdp.send('WebAuthn.getCredentials', { authenticatorId: A.authenticatorId })
  await A.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: A.authenticatorId })
  const { authenticatorId: usbKey } = await A.cdp.send('WebAuthn.addVirtualAuthenticator', { options: USB_KEY })
  await A.page.getByRole('button', { name: 'Register a security key' }).click()
  await A.page.getByText('Key registered').waitFor({ timeout: 60_000 })
  const { credentials: keyCredentials } = await A.cdp.send('WebAuthn.getCredentials', { authenticatorId: usbKey })
  await A.cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: usbKey })
  const { authenticatorId: phoneAgain } = await A.cdp.send('WebAuthn.addVirtualAuthenticator', { options: INTERNAL })
  for (const credential of phoneCredentials) await A.cdp.send('WebAuthn.addCredential', { authenticatorId: phoneAgain, credential })
  await A.page.waitForTimeout(500)
  await A.page.screenshot({ path: `${OUT}/key-01-registered.png` })
  await A.page.locator('#key-kit-passphrase').fill(PASSPHRASE)
  await both(A.page, 'key-02-review', true)
  await A.page.getByRole('button', { name: 'Approve with Kit and biometrics' }).click()
  await A.page.getByText('Security key added · onchain').waitFor({ timeout: 120_000 })
  await A.page.waitForTimeout(900)
  const addTx = await A.page.getByRole('link', { name: /View on Basescan/ }).getAttribute('href')
  await both(A.page, 'key-03-done', true)
  log(`Key added as the third owner with Face ID + Kit → ${addTx} ✓`)

  await A.page.getByRole('button', { name: 'Done', exact: true }).click()
  await A.page.getByText('Kept at home · with your Kit, locks a lost phone out as soon as you act').waitFor({ timeout: 60_000 })
  await both(A.page, 'key-04-security')
  log('Security page: the key is an owner, the worst case is one day of the limit ✓')

  // Carry the key to the new device, and wait until Swissquote's directory lists it.
  const record = JSON.parse((await A.page.evaluate(() => localStorage.getItem('sq-security-key:v1'))) ?? 'null') as { account: string; credentialId: string } | null
  if (!record) throw new Error('No security key record on phone A')
  const keyCredential = keyCredentials.find((c) => b64url(c.credentialId) === b64url(record.credentialId))
  if (!keyCredential) throw new Error('The key credential is not in the USB key’s authenticator')
  for (let i = 0; i < 20; i++) {
    if ((await fetch(`${APP_URL}/api/security-keys?account=${record.account}`)).ok) break
    await A.page.waitForTimeout(1500)
  }

  const B = await newDevice(browser)
  current = B.page
  await B.cdp.send('WebAuthn.addCredential', { authenticatorId: B.authenticatorId, credential: keyCredential })
  await B.page.goto(`${APP_URL}/lost`)
  await B.page.getByLabel('Recovery Kit file').setInputFiles(kitPath)
  await B.page.locator('#lost-kit-passphrase').fill(PASSPHRASE)
  await B.page.getByRole('button', { name: 'Open my Kit' }).click()
  await B.page.locator('#lost-name').fill('Alice')
  await B.page.getByRole('button', { name: 'Create my key with Face ID' }).click()
  await B.page.getByRole('button', { name: 'Lock out now with Kit and key' }).waitFor({ timeout: 60_000 })
  await both(B.page, 'key-05-lost')

  // The owner starts the time-locked lock-out first, then finds the key: it ends the wait.
  await B.page.getByRole('button', { name: 'Start the lock-out' }).click()
  await B.page.getByText('Have your security key?').waitFor({ timeout: 120_000 })
  log('Time-locked lock-out started; the pending step offers the key ✓')
  await B.page.getByText('Have your security key?').scrollIntoViewIfNeeded()
  await both(B.page, 'key-05b-pending', true)
  await B.page.getByRole('button', { name: 'Lock out now with Kit and key' }).click()
  await B.page.getByRole('heading', { name: 'This device now holds your Account' }).waitFor({ timeout: 120_000 })
  const lockOutTx = await B.page.getByRole('link', { name: /Locked out at once/ }).getAttribute('href')
  await both(B.page, 'key-06-done')
  log(`New device: running lock-out cancelled and old phone replaced at once with Kit + key → ${lockOutTx} ✓`)

  current = A.page
  await A.page.goto(APP_URL)
  await A.page.getByText('This phone was locked out').waitFor({ timeout: 60_000 })
  await A.page.screenshot({ path: `${OUT}/key-07-old-phone.png` })
  log('Old phone A no longer controls the Account ✓')
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
  await current?.screenshot({ path: `${OUT}/key-failure.png`, fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} failure(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nAll security key steps passed. Screenshots in ${OUT}/`)
