/**
 * Acceptance check for issue #14: the eviction endpoints over HTTP, on Base Sepolia.
 *
 *  E1  Policy: a request that would evict the Kit (not the phone) is refused.
 *  E2  A signature from a non-guardian is refused.
 *  E3  Level 0: POST /api/eviction with the Kit guardian's signature → pending on-chain.
 *  E4  A second eviction while one is pending is refused (409).
 *  E5  Level 1: refused without identity verification, then accepted with a verified KYC
 *      session; Swissquote co-signed (2 approvals on-chain).
 *  E6  Finalize before the delay is refused (409).
 *  E7  After the delay, POST /api/eviction/finalize replaces the phone on both Accounts.
 *
 * Prereqs: `npm run dev` (same machine, so the server's Swissquote guardian is used).
 * About 4 minutes (3-minute demo delay). Run: npm run check:eviction-api
 */
import type { Address, Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

import { accountSetupCalls, evictionNewOwners, evictionTypedData, predictAccountAddress, readAccount } from '../src/lib/account'
import { publicClient } from '../src/lib/wallet'
import { TEST_TOKEN, TOKEN_UNIT, createReport, keySafeSend, newPasskey, testTokenSetupCalls, txLink } from './helpers/chain'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const report = createReport()
const { log, record } = report

async function api(path: string, body?: unknown) {
  const response = await fetch(`${APP_URL}${path}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: (await response.json().catch(() => ({}))) as Record<string, unknown> }
}

async function createAccount(level: 0 | 1, swissquoteGuardian?: Address) {
  const phone = newPasskey()
  const kit = privateKeyToAccount(generatePrivateKey())
  const kitGuardian = privateKeyToAccount(generatePrivateKey())
  const account = predictAccountAddress({ keySafe: phone.keySafe, kitOwner: kit.address })
  const tx = await keySafeSend(phone, [
    ...(await testTokenSetupCalls()),
    ...(await accountSetupCalls(
      { keySafe: phone.keySafe, kitOwner: kit.address, kitGuardian: kitGuardian.address, dailyLimit: 100n * TOKEN_UNIT, level, swissquoteGuardian, token: TEST_TOKEN },
      kit,
    )),
  ])
  log(`Level ${level} Account ${account} → ${txLink(tx)}`)
  return { phone, kit, kitGuardian, account }
}

async function evictionRequest(a: { account: Address; phone: { keySafe: Address } }, signer: PrivateKeyAccount, newOwners?: Address[]) {
  const state = await readAccount(a.account)
  const owners = newOwners ?? evictionNewOwners(state.owners, a.phone.keySafe, newPasskey().keySafe)
  const typed = await evictionTypedData(a.account, state.evictionModule as Address, owners)
  return { account: a.account, newOwners: owners, guardianSignature: (await signer.signTypedData(typed)) as Hex }
}

async function main() {
  const { data: guardianInfo } = await api('/api/guardian')
  const swissquote = guardianInfo.guardian as Address
  log(`Server Swissquote guardian ${swissquote}`)

  const l0 = await createAccount(0)
  const l1 = await createAccount(1, swissquote)

  // E1: evicting the Kit instead of the phone.
  const l0State = await readAccount(l0.account)
  const kitEvicted = evictionNewOwners(l0State.owners, l0.kit.address, privateKeyToAccount(generatePrivateKey()).address)
  const e1 = await api('/api/eviction', await evictionRequest(l0, l0.kitGuardian, kitEvicted))
  record('E1', e1.status === 403, `request evicting the Kit → ${e1.status} "${e1.data.error}"`)

  // E2: signature from a non-guardian.
  const e2 = await api('/api/eviction', await evictionRequest(l0, privateKeyToAccount(generatePrivateKey())))
  record('E2', e2.status === 403, `signature from a non-guardian → ${e2.status} "${e2.data.error}"`)

  // E3: level 0, valid request.
  const e3 = await api('/api/eviction', await evictionRequest(l0, l0.kitGuardian))
  const pending0 = (await readAccount(l0.account)).pendingEviction
  record('E3', e3.status === 200 && e3.data.level === 0 && pending0 !== null && pending0.approvals === 1,
    `level 0: relayed with the Kit guardian signature, pending until ${new Date(Number(e3.data.executeAfter) * 1000).toISOString()} → ${txLink(String(e3.data.txHash))}`)

  // E4: a second eviction while one is pending.
  const e4 = await api('/api/eviction', await evictionRequest(l0, l0.kitGuardian))
  record('E4', e4.status === 409, `second eviction while pending → ${e4.status} "${e4.data.error}"`)

  // E5: level 1 needs identity verification, then Swissquote co-signs.
  const l1Request = await evictionRequest(l1, l1.kitGuardian)
  const noKyc = await api('/api/eviction', l1Request)
  const { data: kyc } = await api('/api/kyc', { wallet: l1.account, outcome: 'match' })
  const e5 = await api('/api/eviction', { ...l1Request, kycSessionId: kyc.sessionId })
  const pending1 = (await readAccount(l1.account)).pendingEviction
  record('E5', noKyc.status === 403 && e5.status === 200 && e5.data.level === 1 && pending1?.approvals === 2,
    `level 1: without KYC → ${noKyc.status} "${noKyc.data.error}"; with a verified session → relayed, Swissquote co-signed (approvals ${pending1?.approvals}) → ${txLink(String(e5.data.txHash))}`)

  // E6: too early.
  const e6 = await api('/api/eviction/finalize', { account: l0.account })
  record('E6', e6.status === 409, `finalize before the delay → ${e6.status} "${e6.data.error}"`)

  // E7: after the delay.
  const executeAfter = BigInt(Math.max(pending0?.executeAfter ?? 0, pending1?.executeAfter ?? 0))
  for (;;) {
    const now = (await publicClient.getBlock()).timestamp
    if (now >= executeAfter) break
    log(`waiting for the delay… ${executeAfter - now}s left`)
    await new Promise((r) => setTimeout(r, Math.min(30, Number(executeAfter - now) + 2) * 1000))
  }
  const f0 = await api('/api/eviction/finalize', { account: l0.account })
  const f1 = await api('/api/eviction/finalize', { account: l1.account })
  const [s0, s1] = await Promise.all([readAccount(l0.account), readAccount(l1.account)])
  const replaced = (s: typeof s0, keySafe: Address) => s.pendingEviction === null && !s.owners.some((o) => o.toLowerCase() === keySafe.toLowerCase()) && s.owners.length === 2
  record('E7', f0.status === 200 && f1.status === 200 && replaced(s0, l0.phone.keySafe) && replaced(s1, l1.phone.keySafe),
    `finalized both: the old phones are no longer owners → ${txLink(String(f0.data.txHash))} , ${txLink(String(f1.data.txHash))}`)
}

main().then(() => report.finish(), (error) => report.finish(error))
