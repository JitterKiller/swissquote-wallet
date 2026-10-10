/**
 * Wallet registry check (PDR-022, ADR-021) against `npm run dev`.
 *
 * Simulated passkey (ox, exact WebAuthn payload). The typed data is rebuilt here on purpose,
 * independently of src/lib/registry.ts, so a mismatch shows up as a failure.
 *  R1  A valid proof registers the wallet; GET /api/wallets/me returns the masked name.
 *  R2  Replaying the same challenge is refused.
 *  R3  A signature from another passkey is refused.
 *  R4  A proof signed on another origin (phishing site) is refused.
 *  R5  A Key Safe that does not belong to the passkey is refused.
 * Run: node scripts/check-registry.mts   (needs `npm run dev`)
 */
import { SafeMultiChainSigAccountV1 as SafeAccount } from 'abstractionkit'
import { P256, WebAuthnP256 } from 'ox'
import { hashTypedData, toHex, type Address, type Hex } from 'viem'

const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const CHAIN_ID = 84532n

type Key = { privateKey: Hex; x: bigint; y: bigint }
function newKey(): Key {
  const privateKey = P256.randomPrivateKey()
  const { x, y } = P256.getPublicKey({ privateKey })
  return { privateKey, x: BigInt(x), y: BigInt(y) }
}

const statement = (client: string, account: Address, keySafe: Address, nonce: Hex, issuedAt: bigint) =>
  hashTypedData({
    domain: { name: 'Swissquote Wallet Registry', version: '1', chainId: CHAIN_ID },
    types: {
      OwnershipProof: [
        { name: 'client', type: 'string' },
        { name: 'account', type: 'address' },
        { name: 'keySafe', type: 'address' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'issuedAt', type: 'uint64' },
      ],
    },
    primaryType: 'OwnershipProof',
    message: { client, account, keySafe, nonce, issuedAt },
  })

function sign(key: Key, challenge: Hex, origin = BASE) {
  const { metadata, payload } = WebAuthnP256.getSignPayload({ challenge, rpId: new URL(origin).hostname, origin })
  const signature = P256.sign({ payload, privateKey: key.privateKey, hash: true })
  return {
    authenticatorData: metadata.authenticatorData,
    clientDataJSON: metadata.clientDataJSON,
    signature: { r: toHex(BigInt(signature.r), { size: 32 }), s: toHex(BigInt(signature.s), { size: 32 }) },
  }
}

async function post(path: string, body: unknown) {
  const response = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

const results: [string, boolean, string][] = []
const record = (id: string, ok: boolean, detail: string) => {
  results.push([id, ok, detail])
  console.log(`${ok ? '✅' : '❌'} ${id} ${detail}`)
}

const owner = newKey()
const keySafe = SafeAccount.createAccountAddress([{ x: owner.x, y: owner.y }]) as Address
const account = keySafe // legacy single-Safe wallet (ADR-021): Account == Key Safe until ADR-017 ships
const clientId = `test-${Date.now()}`
const publicKey = { x: owner.x.toString(), y: owner.y.toString() }

async function attempt(signer: Key, opts: { origin?: string; keySafe?: Address } = {}) {
  const ks = opts.keySafe ?? keySafe
  const acc = opts.keySafe ?? account
  const { data: challenge } = await post('/api/wallets/challenge', { clientId, account: acc, keySafe: ks })
  const hash = statement(clientId, acc, ks, challenge.nonce, BigInt(challenge.issuedAt))
  const body = {
    clientId,
    displayName: 'Adam Meier',
    account: acc,
    keySafe: ks,
    publicKey,
    nonce: challenge.nonce,
    assertion: sign(signer, hash, opts.origin),
  }
  return { body, response: await post('/api/wallets', body) }
}

// R1
const ok = await attempt(owner)
const me = await (await fetch(`${BASE}/api/wallets/me?clientId=${clientId}`)).json()
record('R1', ok.response.status === 200 && me.maskedName === 'Adam M.' && me.account === account,
  `valid proof registered (status ${ok.response.status}, masked name "${me.maskedName}")`)

// R2
const replay = await post('/api/wallets', ok.body)
record('R2', replay.status === 403, `replayed challenge refused (status ${replay.status}: ${replay.data.error})`)

// R3
const forged = await attempt(newKey())
record('R3', forged.response.status === 403, `other passkey refused (status ${forged.response.status}: ${forged.response.data.error})`)

// R4
const phishing = await attempt(owner, { origin: 'https://swissquote-wallet.evil.example' })
record('R4', phishing.response.status === 403, `other origin refused (status ${phishing.response.status}: ${phishing.response.data.error})`)

// R5
const otherSafe = SafeAccount.createAccountAddress([{ x: newKey().x, y: newKey().y }]) as Address
const stolen = await attempt(owner, { keySafe: otherSafe })
record('R5', stolen.response.status === 403, `foreign Key Safe refused (status ${stolen.response.status}: ${stolen.response.data.error})`)

await fetch(`${BASE}/api/wallets/me?clientId=${clientId}`, { method: 'DELETE' })
const failed = results.filter(([, passed]) => !passed)
console.log(failed.length ? `\n${failed.length} check(s) failed` : `\nAll ${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
