/**
 * End-to-end test in real Chrome, with Chrome's virtual WebAuthn authenticator
 * standing in for Touch ID / Face ID (no human needed).
 *
 *  1. Opens the app and creates a wallet through the UI (real WebAuthn ceremony).
 *  2. Checks the stored public key maps to the displayed Safe address.
 *  3. Signs two UserOps with assertions produced by Chrome and sends them
 *     (sponsored): deployment, then a regular op on the deployed Safe.
 *  4. Opens the Security page and checks it shows the account as active on-chain.
 *
 * Prereqs: `npm run dev` running, Google Chrome installed.
 * Run:     node scripts/e2e-passkey.mts   (SCREENSHOTS=dir to save screenshots)
 */
import {
  Erc7677Paymaster,
  SafeMultiChainSigAccountV1 as SafeAccount,
  fromSafeWebauthn,
  webauthnSignatureFromAssertion,
  type MetaTransaction,
  type WebauthnPublicKey,
} from 'abstractionkit'
import { chromium } from 'playwright-core'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const SCREENSHOTS = process.env.SCREENSHOTS
const CHAIN_ID = 84532n
const NODE_URL = 'https://sepolia.base.org'
const BUNDLER_URL = 'https://api.candide.dev/public/v3/84532'
const PAYMASTER_URL = 'https://api.candide.dev/public/v3/84532'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 420, height: 900 } })
const page = await context.newPage()

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

try {
  // 1. Create the wallet through the UI.
  await page.goto(`${APP_URL}/wallet/welcome`) // no wallet yet: the create screen
  // A cold dev compile can hydrate after the first fill and clear the field: fill until the button is enabled.
  for (let i = 0; i < 20; i++) {
    await page.getByLabel('Your name').fill('Alice')
    if (await page.getByRole('button', { name: 'Create wallet with passkey' }).isEnabled()) break
    await page.waitForTimeout(500)
  }
  if (SCREENSHOTS) await page.screenshot({ path: `${SCREENSHOTS}/1-onboarding.png`, fullPage: true })
  await page.getByRole('button', { name: 'Create wallet with passkey' }).click()
  await page.getByRole('heading', { name: 'Protect your wallet' }).waitFor({ timeout: 20_000 })
  if (SCREENSHOTS) await page.screenshot({ path: `${SCREENSHOTS}/2-protect.png`, fullPage: true })

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sq-wallet:v1')!))
  console.log('Wallet created in UI :', stored.address)

  // 2. Public key ↔ address consistency.
  const publicKey: WebauthnPublicKey = { x: BigInt(stored.publicKey.x), y: BigInt(stored.publicKey.y) }
  const expected = SafeAccount.createAccountAddress([publicKey])
  if (expected.toLowerCase() !== stored.address.toLowerCase()) {
    throw new Error(`Address mismatch: expected ${expected}, UI shows ${stored.address}`)
  }

  // 3. UserOps signed by Chrome's authenticator.
  const chromeAssertion = async (challenge: Uint8Array) => {
    const res = await page.evaluate(
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
  }

  const send = async (account: SafeAccount, calls: MetaTransaction[]) => {
    let userOp = await account.createUserOperation(calls, NODE_URL, BUNDLER_URL, {
      expectedSigners: [publicKey],
    })
    userOp = (
      await new Erc7677Paymaster(PAYMASTER_URL).createPaymasterUserOperation(account, userOp, BUNDLER_URL)
    ).userOperation
    const signer = fromSafeWebauthn({
      publicKey,
      isInit: userOp.nonce === 0n,
      accountClass: SafeAccount,
      getAssertion: chromeAssertion,
    })
    userOp.signature = await account.signUserOperationWithSigners(userOp, [signer], CHAIN_ID)
    const receipt = await (await account.sendUserOperation(userOp, BUNDLER_URL)).included()
    if (!receipt?.success) throw new Error(`UserOp nonce ${userOp.nonce} failed`)
    console.log(`UserOp nonce ${userOp.nonce} ok      : https://sepolia.basescan.org/tx/${receipt.receipt.transactionHash}`)
  }

  const noop = (to: string): MetaTransaction => ({ to, value: 0n, data: '0x' })
  await send(SafeAccount.initializeNewAccount([publicKey]), [noop(stored.address)])
  await send(new SafeAccount(stored.address), [noop(stored.address)])

  // 4. UI reflects the deployed account.
  await page.goto(`${APP_URL}/wallet/security`)
  await page.getByText('Active onchain').waitFor({ timeout: 20_000 })
  if (SCREENSHOTS) await page.screenshot({ path: `${SCREENSHOTS}/3-active.png`, fullPage: true })
  console.log('UI shows account active on-chain ✓')
} finally {
  await browser.close()
}
