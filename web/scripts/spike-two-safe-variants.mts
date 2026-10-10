/**
 * Issue #27: the two cases the first spike did not run, through `src/lib/account.ts`.
 *
 *  V1  Default 2-owner Account [Key Safe, Kit], threshold 2 (what onboarding creates):
 *      V1a the Kit guardian key starts an eviction,
 *      V1b the thief (stolen Key Safe alone) cannot cancel it,
 *      V1c the owner cancels with 2 factors (Face ID + Kit),
 *      V1d after the delay, finalize replaces the stolen Key Safe (owners: new Key Safe, Kit),
 *      V1e handover: the old Key Safe can no longer spend, the new phone can.
 *  C4b Immediate eviction (PDR-017) on a 3-owner Account [Key Safe, Kit, security key]:
 *      a relayer swaps the Key Safe and moves the allowance with Kit + security key,
 *      in one transaction, without the phone; the old Key Safe can no longer spend.
 *
 * C4b runs while V1 waits for its delay. About 4–5 minutes (3-minute demo delay).
 * Run: npm run spike:two-safe-variants
 */
import type { Address } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import {
  accountExecCall,
  accountSetupCalls,
  accountTxDigest,
  addOwnerCall,
  allowanceTransferCall,
  cancelEvictionCall,
  contractSignature,
  encodeSafeSignatures,
  evictionNewOwners,
  evictionTypedData,
  finalizeEvictionCall,
  handoverCall,
  kitSignature,
  predictAccountAddress,
  readAccount,
  replaceKeySafeCall,
  senderSignature,
  startEvictionCall,
} from '../src/lib/account'
import { publicClient } from '../src/lib/wallet'
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
  type Passkey,
} from './helpers/chain'

const report = createReport()
const { log, record } = report
const relayer = createRelayer()
const recipient = privateKeyToAccount(generatePrivateKey()).address as Address
const DAILY_LIMIT = 100n * TOKEN_UNIT
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && b.every((x) => a.map((y) => y.toLowerCase()).includes(x.toLowerCase()))

/** Fresh level-0 Account [Key Safe, Kit], funded with test tokens. */
async function createAccount(label: string, extra: Parameters<typeof keySafeSend>[1] = []) {
  const phone = newPasskey()
  const kit = privateKeyToAccount(generatePrivateKey())
  const kitGuardian = privateKeyToAccount(generatePrivateKey())
  const account = predictAccountAddress({ keySafe: phone.keySafe, kitOwner: kit.address })
  const tx = await keySafeSend(phone, [
    ...(await testTokenSetupCalls()),
    ...extra,
    ...(await accountSetupCalls(
      { keySafe: phone.keySafe, kitOwner: kit.address, kitGuardian: kitGuardian.address, dailyLimit: DAILY_LIMIT, level: 0, token: TEST_TOKEN },
      kit,
    )),
    mintCall(account, 1000n * TOKEN_UNIT),
  ])
  log(`${label}: Account ${account} (Key Safe ${phone.keySafe}) → ${txLink(tx)}`)
  return { phone, kit, kitGuardian, account }
}

const spend = (phone: Passkey, account: Address, amount: bigint) =>
  keySafeSend(phone, [allowanceTransferCall({ account, to: recipient, amount, keySafe: phone.keySafe, token: TEST_TOKEN })])

