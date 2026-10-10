/**
 * Swissquote sponsorship policy checks (issue #23) against `npm run dev`.
 *
 * Calls /api/paymaster with crafted UserOperations. "Forwarded" = the policy let it through to
 * the upstream paymaster (which may still reject a crafted op); "refused" = Swissquote's policy
 * answered itself (error.data.swissquote).
 *  P1  Level 0: 10 sponsored operations a month, the 11th is refused.
 *  P2  Security operations (recovery module, owner changes) stay sponsored after the quota.
 *  P3  A batch mixing a security call and a transfer counts as a transfer.
 *  P4  Transfers to a sanctioned address are refused, also inside execTransaction and as an
 *      allowance transfer.
 *  P5  A linked client (registry) is not limited.
 *  P6  A Key Safe reported stolen (identity session) loses sponsorship.
 * Run: node scripts/check-sponsorship.mts   (needs `npm run dev`)
 */
import { SafeMultiChainSigAccountV1 as SafeAccount, SocialRecoveryModuleGracePeriodSelector } from 'abstractionkit'
import { P256, WebAuthnP256 } from 'ox'
import {
  encodeFunctionData,
  encodePacked,
  hashTypedData,
  parseAbi,
  size,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'

const BASE = process.env.APP_URL ?? 'http://localhost:3000'
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as Address
const ALLOWANCE_MODULE = '0x691f59471Bfd2B7d639DCF74671a2d648ED1E331' as Address
const RECOVERY_MODULE = SocialRecoveryModuleGracePeriodSelector.After3Minutes as unknown as Address
const MULTISEND = '0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526' as Address
const SANCTIONED = '0x000000000000000000000000000000000000bad1' as Address
const SANCTIONED_2 = '0x000000000000000000000000000000000000bad2' as Address
const friend = privateKeyToAccount(generatePrivateKey()).address

const abi = parseAbi([
  'function executeUserOpWithErrorString(address to, uint256 value, bytes data, uint8 operation)',
  'function transfer(address to, uint256 amount)',
  'function cancelRecovery(address wallet)',
  'function addOwnerWithThreshold(address owner, uint256 threshold)',
  'function multiSend(bytes transactions)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)',
  'function executeAllowanceTransfer(address safe, address token, address to, uint96 amount, address paymentToken, uint96 payment, address delegate, bytes signature)',
])

type Inner = { to: Address; data: Hex; value?: bigint }
const transfer = (to: Address): Inner => ({ to: USDC, data: encodeFunctionData({ abi, functionName: 'transfer', args: [to, 1n] }) })
const exec = (inner: Inner, operation = 0) =>
  encodeFunctionData({ abi, functionName: 'executeUserOpWithErrorString', args: [inner.to, inner.value ?? 0n, inner.data, operation] })
const batch = (calls: Inner[]) => {
  const packed = calls.map((c) => encodePacked(['uint8', 'address', 'uint256', 'uint256', 'bytes'], [0, c.to, c.value ?? 0n, BigInt(size(c.data)), c.data]))
  return exec({ to: MULTISEND, data: encodeFunctionData({ abi, functionName: 'multiSend', args: [`0x${packed.map((p) => p.slice(2)).join('')}`] }) }, 1)
}
const userOp = (sender: Address, callData: Hex) => ({
  sender,
  nonce: '0x0',
  factory: null,
  factoryData: null,
  callData,
  callGasLimit: '0x0',
  verificationGasLimit: '0x0',
  preVerificationGas: '0x0',
  maxFeePerGas: '0x0',
  maxPriorityFeePerGas: '0x0',
  signature: '0x',
})

let rpcId = 0
async function paymaster(method: 'pm_getPaymasterStubData' | 'pm_getPaymasterData', op: ReturnType<typeof userOp>) {
  const response = await fetch(`${BASE}/api/paymaster`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params: [op, '0x433709009B8330FDa32311DF1C2AFA402eD8D009', '0x14a34', {}] }),
  })
  const json = await response.json()
  if (json.error?.code === -32603) throw new Error(`Proxy error on ${method}: ${json.error.message}`)
  return json.error?.data?.swissquote ? { refused: true as const, reason: json.error.data.reason as string } : { refused: false as const }
}
async function post(path: string, body: unknown) {
  const response = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: response.status, data: await response.json() }
}

const results: [string, boolean][] = []
const record = (id: string, ok: boolean, detail: string) => {
  results.push([id, ok])
  console.log(`${ok ? '✅' : '❌'} ${id} ${detail}`)
}
const randomSender = () => privateKeyToAccount(generatePrivateKey()).address

