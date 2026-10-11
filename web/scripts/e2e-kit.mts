/**
 * E2E of the "Test your Kit" reminder (#9, PDR-016, ADR-041) in real Chrome with a virtual passkey,
 * with a screenshot of each state at 390×844 (viewport + full page) and 1440×900.
 *
 *  1. Protect a wallet: the protect flow's test counts ("Tested today" on Security, no reminder).
 *  2. "Demo: skip 90 days": the Recovery Kit row turns Due and the Overview shows the reminder.
 *  3. "Test my Kit" opens the panel: a file that isn't a Kit and a wrong passphrase are refused, then the
 *     right file and passphrase pass, checked onchain. The reminder is gone.
 *  4. "Can't find the file?" saves this phone's encrypted copy again: the same Kit as the first download.
 *
 * Prereqs: `npm run dev`, Google Chrome. About 40 seconds. No funds needed.
 * Run:     node scripts/e2e-kit.mts [outDir]   (default: ./screenshots)
 */
import fs from 'node:fs'

import { chromium, type Page } from 'playwright-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? 'screenshots'
fs.mkdirSync(OUT, { recursive: true })
const PASSPHRASE = 'orange glacier violin 42'
const PHONE = { width: 390, height: 844 }
const kitPath = `${OUT}/kit-kit.json`
const start = Date.now()
const log = (message: string) => console.log(`[${String(Math.round((Date.now() - start) / 1000)).padStart(3)}s] ${message}`)

const shot = async (page: Page, name: string, keepScroll = false) => {
  await page.waitForTimeout(450)
  if (!keepScroll) await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  const bars = await page.addStyleTag({ content: 'nav.fixed, header.sticky { position: static !important; }' })
  await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true })
  await bars.evaluate((node) => (node as Element).remove())
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

/** Same JSON, whatever the key order. */
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
      : value

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

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const failures: string[] = []
let page: Page | null = null
try {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, acceptDownloads: true })
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = 'nextjs-portal { display: none !important; }'
      document.head.appendChild(style)
    })
  })
  page = await context.newPage()
  page.setDefaultTimeout(90_000)
  page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`))
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })

  await protect(page)
  await page.waitForTimeout(1500)
  if (await page.getByText('Test your Recovery Kit').count()) throw new Error('The reminder shows right after setup')
  log('Wallet protected; the setup test counts, no reminder ✓')

  await page.goto(`${APP_URL}/wallet/security`)
  await page.getByText('Tested today').waitFor()
  await page.getByText('Tested today').scrollIntoViewIfNeeded()
  await both(page, 'kit-01-security', true)
  log('Security: Recovery Kit · Tested today ✓')

  await page.getByRole('button', { name: 'Demo: skip 90 days' }).click()
  await page.getByText('Tested 90 days ago').waitFor()
  await page.getByText('Due', { exact: true }).waitFor()
  await page.getByText('Tested 90 days ago').scrollIntoViewIfNeeded()
  await both(page, 'kit-02-due', true)
  log('Demo: skip 90 days → the row is Due ✓')

  await page.goto(`${APP_URL}/wallet`)
  await page.getByText('Test your Recovery Kit').waitFor()
  await page.getByText('Last tested 90 days ago', { exact: false }).waitFor()
  await both(page, 'kit-03-reminder')
  log('Overview: the reminder shows ✓')

  await page.getByRole('link', { name: 'Test my Kit' }).click()
  await page.getByLabel('Recovery Kit file').waitFor({ state: 'attached' })
  await page.waitForURL('**/wallet/security?change=kit')
  await both(page, 'kit-04-panel', true)
  log('"Test my Kit" opens the panel on Security ✓')

  fs.writeFileSync(`${OUT}/not-a-kit.json`, JSON.stringify({ hello: 'world' }))
  await page.getByLabel('Recovery Kit file').setInputFiles(`${OUT}/not-a-kit.json`)
  await page.locator('#kit-test-passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Test my Kit' }).click()
  await page.getByText('This is not a valid Recovery Kit file.').waitFor()
  log('A file that is not a Kit is refused ✓')

  await page.getByLabel('Recovery Kit file').setInputFiles(kitPath)
  await page.locator('#kit-test-passphrase').fill('wrong passphrase 123')
  await page.getByRole('button', { name: 'Test my Kit' }).click()
  await page.getByText('Wrong passphrase. Check it and try again.').waitFor({ timeout: 60_000 })
  await shot(page, 'kit-05-wrong-passphrase', true)
  log('A wrong passphrase is refused ✓')

  await page.locator('#kit-test-passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Test my Kit' }).click()
  await page.getByText('Kit tested', { exact: true }).waitFor({ timeout: 60_000 })
  await page.getByText('Its owner key is an owner of your Account, onchain').waitFor()
  await page.getByText('Tested today').waitFor()
  await both(page, 'kit-06-tested', true)
  log('The right file and passphrase pass, checked onchain; the row reads Tested today ✓')

  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.goto(`${APP_URL}/wallet`)
  await page.getByText('Wallet protected').waitFor()
  await page.waitForTimeout(1000)
  if (await page.getByText('Test your Recovery Kit').count()) throw new Error('The reminder is still on the Overview after the test')
  log('Overview: the reminder is gone ✓')

  await page.goto(`${APP_URL}/wallet/security?change=kit`)
  await page.getByRole('button', { name: 'Can’t find the file?' }).click()
  const [again] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save my Kit again' }).click()])
  await again.saveAs(`${OUT}/kit-again.json`)
  const first = JSON.stringify(canonical(JSON.parse(fs.readFileSync(kitPath, 'utf8'))))
  const second = JSON.stringify(canonical(JSON.parse(fs.readFileSync(`${OUT}/kit-again.json`, 'utf8'))))
  if (first !== second) throw new Error('The Kit saved again differs from the first download')
  await page.getByText('Saved to your downloads as', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Can’t find the file?' }).scrollIntoViewIfNeeded()
  await shot(page, 'kit-07-file-help', true)
  log('"Save my Kit again": the same encrypted Kit as the first download ✓')

  await page.getByRole('button', { name: 'Forgot the passphrase?' }).click()
  await page.getByText('Nobody can reset it, not even Swissquote', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'Forgot the passphrase?' }).scrollIntoViewIfNeeded()
  await both(page, 'kit-08-passphrase-help', true)
  log('"Forgot the passphrase?" explains it honestly ✓')
} catch (error) {
  failures.push(error instanceof Error ? error.message.split('\n')[0] : String(error))
  await page?.screenshot({ path: `${OUT}/kit-failure.png`, fullPage: true }).catch(() => {})
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} failure(s):\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`\nAll Kit test steps passed. Screenshots in ${OUT}/`)
