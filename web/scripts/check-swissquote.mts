/**
 * Swissquote account transfers (PDR-024, issue #19) against `npm run dev`.
 *  S1  A linked client sees the MOCK opening balance and the deposit address (= relayer Safe).
 *  S2  Unlinked clients are refused.
 *  S3  Withdrawing more than the account balance is refused.
 *  S4  "Move to my wallet": with a funded treasury, real USDC reaches the wallet; with an empty
 *      one, a 503 names the address to fund (Circle faucet, manual).
 *  S5  A deposit is only credited for a USDC transfer from the linked wallet: another
 *      transaction credits nothing, and the same hash cannot be credited twice.
 * Run: node scripts/check-swissquote.mts   (needs `npm run dev`)
 */
import { SafeMultiChainSigAccountV1 as SafeAccount } from 'abstractionkit'
import { P256, WebAuthnP256 } from 'ox'
import { createPublicClient, erc20Abi, hashTypedData, http, toHex, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'

const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address
const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') })
// Any confirmed transaction that does not move USDC from our test wallet (the spike's setup tx).
const FOREIGN_TX = '0x13a837658a4a5544786fc1d57d8dccd42c91e4d74fc06bfc5643d1e9f15e2732'

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
  const clientId = `sq-test-${Date.now().toString(36)}`
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

const me = await linkClient('Nina Weber')
const health = await call('GET', '/api/health')

// S1
const overview = await call('GET', `/api/swissquote/account?clientId=${me.clientId}`)
record('S1', overview.status === 200 && overview.data.balance === '1000000000' && overview.data.depositAddress === health.data.relayer,
  `balance ${Number(overview.data.balance) / 1e6} USDC (MOCK), deposit address = relayer ${overview.data.depositAddress}, treasury ${Number(overview.data.treasury) / 1e6} USDC`)

// S2
const stranger = await call('GET', `/api/swissquote/account?clientId=nobody-${Date.now()}`)
record('S2', stranger.status === 403, `unlinked client refused (${stranger.status})`)

// S3
const tooMuch = await call('POST', '/api/swissquote/withdraw', { clientId: me.clientId, amount: '5000' })
record('S3', tooMuch.status === 409, `withdraw above the account balance refused (${tooMuch.status}: ${tooMuch.data.error})`)

// S4
const before = await client.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [me.account] })
const withdraw = await call('POST', '/api/swissquote/withdraw', { clientId: me.clientId, amount: '1' })
if (BigInt(overview.data.treasury) >= 1_000_000n) {
  const after = await client.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [me.account] })
  record('S4', withdraw.status === 200 && after - before === 1_000_000n,
    `1 USDC moved on-chain to the wallet → https://sepolia.basescan.org/tx/${withdraw.data.txHash}`)
} else {
  record('S4', withdraw.status === 503 && String(withdraw.data.error).includes(overview.data.depositAddress),
    `treasury empty → 503 naming the address to fund ("${withdraw.data.error}")`)
}

// S5
const foreign = await call('POST', '/api/swissquote/deposit', { clientId: me.clientId, txHash: FOREIGN_TX })
const retry = await call('POST', '/api/swissquote/deposit', { clientId: me.clientId, txHash: FOREIGN_TX })
const balanceAfter = await call('GET', `/api/swissquote/account?clientId=${me.clientId}`)
const expected = withdraw.status === 200 ? '999000000' : '1000000000'
record('S5', foreign.status === 400 && retry.status === 400 && balanceAfter.data.balance === expected,
  `a transaction that is not a transfer from this wallet credits nothing (${foreign.status}: ${foreign.data.error})`)

await call('DELETE', `/api/wallets/me?clientId=${me.clientId}`)
const failed = results.filter(([, ok]) => !ok)
console.log(failed.length ? `\n${failed.length} check(s) failed` : `\nAll ${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
