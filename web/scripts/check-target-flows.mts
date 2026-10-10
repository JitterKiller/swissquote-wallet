/**
 * On-chain check of the client logic behind the target flows (no UI), on Base Sepolia:
 *
 *  F1  #12 Face ID alone within the daily allowance (lib/spend limitSpendCalls).
 *  F2  #12 Above what is left today, Face ID alone is refused.
 *  F3  #12 Above the limit with the Kit: one 2-factor Account transaction (kitSpendCalls).
 *  F4  #13 New daily limit with phone + Kit (limitChangeCalls).
 *  F5  #16 Eviction started from a "new phone" (lib/eviction startEviction → /api/eviction); the thief
 *          holding only the old phone cannot cancel (GS020); phone + Kit cancel (cancelEvictionCalls).
 *  F6  #15 Eviction again, delay, finalize (finalizeEviction), handover by the new phone + Kit
 *          (handoverCalls): the new phone spends within the limit, the old one cannot, isEvicted.
 *  F7  #21 Level-0 Account upgraded to level 1 with phone + Kit (upgradeToLevel1Call): Swissquote
 *          is the second guardian, threshold 2.
 *
 * Passkeys are simulated (P-256 keys signing WebAuthn assertions), funds use a mintable test token.
 * Prereqs: `npm run dev` (the eviction endpoints and the server's Swissquote guardian). About 5 minutes.
 * Run: npm run check:target-flows
 */
import type { Address } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import {
  accountExecCall,
  accountSetupCalls,
  cancelEvictionCall,
  encodeSafeSignatures,
  predictAccountAddress,
  readAccount,
  senderSignature,
  twoFactorCall,
  upgradeToLevel1Call,
} from '../src/lib/account'
import { cancelEvictionCalls, finalizeEviction, handoverCalls, isEvicted, startEviction } from '../src/lib/eviction'
import { kitSpendCalls, limitChangeCalls, limitSpendCalls, spendRoute } from '../src/lib/spend'
import { publicClient } from '../src/lib/wallet'
import {
  TEST_TOKEN,
  TOKEN_UNIT,
  createReport,
  fails,
  keySafeSend,
  mintCall,
  newPasskey,
  testTokenSetupCalls,
  tokenBalance,
  txLink,
} from './helpers/chain'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const report = createReport()
const { log, record } = report
const token = TEST_TOKEN
const unit = TOKEN_UNIT

/** The app's API client, with absolute URLs for node. */
async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${APP_URL}${path}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
  return data as T
}

async function createAccount(dailyLimit: bigint) {
  const phone = newPasskey()
  const kit = privateKeyToAccount(generatePrivateKey())
  const kitGuardian = privateKeyToAccount(generatePrivateKey())
  const account = predictAccountAddress({ keySafe: phone.keySafe, kitOwner: kit.address })
  const tx = await keySafeSend(phone, [
    ...(await testTokenSetupCalls()),
    ...(await accountSetupCalls(
      { keySafe: phone.keySafe, kitOwner: kit.address, kitGuardian: kitGuardian.address, dailyLimit, level: 0, token },
      kit,
    )),
    mintCall(account, 1_000n * unit),
  ])
  log(`Account ${account} (limit ${dailyLimit / unit}, 1000 minted) → ${txLink(tx)}`)
  return { phone, kit, kitGuardian, account }
}

async function waitUntil(executeAfter: bigint) {
  for (;;) {
    const now = (await publicClient.getBlock()).timestamp
    if (now >= executeAfter) return
    log(`waiting for the lock-out delay… ${executeAfter - now}s left`)
    await new Promise((r) => setTimeout(r, Math.min(30, Number(executeAfter - now) + 2) * 1000))
  }
}