async function main() {
  // ── V1: default 2-owner Account, time-locked eviction ────────────────────
  const v1 = await createAccount('V1')
  let state = await readAccount(v1.account, { token: TEST_TOKEN })
  const evictionModule = state.evictionModule
  if (!evictionModule) throw new Error('V1: no eviction module')
  const newPhone = newPasskey()
  const newOwners = evictionNewOwners(state.owners, v1.phone.keySafe, newPhone.keySafe)

  const startEviction = async () => {
    const typed = await evictionTypedData(v1.account, evictionModule, newOwners)
    const signature = await v1.kitGuardian.signTypedData(typed)
    return relayer.send([startEvictionCall(v1.account, evictionModule, newOwners, [{ signer: v1.kitGuardian.address, signature }])])
  }

  const s1 = await startEviction()
  state = await readAccount(v1.account, { token: TEST_TOKEN })
  record('V1a', state.pendingEviction !== null && sameSet(state.pendingEviction.newOwners, newOwners),
    `2-owner Account: the Kit guardian key alone started the eviction → ${txLink(s1)}`)

  const cancel = cancelEvictionCall(evictionModule)
  const thiefCancel = accountExecCall(v1.account, cancel, encodeSafeSignatures([senderSignature(v1.phone.keySafe)]))
  const thiefFailed = await fails(() => keySafeSend(v1.phone, [thiefCancel]))
  state = await readAccount(v1.account, { token: TEST_TOKEN })
  record('V1b', thiefFailed && state.pendingEviction !== null,
    `thief (Key Safe alone) cancel: ${thiefFailed ? `refused — ${await revertReason(v1.phone.keySafe, thiefCancel)}` : 'NOT REFUSED'}, eviction still pending`)

  const ownerCancel = await keySafeSend(v1.phone, [
    accountExecCall(v1.account, cancel, encodeSafeSignatures([await kitSignature(v1.kit, v1.account, cancel, state.nonce), senderSignature(v1.phone.keySafe)])),
  ])
  state = await readAccount(v1.account, { token: TEST_TOKEN })
  record('V1c', state.pendingEviction === null, `owner cancelled with Face ID + Kit → ${txLink(ownerCancel)}`)

  const s2 = await startEviction()
  const { pendingEviction } = await readAccount(v1.account, { token: TEST_TOKEN })
  if (!pendingEviction) throw new Error('V1: eviction did not restart')
  log(`V1: eviction restarted, executable at ${new Date(pendingEviction.executeAfter * 1000).toISOString()} → ${txLink(s2)}`)

  // ── C4b while V1 waits: immediate eviction with Kit + security key ───────
  const securityKey = newPasskey()
  const keyProxy = verifierProxy(securityKey)
  const c4b = await createAccount('C4b', [deployVerifierProxyCall(securityKey)])
  let c4bState = await readAccount(c4b.account, { token: TEST_TOKEN })
  const addKey = addOwnerCall(c4b.account, keyProxy)
  await keySafeSend(c4b.phone, [
    accountExecCall(c4b.account, addKey, encodeSafeSignatures([await kitSignature(c4b.kit, c4b.account, addKey, c4bState.nonce), senderSignature(c4b.phone.keySafe)])),
  ])
  await spend(c4b.phone, c4b.account, 10n * TOKEN_UNIT) // the phone works before the theft
  c4bState = await readAccount(c4b.account, { token: TEST_TOKEN })

  const c4bNewPhone = newPasskey()
  const replace = replaceKeySafeCall({
    account: c4b.account,
    owners: c4bState.owners,
    oldKeySafe: c4b.phone.keySafe,
    newKeySafe: c4bNewPhone.keySafe,
    dailyLimit: DAILY_LIMIT,
    token: TEST_TOKEN,
  })
  const evictNow = await relayer.send([
    accountExecCall(c4b.account, replace, encodeSafeSignatures([
      await kitSignature(c4b.kit, c4b.account, replace, c4bState.nonce),
      contractSignature(keyProxy, webauthnContractSignature(securityKey, accountTxDigest(c4b.account, replace, c4bState.nonce))),
    ])),
  ])
  c4bState = await readAccount(c4b.account, { token: TEST_TOKEN, keySafe: c4bNewPhone.keySafe })
  const oldSpend = allowanceTransferCall({ account: c4b.account, to: recipient, amount: 1n * TOKEN_UNIT, keySafe: c4b.phone.keySafe, token: TEST_TOKEN })
  const oldRefused = await fails(() => keySafeSend(c4b.phone, [oldSpend]))
  const before = await tokenBalance(recipient)
  const newSpend = await spend(c4bNewPhone, c4b.account, 10n * TOKEN_UNIT)
  record('C4b',
    sameSet(c4bState.owners, [c4bNewPhone.keySafe, c4b.kit.address, keyProxy]) && c4bState.threshold === 2
      && c4bState.allowance?.amount === DAILY_LIMIT && oldRefused && (await tokenBalance(recipient)) - before === 10n * TOKEN_UNIT,
    `relayer swapped the Key Safe + moved the allowance with Kit + security key in ONE tx, no delay → ${txLink(evictNow)}; ` +
      `old Key Safe refused (${oldRefused ? await revertReason(c4b.phone.keySafe, oldSpend) : 'NOT REFUSED'}); new phone spent 10 → ${txLink(newSpend)}`)

  // ── V1 resumes: finalize after the delay, then handover ──────────────────
  for (;;) {
    const now = (await publicClient.getBlock()).timestamp
    if (now >= BigInt(pendingEviction.executeAfter)) break
    log(`V1: waiting for the delay… ${BigInt(pendingEviction.executeAfter) - now}s left`)
    await new Promise((r) => setTimeout(r, Math.min(30, Number(BigInt(pendingEviction.executeAfter) - now) + 2) * 1000))
  }
  const fin = await relayer.send([finalizeEvictionCall(v1.account, evictionModule)])
  state = await readAccount(v1.account, { token: TEST_TOKEN })
  record('V1d', sameSet(state.owners, newOwners) && state.threshold === 2 && state.pendingEviction === null,
    `after the delay, finalize (relayer) replaced the stolen Key Safe: owners = new Key Safe + Kit, threshold 2 → ${txLink(fin)}`)

  const handover = handoverCall({ oldKeySafe: v1.phone.keySafe, newKeySafe: newPhone.keySafe, dailyLimit: DAILY_LIMIT, token: TEST_TOKEN })
  const handoverTx = await keySafeSend(newPhone, [
    accountExecCall(v1.account, handover, encodeSafeSignatures([await kitSignature(v1.kit, v1.account, handover, state.nonce), senderSignature(newPhone.keySafe)])),
  ])
  const v1OldSpend = allowanceTransferCall({ account: v1.account, to: recipient, amount: 1n * TOKEN_UNIT, keySafe: v1.phone.keySafe, token: TEST_TOKEN })
  const v1OldRefused = await fails(() => keySafeSend(v1.phone, [v1OldSpend]))
  const v1Before = await tokenBalance(recipient)
  const v1NewSpend = await spend(newPhone, v1.account, 10n * TOKEN_UNIT)
  record('V1e', v1OldRefused && (await tokenBalance(recipient)) - v1Before === 10n * TOKEN_UNIT,
    `handover (new phone + Kit) → ${txLink(handoverTx)}; old Key Safe refused (${v1OldRefused ? await revertReason(v1.phone.keySafe, v1OldSpend) : 'NOT REFUSED'}); new phone spent 10 → ${txLink(v1NewSpend)}`)
}

main().then(() => report.finish(), (error) => report.finish(error))
