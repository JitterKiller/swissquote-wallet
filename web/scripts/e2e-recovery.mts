/**
 * End-to-end recovery test in real Chrome, two "devices" (two browser
 * contexts, each with its own virtual authenticator = its own passkey).
 *
 *  1. Old device: create wallet, download Recovery Kit, activate protection.
 *  2. New device: Recovery Kit + new passkey; attacker identity check is refused.
 *  3. New device: legitimate identity check → recovery starts (on-chain delay).
 *  4. Old device: sees the alert and cancels → new device sees "cancelled".
 *  5. New device: starts over, waits the delay, finalizes → owns the wallet.
 *  6. New passkey signs a UserOp on the recovered wallet; old device is revoked.
 *
 * Takes ~5 minutes (3-minute recovery delay). Prereqs: `npm run dev`, Chrome.
 * Run: node scripts/e2e-recovery.mts   (SCREENSHOTS=dir to save screenshots)
 */
import fs from 'node:fs'

import {
  Erc7677Paymaster,
  SafeMultiChainSigAccountV1 as SafeAccount,
  fromSafeWebauthn,
  webauthnSignatureFromAssertion,
} from 'abstractionkit'
import { chromium, type BrowserContext, type Page } from 'playwright-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const SCREENSHOTS = process.env.SCREENSHOTS
const CHAIN_ID = 84532n
const NODE_URL = 'https://sepolia.base.org'
const BUNDLER_URL = 'https://api.candide.dev/public/v3/84532'
const PAYMASTER_URL = 'https://api.candide.dev/public/v3/84532'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const started = Date.now()
const log = (msg: string) => console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${msg}`)

async function device(): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
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
  return { context, page }
}

const shot = async (page: Page, name: string) => {
  if (SCREENSHOTS) await page.screenshot({ path: `${SCREENSHOTS}/${name}.png`, fullPage: true })
}

async function startRecovery(page: Page, kitText: string) {
  await page.getByRole('textbox', { name: 'Recovery Kit' }).fill(kitText)
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Name', { exact: true }).fill('Alice')
  await page.getByRole('button', { name: 'Create new passkey' }).click()
  await page.getByRole('button', { name: 'Start video identification' }).waitFor()
}

try {
  const oldDevice = await device()
  const newDevice = await device()
  const A = oldDevice.page
  const B = newDevice.page

  // 1. Old device: create + protect.
  await A.goto(APP_URL)
  await A.getByLabel('Your name').fill('Alice')
  await A.getByRole('button', { name: 'Create wallet with passkey' }).click()
  await A.getByRole('heading', { name: 'Protect your wallet' }).waitFor()
  const [download] = await Promise.all([
    A.waitForEvent('download'),
    A.getByRole('button', { name: 'Download Recovery Kit' }).click(),
  ])
  const kitText = fs.readFileSync(await download.path(), 'utf8')
  const kit = JSON.parse(kitText)
  await A.getByRole('checkbox').check()
  await shot(A, 'r1-protect')
  await A.getByRole('button', { name: 'Activate protection' }).click()
  await A.getByRole('heading', { name: 'Your wallet is protected' }).waitFor()
  await A.getByRole('link', { name: 'Go to my wallet' }).click()
  await A.getByText('Wallet protected').waitFor()
  log(`Wallet ${kit.wallet} created and protected (Recovery Kit + Swissquote, 2 of 2)`)
  await shot(A, 'r2-protected')

  // 2. New device: attacker path refused at identity verification.
  await B.goto(APP_URL)
  await B.getByRole('link', { name: /Recover your wallet/ }).click()
  await startRecovery(B, kitText)
  await B.getByRole('button', { name: 'Demo: simulate an attacker' }).click()
  await B.getByText(/Identity verification failed/).waitFor()
  log('Attacker path: identity verification failed, Swissquote refused to sign ✓')
  await shot(B, 'r3-attacker-refused')

  // 3. Legitimate identity check → recovery starts.
  await B.getByRole('button', { name: 'Start video identification' }).click()
  await B.getByText('Recovery in progress').waitFor()
  log('Recovery requested on-chain (Recovery Kit + Swissquote approvals) ✓')
  await shot(B, 'r4-pending')

  // 4. Old device cancels.
  await A.getByText('Recovery requested for your wallet').waitFor()
  await shot(A, 'r5-alert')
  await A.getByRole('button', { name: /cancel recovery/i }).click()
  await A.getByText('Recovery requested for your wallet').waitFor({ state: 'detached' })
  log('Old device cancelled the recovery ✓')
  await B.getByText('Recovery cancelled').waitFor()
  log('New device sees the cancellation ✓')

  // 5. Start over and let it go through.
  await B.getByRole('button', { name: 'Start over' }).click()
  await startRecovery(B, kitText)
  await B.getByRole('button', { name: 'Start video identification' }).click()
  await B.getByText('Recovery in progress').waitFor()
  log('Second recovery requested, waiting for the delay…')
  await B.getByRole('button', { name: 'Finalize recovery' }).waitFor({ timeout: 300_000 })
  await B.getByRole('button', { name: 'Finalize recovery' }).click()
  await B.getByText('Wallet protected').waitFor()
  log('Recovery finalized: new device owns the wallet, guardians still in place ✓')
  await shot(B, 'r6-recovered')

  // 6a. New passkey signs a UserOp on the recovered wallet.
  const stored = await B.evaluate(() => JSON.parse(localStorage.getItem('sq-wallet:v1')!))
  if (stored.address.toLowerCase() !== kit.wallet.toLowerCase()) throw new Error('Recovered a different wallet')
  const publicKey = { x: BigInt(stored.publicKey.x), y: BigInt(stored.publicKey.y) }
  const account = new SafeAccount(stored.address)
  let userOp = await account.createUserOperation(
    [{ to: stored.address, value: 0n, data: '0x' }],
    NODE_URL,
    BUNDLER_URL,
    { expectedSigners: [publicKey] },
  )
  userOp = (await new Erc7677Paymaster(PAYMASTER_URL).createPaymasterUserOperation(account, userOp, BUNDLER_URL))
    .userOperation
  const signer = fromSafeWebauthn({
    publicKey,
    isInit: false,
    accountClass: SafeAccount,
    getAssertion: async (challenge) => {
      const res = await B.evaluate(
        async ({ challenge, credentialId }) => {
          const fromB64url = (s: string) =>
            Uint8Array.from(
              atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)),
              (c) => c.charCodeAt(0),
            )
          const cred = (await navigator.credentials.get({
            publicKey: {
              challenge: new Uint8Array(challenge),
              rpId: location.hostname,
              allowCredentials: [{ type: 'public-key', id: fromB64url(credentialId) }],
              userVerification: 'required',
            },
          })) as PublicKeyCredential
          const r = cred.response as AuthenticatorAssertionResponse
          const bytes = (b: ArrayBuffer) => Array.from(new Uint8Array(b))
          return {
            authenticatorData: bytes(r.authenticatorData),
            clientDataJSON: bytes(r.clientDataJSON),
            signature: bytes(r.signature),
          }
        },
        { challenge: Array.from(challenge), credentialId: stored.credentialId as string },
      )
      return webauthnSignatureFromAssertion({
        authenticatorData: new Uint8Array(res.authenticatorData),
        clientDataJSON: new Uint8Array(res.clientDataJSON),
        signature: new Uint8Array(res.signature),
      })
    },
  })
  userOp.signature = await account.signUserOperationWithSigners(userOp, [signer], CHAIN_ID)
  const receipt = await (await account.sendUserOperation(userOp, BUNDLER_URL)).included()
  if (!receipt?.success) throw new Error('New passkey could not sign for the recovered wallet')
  log(`New passkey signed a tx: https://sepolia.basescan.org/tx/${receipt.receipt.transactionHash} ✓`)

  // 6b. Old device is revoked.
  await A.getByText('This device no longer controls this wallet').waitFor()
  log('Old device shows it lost control of the wallet ✓')
  await shot(A, 'r7-revoked')
} finally {
  await browser.close()
}
