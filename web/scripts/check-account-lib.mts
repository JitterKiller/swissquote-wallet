/**
 * Acceptance check for issue #8: ADR-017 criteria C1–C4 run through `src/lib/account.ts`
 * on Base Sepolia (the spike proved them with inline code; this proves the library).
 *
 *  Setup  predictAccountAddress + accountSetupCalls (level 0, default 2-owner Account), then
 *         addOwnerCall adds a security key as third owner. Checked with readAccount.
 *  C1     Face ID alone spends within the daily limit (allowanceTransferCall).
 *  C2     Spending above the remaining allowance is refused.
 *  C3     Key Safe UserOps run account.execTransaction with Kit ECDSA + v = 1 (setup, add owner).
 *  C4     A relayer pays above the limit with the Kit + the security key (contract signature).
 *
 * Funds: the test-only token (helpers/chain.ts). About 1 minute.
 * Run: npm run check:account
 */
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import type { Address } from 'viem'

import {
  accountExecCall,
  accountNonce,
  accountSetupCalls,
  accountTxDigest,
  addOwnerCall,
  allowanceTransferCall,
  contractSignature,
  encodeSafeSignatures,
  kitSignature,
  predictAccountAddress,
  readAccount,
  senderSignature,
  tokenTransferCall,
} from '../src/lib/account'
import { ACCOUNT_RECOVERY_MODULE } from '../src/lib/config'
import { isDeployed } from '../src/lib/wallet'
import {
  TEST_TOKEN,
  TOKEN_UNIT,
  createRelayer,
  createReport,
  deployVerifierProxyCall,
  fails,
  keySafeSend,
  mintCall,
  newPasskey,
  revertReason,
  testTokenSetupCalls,
  tokenBalance,
  txLink,
  verifierProxy,
  webauthnContractSignature,
} from './helpers/chain'

const report = createReport()
const { log, record } = report

const phone = newPasskey()
const securityKey = newPasskey()
const kit = privateKeyToAccount(generatePrivateKey()) // Kit owner key
const kitGuardian = privateKeyToAccount(generatePrivateKey()).address // Kit guardian key (eviction)
const relayer = createRelayer()
const recipient = privateKeyToAccount(generatePrivateKey()).address as Address
const DAILY_LIMIT = 100n * TOKEN_UNIT

async function main() {
  const keySafe = phone.keySafe
  const account = predictAccountAddress({ keySafe, kitOwner: kit.address })
  const keyProxy = verifierProxy(securityKey)
  log(`Key Safe ${keySafe} · Account (predicted) ${account} · Kit ${kit.address} · key proxy ${keyProxy}`)

  // Setup: one Key Safe UserOp deploys the Key Safe, the test token (once), the key's verifier proxy,
  // the Account (accountSetupCalls) and funds it.
  const setupCalls = [
    ...(await testTokenSetupCalls()),
    deployVerifierProxyCall(securityKey),
    ...(await accountSetupCalls({ keySafe, kitOwner: kit.address, kitGuardian, dailyLimit: DAILY_LIMIT, level: 0, token: TEST_TOKEN }, kit)),
    mintCall(account, 1000n * TOKEN_UNIT),
  ]
  const setupTx = await keySafeSend(phone, setupCalls)
  let state = await readAccount(account, { token: TEST_TOKEN })
  record('Setup', (await isDeployed(account)) && state.owners.length === 2 && state.threshold === 2
    && state.evictionModule?.toLowerCase() === ACCOUNT_RECOVERY_MODULE[0].toLowerCase()
    && state.guardians.map((g) => g.toLowerCase()).includes(kitGuardian.toLowerCase()) && state.guardianThreshold === 1
    && state.allowance?.delegate.toLowerCase() === keySafe.toLowerCase() && state.allowance.amount === DAILY_LIMIT,
    `deployed at the predicted address; owners 2, threshold 2, eviction module + Kit guardian, allowance ${state.allowance?.amount} → ${txLink(setupTx)}`)

  // Add the security key as third owner (Kit + Key Safe).
  const addKey = addOwnerCall(account, keyProxy)
  const addKeyTx = await keySafeSend(phone, [
    accountExecCall(account, addKey, encodeSafeSignatures([await kitSignature(kit, account, addKey, state.nonce), senderSignature(keySafe)])),
  ])
  state = await readAccount(account, { token: TEST_TOKEN })
  record('C3', state.owners.length === 3 && state.owners.some((o) => o.toLowerCase() === keyProxy.toLowerCase()) && state.threshold === 2,
    `Key Safe UserOps ran account.execTransaction with Kit ECDSA + v=1 (setup batch, then addOwner) → ${txLink(addKeyTx)}`)

  // C1: Face ID alone, within the limit.
  const c1 = await keySafeSend(phone, [allowanceTransferCall({ account, to: recipient, amount: 40n * TOKEN_UNIT, keySafe, token: TEST_TOKEN })])
  state = await readAccount(account, { token: TEST_TOKEN })
  record('C1', (await tokenBalance(recipient)) === 40n * TOKEN_UNIT && state.allowance?.remaining === 60n * TOKEN_UNIT,
    `Face ID alone spent 40 of 100; readAccount shows ${state.allowance && state.allowance.remaining / TOKEN_UNIT} left → ${txLink(c1)}`)

  // C2: above the remaining allowance.
  const over = allowanceTransferCall({ account, to: recipient, amount: 70n * TOKEN_UNIT, keySafe, token: TEST_TOKEN })
  const refused = await fails(() => keySafeSend(phone, [over]))
  record('C2', refused && (await tokenBalance(recipient)) === 40n * TOKEN_UNIT,
    `70 with 60 left: ${refused ? `refused — ${await revertReason(keySafe, over)}` : 'NOT REFUSED'}`)

  // C4: above the limit, Kit + security key, sent by a relayer (no Key Safe involved).
  const payment = tokenTransferCall({ to: recipient, amount: 500n * TOKEN_UNIT, token: TEST_TOKEN })
  const nonce = await accountNonce(account)
  const signatures = encodeSafeSignatures([
    await kitSignature(kit, account, payment, nonce),
    contractSignature(keyProxy, webauthnContractSignature(securityKey, accountTxDigest(account, payment, nonce))),
  ])
  const c4 = await relayer.send([accountExecCall(account, payment, signatures)])
  record('C4', (await tokenBalance(recipient)) === 540n * TOKEN_UNIT,
    `relayer paid 500 with Kit ECDSA + security key WebAuthn signature → ${txLink(c4)}`)
}

main().then(() => report.finish(), (error) => report.finish(error))
