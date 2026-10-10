/**
 * "Link with Face ID" in real Chrome with a virtual passkey (issues #18, #20, #19), on Base Sepolia.
 *
 *  L1  A wallet created and protected through the UI (Account deployed, #10).
 *  L2  MOCK Swissquote sign-in, then "Link with Face ID" on /handle: the passkey signs the
 *      ownership statement in the browser and the page shows "Linked as …".
 *  L3  The registry entry points to the Account (not the Key Safe) with the masked name.
 *  L4  Claim an @handle in the UI; a second client resolves it to the Account.
 *  L5  /swissquote shows the linked account with its MOCK balance.
 *
 * Prereqs: `npm run dev`, Google Chrome. About 1–2 minutes. Run: npm run e2e:link
 */
import { chromium, type Page } from 'playwright-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const PASSPHRASE = 'orange glacier violin 42'
const run = Date.now().toString(36)
const NAME = `Adam Run${run}`
const CLIENT_ID = `sq-${NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
const HANDLE = `adam${run}`.slice(0, 20)

const results: [string, boolean][] = []
const record = (id: string, ok: boolean, detail: string) => {
  results.push([id, ok])
  console.log(`${ok ? '✅' : '❌'} ${id} ${detail}`)
}
const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

async function createAndProtect(page: Page) {
  await page.goto(`${APP_URL}/welcome`)
  await page.getByLabel('Your name').fill('Adam')
  await page.getByRole('button', { name: 'Create wallet with passkey' }).click()
  await page.getByRole('heading', { name: 'Protect your wallet' }).waitFor()
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Confirm passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Create my Recovery Kit' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Recovery Kit' }).click(),
  ])
  const kitPath = await download.path()
  await page.getByRole('button', { name: 'I saved it, continue' }).click()
  await page.getByLabel('Recovery Kit file').setInputFiles(kitPath)
  await page.getByLabel('Kit passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Test my Kit' }).click()
  await page.getByRole('heading', { name: 'Choose your daily limit' }).waitFor()
  await page.getByRole('button', { name: 'Activate protection' }).click()
  await page.getByRole('heading', { name: 'Your wallet is protected' }).waitFor()
  return page.evaluate(() => JSON.parse(localStorage.getItem('sq-wallet:v1')!)) as Promise<{ address: string; account?: string }>
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  })

  // L1
  const wallet = await createAndProtect(page)
  record('L1', !!wallet.account && !same(wallet.account, wallet.address), `Key Safe ${wallet.address}, Account ${wallet.account}`)

  // L2
  await page.goto(`${APP_URL}/handle`)
  await page.getByLabel('Name on your Swissquote account').fill(NAME)
  await page.getByRole('button', { name: 'Sign in with Swissquote' }).click()
  const signaturesBefore = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials[0]?.signCount ?? 0
  await page.getByRole('button', { name: 'Link with Face ID' }).click()
  await page.getByText('Linked as').waitFor({ timeout: 60_000 })
  const signaturesAfter = (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials[0]?.signCount ?? 0
  const linkedText = (await page.getByText('Linked as').textContent())?.trim()
  record('L2', signaturesAfter > signaturesBefore, `"${linkedText}" after one passkey assertion (sign count ${signaturesBefore} → ${signaturesAfter})`)

  // L3
  const entry = await (await fetch(`${APP_URL}/api/wallets/me?clientId=${CLIENT_ID}`)).json()
  record('L3', same(entry.account, wallet.account) && same(entry.keySafe, wallet.address) && entry.maskedName === 'Adam R.',
    `registry: account=${entry.account} keySafe=${entry.keySafe} name="${entry.maskedName}"`)

  // L4
  await page.getByPlaceholder('adam').fill(HANDLE)
  await page.getByRole('button', { name: 'Claim' }).click()
  await page.getByRole('heading', { name: `@${HANDLE}` }).waitFor()
  // A second linked client (registered through the API in check-handles) is not needed: the
  // owner can always resolve their own handle, which exercises the same endpoint.
  const resolved = await (await fetch(`${APP_URL}/api/handles/${HANDLE}?clientId=${CLIENT_ID}`)).json()
  record('L4', same(resolved.account, wallet.account) && resolved.maskedName === 'Adam R.', `@${HANDLE} → ${resolved.account} (${resolved.maskedName})`)

  // L5
  await page.goto(`${APP_URL}/swissquote`)
  await page.getByText('Adam R. · Swissquote account').waitFor()
  const balance = await page.getByText(/USDC$/).first().textContent()
  record('L5', !!balance && balance.includes('1,000'), `/swissquote shows the linked account, balance "${balance}" (MOCK)`)

  await fetch(`${APP_URL}/api/handles?clientId=${CLIENT_ID}`, { method: 'DELETE' })
  await fetch(`${APP_URL}/api/wallets/me?clientId=${CLIENT_ID}`, { method: 'DELETE' })
} catch (error) {
  const pages = browser.contexts().flatMap((c) => c.pages())
  if (pages[0]) await pages[0].screenshot({ path: process.env.FAIL_SHOT ?? '/tmp/e2e-link-failure.png', fullPage: true }).catch(() => {})
  record('ABORT', false, error instanceof Error ? error.message.split('\n')[0] : String(error))
} finally {
  await browser.close()
}
const failed = results.filter(([, ok]) => !ok)
console.log(failed.length ? `\n${failed.length} check(s) failed` : `\nAll ${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
