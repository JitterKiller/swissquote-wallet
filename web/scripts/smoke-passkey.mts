/**
 * Smoke test: proves the full stack works on Base Sepolia without a browser.
 *
 *   simulated passkey (P-256)  →  Safe smart account  →  UserOp
 *   →  Candide paymaster (gas sponsored)  →  Candide bundler  →  on-chain
 *
 * The passkey is simulated with ox (raw P-256 key + WebAuthn payload format),
 * so the on-chain verification path is exactly the one a real Face ID / Touch ID
 * signature goes through.
 *
 * Sends two UserOps: the first one deploys the Safe (isInit = true, shared
 * signer), the second one uses the deployed Safe (isInit = false, signer proxy).
 *
 * Run:  node scripts/smoke-passkey.mts
 */
import {
  Erc7677Paymaster,
  SafeMultiChainSigAccountV1 as SafeAccount,
  fromSafeWebauthn,
  webauthnSignatureFromAssertion,
  type MetaTransaction,
  type WebauthnPublicKey,
} from 'abstractionkit'
import { Hex, P256, WebAuthnP256 } from 'ox'

const CHAIN_ID = 84532n
const NODE_URL = 'https://sepolia.base.org'
const BUNDLER_URL = 'https://api.candide.dev/public/v3/84532'
const PAYMASTER_URL = 'https://api.candide.dev/public/v3/84532'

// "Passkey": a P-256 key pair, like the one living in the Secure Enclave.
const privateKey = P256.randomPrivateKey()
const { x, y } = P256.getPublicKey({ privateKey })
const publicKey: WebauthnPublicKey = { x: BigInt(x), y: BigInt(y) }

async function send(account: SafeAccount, calls: MetaTransaction[]) {
  let userOp = await account.createUserOperation(calls, NODE_URL, BUNDLER_URL, {
    expectedSigners: [publicKey],
  })

  // Gas sponsored by the paymaster: the account holds 0 ETH.
  const paymaster = new Erc7677Paymaster(PAYMASTER_URL)
  userOp = (await paymaster.createPaymasterUserOperation(account, userOp, BUNDLER_URL)).userOperation

  // Sign like a browser authenticator would (authenticatorData || sha256(clientDataJSON)).
  const signer = fromSafeWebauthn({
    publicKey,
    isInit: userOp.nonce === 0n,
    accountClass: SafeAccount,
    getAssertion: async (challenge) => {
      const { metadata, payload } = WebAuthnP256.getSignPayload({
        challenge: Hex.fromBytes(challenge),
        rpId: 'localhost',
        origin: 'http://localhost:3000',
      })
      const signature = P256.sign({ payload, privateKey, hash: true })
      return webauthnSignatureFromAssertion({
        authenticatorData: metadata.authenticatorData,
        clientDataJSON: metadata.clientDataJSON,
        signature: { r: BigInt(signature.r), s: BigInt(signature.s) },
      })
    },
  })
  userOp.signature = await account.signUserOperationWithSigners(userOp, [signer], CHAIN_ID)

  const response = await account.sendUserOperation(userOp, BUNDLER_URL)
  const receipt = await response.included()
  if (!receipt) throw new Error('Timed out waiting for inclusion')
  console.log(`  nonce ${userOp.nonce} → success=${receipt.success}`)
  console.log('  https://sepolia.basescan.org/tx/' + receipt.receipt.transactionHash)
  if (!receipt.success) throw new Error('UserOp reverted on-chain')
}

const noop = (to: string): MetaTransaction => ({ to, value: 0n, data: '0x' })

// 1. Counterfactual Safe owned by the passkey; the first UserOp deploys it.
const newAccount = SafeAccount.initializeNewAccount([publicKey])
console.log('Safe address :', newAccount.accountAddress)
console.log('UserOp #1 (deploys the Safe):')
await send(newAccount, [noop(newAccount.accountAddress)])

// 2. Same Safe, now deployed: regular passkey-signed UserOp.
const deployed = new SafeAccount(newAccount.accountAddress)
console.log('UserOp #2 (deployed Safe):')
await send(deployed, [noop(deployed.accountAddress)])