// P1
const level0 = randomSender()
const stub = await paymaster('pm_getPaymasterStubData', userOp(level0, exec(transfer(friend))))
let forwarded = 0
for (let i = 0; i < 10; i++) if (!(await paymaster('pm_getPaymasterData', userOp(level0, exec(transfer(friend))))).refused) forwarded++
const eleventh = await paymaster('pm_getPaymasterData', userOp(level0, exec(transfer(friend))))
record('P1', !stub.refused && forwarded === 10 && eleventh.refused && eleventh.reason === 'quota',
  `level 0: ${forwarded}/10 forwarded, 11th ${eleventh.refused ? `refused (${eleventh.reason})` : 'NOT refused'}`)

// P2
const cancel = await paymaster('pm_getPaymasterData', userOp(level0, exec({ to: RECOVERY_MODULE, data: encodeFunctionData({ abi, functionName: 'cancelRecovery', args: [level0] }) })))
const addOwner = await paymaster('pm_getPaymasterData', userOp(level0, exec({ to: level0, data: encodeFunctionData({ abi, functionName: 'addOwnerWithThreshold', args: [friend, 2n] }) })))
record('P2', !cancel.refused && !addOwner.refused, 'after the quota: cancelRecovery and addOwnerWithThreshold still sponsored')

// P3
const mixed = await paymaster('pm_getPaymasterData', userOp(level0, batch([
  { to: RECOVERY_MODULE, data: encodeFunctionData({ abi, functionName: 'cancelRecovery', args: [level0] }) },
  transfer(friend),
])))
record('P3', mixed.refused && mixed.reason === 'quota', `security call + transfer in one batch: ${mixed.refused ? `refused (${mixed.reason})` : 'NOT refused'}`)

// P4
const fresh = randomSender()
const direct = await paymaster('pm_getPaymasterStubData', userOp(fresh, exec(transfer(SANCTIONED))))
const account = randomSender()
const viaAccount = await paymaster('pm_getPaymasterStubData', userOp(fresh, exec({
  to: account,
  data: encodeFunctionData({ abi, functionName: 'execTransaction', args: [USDC, 0n, transfer(SANCTIONED).data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, '0x'] }),
})))
const allowance = await paymaster('pm_getPaymasterStubData', userOp(fresh, exec({
  to: ALLOWANCE_MODULE,
  data: encodeFunctionData({ abi, functionName: 'executeAllowanceTransfer', args: [account, USDC, SANCTIONED_2, 1n, zeroAddress, 0n, fresh, '0x'] }),
})))
record('P4', [direct, viaAccount, allowance].every((r) => r.refused && r.reason === 'sanctioned'),
  `sanctioned recipient refused: direct ${direct.refused}, inside execTransaction ${viaAccount.refused}, allowance transfer ${allowance.refused}`)

// P5 + P6: link a wallet in the registry (simulated passkey), then report it stolen.
const privateKey = P256.randomPrivateKey()
const { x, y } = P256.getPublicKey({ privateKey })
const keySafe = SafeAccount.createAccountAddress([{ x: BigInt(x), y: BigInt(y) }]) as Address
const clientId = `sponsor-test-${Date.now()}`
const { data: challenge } = await post('/api/wallets/challenge', { clientId, account: keySafe, keySafe })
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
const linked = await post('/api/wallets', {
  clientId, displayName: 'Lea Keller', account: keySafe, keySafe,
  publicKey: { x: BigInt(x).toString(), y: BigInt(y).toString() }, nonce: challenge.nonce,
  assertion: { authenticatorData: metadata.authenticatorData, clientDataJSON: metadata.clientDataJSON, signature: { r: toHex(BigInt(sig.r), { size: 32 }), s: toHex(BigInt(sig.s), { size: 32 }) } },
})
let linkedForwarded = 0
for (let i = 0; i < 11; i++) if (!(await paymaster('pm_getPaymasterData', userOp(keySafe, exec(transfer(friend))))).refused) linkedForwarded++
record('P5', linked.status === 200 && linkedForwarded === 11, `linked client: ${linkedForwarded}/11 operations forwarded (no quota)`)

const { data: kyc } = await post('/api/kyc', { wallet: keySafe, outcome: 'match' })
const report = await post('/api/report-stolen', { keySafe, account: keySafe, kycSessionId: kyc.sessionId })
const afterReport = await paymaster('pm_getPaymasterStubData', userOp(keySafe, exec({ to: RECOVERY_MODULE, data: encodeFunctionData({ abi, functionName: 'cancelRecovery', args: [keySafe] }) })))
const forged = await post('/api/report-stolen', { keySafe: randomSender(), account: randomSender(), kycSessionId: kyc.sessionId })
record('P6', report.status === 200 && afterReport.refused && afterReport.reason === 'reported-stolen' && forged.status === 403,
  `reported stolen (${report.data.via}): even a security op is refused; a report without proof is refused (${forged.status})`)

await fetch(`${BASE}/api/wallets/me?clientId=${clientId}`, { method: 'DELETE' })
const failed = results.filter(([, ok]) => !ok)
console.log(failed.length ? `\n${failed.length} check(s) failed` : `\nAll ${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
