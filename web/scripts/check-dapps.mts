/**
 * Approved dApps (PDR-025, ADR-028, issue #25) on Base Sepolia with real Circle USDC:
 *
 *  D1  Aave v3: deposit 1 USDC from the Account with phone + Kit (exact approval + supply).
 *  D2  Face ID alone cannot run a dApp action (GS020).
 *  D3  Aave v3: withdraw the whole position back to the Account.
 *  D4  Compound III: deposit 1 USDC with phone + Kit.
 *  D5  Compound III: withdraw the whole position back to the Account.
 *  D6  Paymaster: an approved dApp is sponsored by the policy, an unapproved contract is refused
 *      ("unapproved-dapp").
 *
 * The test Account is funded with 2 USDC from the Swissquote demo treasury (registry link +
 * /api/swissquote/withdraw) and sends them back at the end. Prereqs: `npm run dev`, a funded
 * treasury. About 2 minutes. Run: npm run check:dapps
 */
import { SafeMultiChainSigAccountV1 as SafeAccount } from 'abstractionkit'
import { P256, WebAuthnP256 } from 'ox'
import { encodeFunctionData, erc20Abi, hashTypedData, parseAbi, toHex, zeroAddress, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { accountExecCall, accountSetupCalls, encodeSafeSignatures, predictAccountAddress, senderSignature } from '../src/lib/account'
import { USDC_ADDRESS } from '../src/lib/config'
import { APPROVED_DAPPS, dappActionCall, dappActionCalls, readDappPosition } from '../src/lib/dapps'
import { limitSpendCalls } from '../src/lib/spend'
import { publicClient } from '../src/lib/wallet'
import { createReport, fails, keySafeSend, newPasskey, txLink, type Passkey } from './helpers/chain'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const report = createReport()
const { log, record } = report
const USDC = 1_000_000n

async function call<T = Record<string, unknown>>(path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const response = await fetch(`${APP_URL}${path}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: (await response.json().catch(() => ({}))) as T }
}

const usdcBalance = (owner: Address) =>
  publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [owner] })

/** Registry link (PDR-022): the phone's passkey signs the ownership statement for the Account. */
async function link(phone: Passkey, account: Address) {
  const clientId = `sq-dapps-${Date.now().toString(36)}`
  const { data: challenge } = await call<{ nonce: Hex; issuedAt: string }>('/api/wallets/challenge', { clientId, account, keySafe: phone.keySafe })
  const hash = hashTypedData({
    domain: { name: 'Swissquote Wallet Registry', version: '1', chainId: 84532n },
    types: { OwnershipProof: [
      { name: 'client', type: 'string' }, { name: 'account', type: 'address' }, { name: 'keySafe', type: 'address' },
      { name: 'nonce', type: 'bytes32' }, { name: 'issuedAt', type: 'uint64' },
    ] },
    primaryType: 'OwnershipProof',
    message: { client: clientId, account, keySafe: phone.keySafe, nonce: challenge.nonce, issuedAt: BigInt(challenge.issuedAt) },
  })
  const { metadata, payload } = WebAuthnP256.getSignPayload({ challenge: hash, rpId: new URL(APP_URL).hostname, origin: APP_URL })
  const sig = P256.sign({ payload, privateKey: phone.privateKey, hash: true })
  const linked = await call('/api/wallets', {
    clientId, displayName: 'dApp Check', account, keySafe: phone.keySafe,
    publicKey: { x: phone.publicKey.x.toString(), y: phone.publicKey.y.toString() }, nonce: challenge.nonce,
    assertion: { authenticatorData: metadata.authenticatorData, clientDataJSON: metadata.clientDataJSON, signature: { r: toHex(BigInt(sig.r), { size: 32 }), s: toHex(BigInt(sig.s), { size: 32 }) } },
  })
  if (linked.status !== 200) throw new Error(`link failed: ${JSON.stringify(linked.data)}`)
  return clientId
}

/** Ask the Swissquote paymaster to sponsor a crafted UserOp running `inner` through the Account. */
async function paymasterVerdict(sender: Address, account: Address, inner: { to: Address; data: Hex }) {
  const exec = encodeFunctionData({
    abi: parseAbi(['function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures)']),
    functionName: 'execTransaction',
    args: [inner.to, 0n, inner.data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, '0x'],
  })
  const callData = encodeFunctionData({
    abi: parseAbi(['function executeUserOpWithErrorString(address to, uint256 value, bytes data, uint8 operation)']),
    functionName: 'executeUserOpWithErrorString',
    args: [account, 0n, exec, 0],
  })
  const { data } = await call<{ error?: { data?: { swissquote?: boolean; reason?: string } } }>('/api/paymaster', {
    jsonrpc: '2.0', id: 1, method: 'pm_getPaymasterStubData',
    params: [{ sender, nonce: '0x0', callData }, SafeAccount.DEFAULT_ENTRYPOINT_ADDRESS, '0x14a34', {}],
  })
  return { refused: data.error?.data?.swissquote === true, reason: data.error?.data?.reason }
}

async function main() {
  const { data: info } = await call<{ guardian: Address; relayer: Address }>('/api/guardian')
  const treasury = info.relayer
  log(`Treasury ${treasury}: ${(await usdcBalance(treasury)) / USDC} USDC`)

  // Account (level 0, real USDC limit), linked, funded with 2 USDC from the treasury.
  const phone = newPasskey()
  const kit = privateKeyToAccount(generatePrivateKey())
  const kitGuardian = privateKeyToAccount(generatePrivateKey())
  const account = predictAccountAddress({ keySafe: phone.keySafe, kitOwner: kit.address })
  const setup = await keySafeSend(phone, await accountSetupCalls(
    { keySafe: phone.keySafe, kitOwner: kit.address, kitGuardian: kitGuardian.address, dailyLimit: 50n * USDC, level: 0 },
    kit,
  ))
  const clientId = await link(phone, account)
  const funded = await call<{ txHash?: string; error?: string }>('/api/swissquote/withdraw', { clientId, amount: '2' })
  if (funded.status !== 200) throw new Error(`funding failed: ${funded.data.error}`)
  log(`Account ${account} → ${txLink(setup)}; funded with 2 USDC → ${txLink(String(funded.data.txHash))}`)

  const [aave, compound] = APPROVED_DAPPS
  const before = await usdcBalance(account)

  // D1: Aave deposit with phone + Kit.
  const d1 = await keySafeSend(phone, await dappActionCalls({ dapp: aave, action: 'deposit', account, keySafe: phone.keySafe, amount: 1n * USDC, kit }))
  const aavePos = await readDappPosition(aave, account)
  record('D1', aavePos.supplied >= 1n * USDC - 1n, `Aave position ${Number(aavePos.supplied) / 1e6} USDC (APY ${(aavePos.apy * 100).toFixed(2)}%) → ${txLink(d1)}`)

  // D2: Face ID alone cannot run a dApp action.
  const alone = accountExecCall(account, dappActionCall({ dapp: compound, action: 'deposit', account, amount: 1n * USDC }), encodeSafeSignatures([senderSignature(phone.keySafe)]))
  record('D2', await fails(() => keySafeSend(phone, [alone])), 'Face ID alone refused for a dApp deposit (GS020)')

  // D3: Aave withdraw everything.
  const d3 = await keySafeSend(phone, await dappActionCalls({ dapp: aave, action: 'withdraw', account, keySafe: phone.keySafe, amount: 'max', kit }))
  const aaveAfter = await readDappPosition(aave, account)
  record('D3', aaveAfter.supplied === 0n && (await usdcBalance(account)) >= before, `Aave position back to 0, USDC back in the Account → ${txLink(d3)}`)

  // D4: Compound deposit with phone + Kit.
  const d4 = await keySafeSend(phone, await dappActionCalls({ dapp: compound, action: 'deposit', account, keySafe: phone.keySafe, amount: 1n * USDC, kit }))
  const compPos = await readDappPosition(compound, account)
  record('D4', compPos.supplied >= 1n * USDC - 2n, `Compound position ${Number(compPos.supplied) / 1e6} USDC (APY ${(compPos.apy * 100).toFixed(2)}%) → ${txLink(d4)}`)

  // D5: Compound withdraw everything.
  const d5 = await keySafeSend(phone, await dappActionCalls({ dapp: compound, action: 'withdraw', account, keySafe: phone.keySafe, amount: 'max', kit }))
  const compAfter = await readDappPosition(compound, account)
  record('D5', compAfter.supplied === 0n, `Compound position back to 0 → ${txLink(d5)}`)

  // D6: sponsorship policy.
  const approved = await paymasterVerdict(phone.keySafe, account, { to: aave.contracts[0], data: '0x12345678' })
  const unapproved = await paymasterVerdict(phone.keySafe, account, { to: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4', data: '0x12345678' })
  record('D6', !approved.refused && unapproved.refused && unapproved.reason === 'unapproved-dapp',
    `approved dApp ${approved.refused ? `refused (${approved.reason})` : 'sponsored by the policy'}; unapproved contract ${unapproved.refused ? `refused (${unapproved.reason})` : 'NOT refused'}`)

  // Send the USDC back to the treasury (Face ID alone, within the limit).
  const left = await usdcBalance(account)
  if (left > 0n) {
    const back = await keySafeSend(phone, limitSpendCalls({ account, keySafe: phone.keySafe, to: treasury, amount: left }))
    log(`Returned ${Number(left) / 1e6} USDC to the treasury → ${txLink(back)}`)
  }
  report.finish()
}

main().catch((error) => report.finish(error))
