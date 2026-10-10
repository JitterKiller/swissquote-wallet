/**
 * `@handle` checks (PDR-010, issue #20) against `npm run dev`. Clients are linked through the real
 * registry flow (ADR-021) with simulated passkeys.
 *  H1  Claim: unique, reserved names and bad formats refused, unlinked clients refused.
 *  H2  A linked client resolves @adam → Account + masked verified name; an unlinked one cannot.
 *  H3  "nobody": the handle answers exactly like a missing one (no enumeration).
 *  H4  "contacts": only clients added as contacts resolve it.
 *  H5  Lookups are rate-limited.
 *  H6  Changing handle frees the old one.
 * Run: node scripts/check-handles.mts   (needs `npm run dev`)
 */
import { SafeMultiChainSigAccountV1 as SafeAccount } from 'abstractionkit'
import { P256, WebAuthnP256 } from 'ox'
import { hashTypedData, toHex, type Address } from 'viem'

const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const run = Date.now().toString(36)

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(BASE + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, data: await response.json() }
}

async function linkClient(displayName: string) {
  const privateKey = P256.randomPrivateKey()
  const { x, y } = P256.getPublicKey({ privateKey })
  const keySafe = SafeAccount.createAccountAddress([{ x: BigInt(x), y: BigInt(y) }]) as Address
  const clientId = `handles-${run}-${displayName.split(' ')[0].toLowerCase()}`
  const { data: challenge } = await call('POST', '/api/wallets/challenge', { clientId, account: keySafe, keySafe })
  const hash = hashTypedData({
    domain: { name: 'Swissquote Wallet Registry', version: '1', chainId: 84532n },
    types: { OwnershipProof: [
      { name: 'client', type: 'string' }, { name: 'account', type: 'address' }, { name: 'keySafe', type: 'address' },
      { name: 'nonce', type: 'bytes32' }, { name: 'issuedAt', type: 'uint64' },
    ] },
    primaryType: 'OwnershipProof',
    message: { client: clientId, account: keySafe, keySafe, nonce: challenge.nonce, issuedAt: BigInt(challenge.issuedAt) },
  })
  const { metadata, payload } = WebAuthnP256.getSignPayload({ challenge: hash, rpId: new URL(BASE).hostname, origin: BASE })
  const sig = P256.sign({ payload, privateKey, hash: true })
  const linked = await call('POST', '/api/wallets', {
    clientId, displayName, account: keySafe, keySafe,
    publicKey: { x: BigInt(x).toString(), y: BigInt(y).toString() }, nonce: challenge.nonce,
    assertion: { authenticatorData: metadata.authenticatorData, clientDataJSON: metadata.clientDataJSON, signature: { r: toHex(BigInt(sig.r), { size: 32 }), s: toHex(BigInt(sig.s), { size: 32 }) } },
  })
  if (linked.status !== 200) throw new Error(`link failed: ${JSON.stringify(linked.data)}`)
  return { clientId, account: keySafe }
}

const results: [string, boolean][] = []
const record = (id: string, ok: boolean, detail: string) => {
  results.push([id, ok])
  console.log(`${ok ? '✅' : '❌'} ${id} ${detail}`)
}
const resolve = (resolver: string, handle: string) => call('GET', `/api/handles/${handle}?clientId=${resolver}`)

const adam = await linkClient('Adam Meier')
const lea = await linkClient('Lea Keller')
const tom = await linkClient('Tom Frei')
const h = (base: string) => `${base}${run}`.slice(0, 20)
const adamHandle = h('adam')

// H1
const claimed = await call('POST', '/api/handles', { clientId: adam.clientId, handle: `@${adamHandle}` })
const taken = await call('POST', '/api/handles', { clientId: lea.clientId, handle: adamHandle })
const reserved = await call('POST', '/api/handles', { clientId: lea.clientId, handle: 'support' })
const badFormat = await call('POST', '/api/handles', { clientId: lea.clientId, handle: 'a!' })
const unlinked = await call('POST', '/api/handles', { clientId: `nobody-${run}`, handle: h('ghost') })
record('H1', claimed.status === 200 && taken.status === 409 && reserved.status === 400 && badFormat.status === 400 && unlinked.status === 403,
  `claim ${claimed.status}, taken ${taken.status}, reserved ${reserved.status}, bad format ${badFormat.status}, unlinked ${unlinked.status}`)

// H2
const seen = await resolve(lea.clientId, adamHandle)
const anonymous = await resolve(`nobody-${run}`, adamHandle)
record('H2', seen.status === 200 && seen.data.maskedName === 'Adam M.' && seen.data.account === adam.account && anonymous.status === 403,
  `Lea sees "${seen.data.maskedName}" → ${seen.data.account?.slice(0, 10)}…; unlinked resolver ${anonymous.status}`)

// H3
await call('PATCH', '/api/handles', { clientId: adam.clientId, visibility: 'nobody' })
const hidden = await resolve(lea.clientId, adamHandle)
const missing = await resolve(lea.clientId, h('nosuch'))
const self = await resolve(adam.clientId, adamHandle)
record('H3', hidden.status === 404 && missing.status === 404 && hidden.data.error === missing.data.error && self.status === 200,
  `hidden ${hidden.status} "${hidden.data.error}" = missing ${missing.status}; owner still sees it (${self.status})`)

// H4
await call('PATCH', '/api/handles', { clientId: adam.clientId, visibility: 'contacts' })
await call('POST', '/api/handles', { clientId: lea.clientId, handle: h('lea') })
const before = await resolve(lea.clientId, adamHandle)
await call('POST', '/api/handles/contacts', { clientId: adam.clientId, contactHandle: h('lea') })
const after = await resolve(lea.clientId, adamHandle)
const stranger = await resolve(tom.clientId, adamHandle)
record('H4', before.status === 404 && after.status === 200 && stranger.status === 404,
  `contacts only: Lea before ${before.status}, after being added ${after.status}; Tom ${stranger.status}`)

// H5
let limited = 0
for (let i = 0; i < 32; i++) if ((await resolve(tom.clientId, h('nosuch'))).status === 429) limited++
record('H5', limited > 0, `${limited} of 32 rapid lookups refused with 429`)

// H6
const changed = await call('POST', '/api/handles', { clientId: adam.clientId, handle: h('adamm') })
const reclaimed = await call('POST', '/api/handles', { clientId: tom.clientId, handle: adamHandle })
record('H6', changed.status === 200 && changed.data.handle === h('adamm') && reclaimed.status === 200,
  `Adam moved to @${changed.data.handle}; the old handle is claimable again (${reclaimed.status})`)

for (const client of [adam, lea, tom]) {
  await call('DELETE', `/api/handles?clientId=${client.clientId}`)
  await call('DELETE', `/api/wallets/me?clientId=${client.clientId}`)
}
const failed = results.filter(([, ok]) => !ok)
console.log(failed.length ? `\n${failed.length} check(s) failed` : `\nAll ${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