async function main() {
  const { guardian: swissquote } = await post<{ guardian: Address }>('/api/guardian')
  const a = await createAccount(100n * unit)
  const recipient = privateKeyToAccount(generatePrivateKey()).address

  // F1: within the allowance, Face ID alone.
  let state = await readAccount(a.account, { keySafe: a.phone.keySafe, token })
  const route60 = spendRoute(state, 1_000n * unit, 60n * unit)
  const f1 = await keySafeSend(a.phone, limitSpendCalls({ account: a.account, keySafe: a.phone.keySafe, to: recipient, amount: 60n * unit, token }))
  record('F1', route60 === 'limit' && (await tokenBalance(recipient)) === 60n * unit, `route "${route60}", 60 sent with Face ID alone → ${txLink(f1)}`)

  // F2: 60 more exceeds what is left (40): Face ID alone is refused.
  state = await readAccount(a.account, { keySafe: a.phone.keySafe, token })
  const route2 = spendRoute(state, 940n * unit, 60n * unit)
  const f2 = await fails(() => keySafeSend(a.phone, limitSpendCalls({ account: a.account, keySafe: a.phone.keySafe, to: recipient, amount: 60n * unit, token })))
  record('F2', route2 === 'kit' && f2, `route "${route2}" (left ${state.allowance?.remaining ? state.allowance.remaining / unit : 0}), Face ID alone refused on-chain`)

  // F3: above the limit with the Kit.
  const f3 = await keySafeSend(a.phone, await kitSpendCalls({ account: a.account, keySafe: a.phone.keySafe, to: recipient, amount: 300n * unit, kit: a.kit, token }))
  record('F3', (await tokenBalance(recipient)) === 360n * unit, `300 sent with phone + Kit (2-factor Account tx) → ${txLink(f3)}`)

  // F4: new limit with phone + Kit.
  const f4 = await keySafeSend(a.phone, await limitChangeCalls({ account: a.account, keySafe: a.phone.keySafe, dailyLimit: 250n * unit, kit: a.kit, token }))
  state = await readAccount(a.account, { keySafe: a.phone.keySafe, token })
  record('F4', state.allowance?.amount === 250n * unit, `daily limit now ${state.allowance?.amount ? state.allowance.amount / unit : '?'} → ${txLink(f4)}`)

  // F5: eviction from a new phone; the thief alone cannot cancel; phone + Kit can.
  const newPhone = newPasskey()
  const started = await startEviction({ account: a.account, oldKeySafe: a.phone.keySafe, newKeySafe: newPhone.keySafe, guardian: a.kitGuardian, post, token })
  state = await readAccount(a.account, { keySafe: a.phone.keySafe, token })
  const module = state.evictionModule as Address
  const thiefCall = cancelEvictionCall(module)
  const thiefCancel = await fails(() => keySafeSend(a.phone, [accountExecCall(a.account, thiefCall, encodeSafeSignatures([senderSignature(a.phone.keySafe)]))]))
  const f5 = await keySafeSend(a.phone, await cancelEvictionCalls({ account: a.account, keySafe: a.phone.keySafe, evictionModule: module, kit: a.kit }))
  const afterCancel = await readAccount(a.account, { token })
  record('F5', state.pendingEviction !== null && thiefCancel && afterCancel.pendingEviction === null,
    `eviction started (level ${started.level}) → ${txLink(started.txHash)}; phone alone cannot cancel; phone + Kit cancelled → ${txLink(f5)}`)

  // F6: eviction again, delay, finalize, handover.
  const again = await startEviction({ account: a.account, oldKeySafe: a.phone.keySafe, newKeySafe: newPhone.keySafe, guardian: a.kitGuardian, post, token })
  await waitUntil(BigInt(again.executeAfter))
  const finalized = await finalizeEviction(a.account, post)
  const handover = await keySafeSend(newPhone, await handoverCalls({
    account: a.account, oldKeySafe: a.phone.keySafe, newKeySafe: newPhone.keySafe, dailyLimit: again.dailyLimit ?? 250n * unit, kit: a.kit, token,
  }))
  const newState = await readAccount(a.account, { keySafe: newPhone.keySafe, token })
  const newSpend = await keySafeSend(newPhone, limitSpendCalls({ account: a.account, keySafe: newPhone.keySafe, to: recipient, amount: 10n * unit, token }))
  const oldSpend = await fails(() => keySafeSend(a.phone, limitSpendCalls({ account: a.account, keySafe: a.phone.keySafe, to: recipient, amount: 1n * unit, token })))
  record('F6',
    isEvicted(newState, a.phone.keySafe) && !isEvicted(newState, newPhone.keySafe) && newState.allowance?.delegate.toLowerCase() === newPhone.keySafe.toLowerCase() && oldSpend,
    `finalized → ${txLink(finalized.txHash)}; handover → ${txLink(handover)}; new phone spends within limit → ${txLink(newSpend)}; old phone refused`)

  // F7: upgrade a level-0 Account to level 1.
  const b = await createAccount(50n * unit)
  const bState = await readAccount(b.account, { keySafe: b.phone.keySafe, token })
  const call = upgradeToLevel1Call({ account: b.account, state: bState, kitGuardian: b.kitGuardian.address, swissquoteGuardian: swissquote })
  const f7 = await keySafeSend(b.phone, [await twoFactorCall({ account: b.account, keySafe: b.phone.keySafe, call, kit: b.kit })])
  const upgraded = await readAccount(b.account, { token })
  record('F7', upgraded.guardians.some((g) => g.toLowerCase() === swissquote.toLowerCase()) && upgraded.guardianThreshold === 2,
    `guardians ${upgraded.guardians.length}, threshold ${upgraded.guardianThreshold} (Kit + Swissquote) → ${txLink(f7)}`)

  report.finish()
}

main().catch((error) => report.finish(error))
