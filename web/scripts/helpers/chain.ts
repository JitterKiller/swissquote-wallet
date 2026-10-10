/**
 * Shared helpers for on-chain check scripts (run with tsx so they can import src/lib).
 * Simulated passkeys (exact WebAuthn payload format, as smoke-passkey.mts), sponsored
 * UserOps from a Key Safe or a relayer, a TEST-ONLY token, and a small reporter.
 */
import {
  Erc7677Paymaster,
  SafeMultiChainSigAccountV1 as SafeAccount,
  fromSafeWebauthn,
  webauthnSignatureFromAssertion,
  type MetaTransaction,
  type WebauthnPublicKey,
} from 'abstractionkit'
import { Hex as OxHex, P256, WebAuthnP256 } from 'ox'
import { concat, encodeFunctionData, getContractAddress, pad, parseAbi, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { BUNDLER_URL, CHAIN_ID, NODE_URL, PAYMASTER_URL } from '../../src/lib/config'
import { isDeployed, publicClient } from '../../src/lib/wallet'

const paymaster = new Erc7677Paymaster(PAYMASTER_URL)

// ── Passkeys ────────────────────────────────────────────────────────────────
export type Passkey = { privateKey: Hex; publicKey: WebauthnPublicKey; keySafe: Address }

export function newPasskey(): Passkey {
  const privateKey = P256.randomPrivateKey()
  const { x, y } = P256.getPublicKey({ privateKey })
  const publicKey = { x: BigInt(x), y: BigInt(y) }
  return { privateKey, publicKey, keySafe: SafeAccount.createAccountAddress([publicKey]) as Address }
}

/** WebAuthn assertion over `challenge`, as a browser authenticator would produce it. */
export function assertion(passkey: Pick<Passkey, 'privateKey'>, challenge: Hex) {
  const { metadata, payload } = WebAuthnP256.getSignPayload({ challenge, rpId: 'localhost', origin: 'http://localhost:3000' })
  const signature = P256.sign({ payload, privateKey: passkey.privateKey, hash: true })
  return webauthnSignatureFromAssertion({
    authenticatorData: metadata.authenticatorData,
    clientDataJSON: metadata.clientDataJSON,
    signature: { r: BigInt(signature.r), s: BigInt(signature.s) },
  })
}

/** Security key: verifier proxy address and the Safe contract signature over a digest. */
export const verifierProxy = (passkey: Passkey) =>
  SafeAccount.createWebAuthnSignerVerifierAddress(passkey.publicKey.x, passkey.publicKey.y) as Address
export const deployVerifierProxyCall = (passkey: Passkey): MetaTransaction =>
  SafeAccount.createDeployWebAuthnVerifierMetaTransaction(passkey.publicKey.x, passkey.publicKey.y)
export const webauthnContractSignature = (passkey: Passkey, digest: Hex) =>
  SafeAccount.createWebAuthnSignature(assertion(passkey, digest)) as Hex

// ── Senders ─────────────────────────────────────────────────────────────────
async function waitFor(account: SafeAccount, op: Awaited<ReturnType<SafeAccount['createUserOperation']>>) {
  const receipt = await (await account.sendUserOperation(op, BUNDLER_URL)).included()
  if (!receipt) throw new Error('timeout waiting for inclusion')
  if (!receipt.success) throw new Error(`reverted on-chain ${receipt.receipt.transactionHash}`)
  return receipt.receipt.transactionHash
}

/** Sponsored UserOp from the passkey's Key Safe (deployed on its first UserOp). */
export async function keySafeSend(passkey: Passkey, calls: MetaTransaction[]) {
  const account = (await isDeployed(passkey.keySafe))
    ? new SafeAccount(passkey.keySafe)
    : SafeAccount.initializeNewAccount([passkey.publicKey])
  let op = await account.createUserOperation(calls, NODE_URL, BUNDLER_URL, { expectedSigners: [passkey.publicKey] })
  op = (await paymaster.createPaymasterUserOperation(account, op, BUNDLER_URL)).userOperation
  const signer = fromSafeWebauthn({
    publicKey: passkey.publicKey,
    isInit: op.nonce === 0n,
    accountClass: SafeAccount,
    getAssertion: async (challenge) => assertion(passkey, OxHex.fromBytes(challenge)),
  })
  op.signature = await account.signUserOperationWithSigners(op, [signer], CHAIN_ID)
  return waitFor(account, op)
}

/** A relayer (any third party) submitting pre-signed calls, like the Swissquote relayer (ADR-007). */
export function createRelayer() {
  const key = generatePrivateKey()
  const owner = privateKeyToAccount(key)
  const address = SafeAccount.createAccountAddress([owner.address]) as Address
  return {
    address,
    async send(calls: MetaTransaction[]) {
      const account = (await isDeployed(address)) ? new SafeAccount(address) : SafeAccount.initializeNewAccount([owner.address])
      let op = await account.createUserOperation(calls, NODE_URL, BUNDLER_URL)
      op = (await paymaster.createPaymasterUserOperation(account, op, BUNDLER_URL)).userOperation
      op.signature = account.signUserOperation(op, [key], CHAIN_ID)
      return waitFor(account, op)
    },
  }
}

// ── Test token (TEST ONLY: anyone can mint; source in scripts/spike-two-safe.mts) ──
const TOKEN_BYTECODE = '0x6080604052348015600e575f5ffd5b506105b88061001c5f395ff3fe608060405234801561000f575f5ffd5b506004361061009b575f3560e01c806340c10f191161006357806340c10f191461014857806370a082311461015d57806395d89b411461017c578063a9059cbb1461019f578063dd62ed3e146101b2575f5ffd5b806306fdde031461009f578063095ea7b3146100e257806318160ddd1461010557806323b872dd1461011b578063313ce5671461012e575b5f5ffd5b6100cc6040518060400160405280600e81526020016d14dc1a5ad94815195cdd081554d160921b81525081565b6040516100d99190610445565b60405180910390f35b6100f56100f0366004610495565b6101dc565b60405190151581526020016100d9565b61010d5f5481565b6040519081526020016100d9565b6100f56101293660046104bd565b610248565b610136600681565b60405160ff90911681526020016100d9565b61015b610156366004610495565b610332565b005b61010d61016b3660046104f7565b60016020525f908152604090205481565b6100cc604051806040016040528060048152602001631d1554d160e21b81525081565b6100f56101ad366004610495565b6103b7565b61010d6101c0366004610517565b600260209081525f928352604080842090915290825290205481565b335f8181526002602090815260408083206001600160a01b038716808552925280832085905551919290917f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925906102369086815260200190565b60405180910390a35060015b92915050565b6001600160a01b0383165f90815260026020908152604080832033845290915281208054839190839061027c90849061055c565b90915550506001600160a01b0384165f90815260016020526040812080548492906102a890849061055c565b90915550506001600160a01b0383165f90815260016020526040812080548492906102d490849061056f565b92505081905550826001600160a01b0316846001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8460405161032091815260200190565b60405180910390a35060019392505050565b805f5f828254610342919061056f565b90915550506001600160a01b0382165f908152600160205260408120805483929061036e90849061056f565b90915550506040518181526001600160a01b038316905f907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a35050565b335f908152600160205260408120805483919083906103d790849061055c565b90915550506001600160a01b0383165f908152600160205260408120805484929061040390849061056f565b90915550506040518281526001600160a01b0384169033907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef90602001610236565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f83011684010191505092915050565b80356001600160a01b0381168114610490575f5ffd5b919050565b5f5f604083850312156104a6575f5ffd5b6104af8361047a565b946020939093013593505050565b5f5f5f606084860312156104cf575f5ffd5b6104d88461047a565b92506104e66020850161047a565b929592945050506040919091013590565b5f60208284031215610507575f5ffd5b6105108261047a565b9392505050565b5f5f60408385031215610528575f5ffd5b6105318361047a565b915061053f6020840161047a565b90509250929050565b634e487b7160e01b5f52601160045260245ffd5b8181038181111561024257610242610548565b808201808211156102425761024261054856fea264697066735822122082d7d4778c8fbb99e63e75c5accfa1362e7448c253cc98f775aaf26ed17dc20d64736f6c634300081c0033' as Hex
const TOKEN_SALT = pad('0x535157', { size: 32 })
const CREATE2_DEPLOYER = '0x4e59b44847b379578588920ca78fbf26c0b4956c'
const tokenAbi = parseAbi(['function mint(address to, uint256 amount)', 'function balanceOf(address owner) view returns (uint256)'])

export const TEST_TOKEN = getContractAddress({ opcode: 'CREATE2', from: CREATE2_DEPLOYER, salt: TOKEN_SALT, bytecode: TOKEN_BYTECODE })
export const TOKEN_UNIT = 1_000_000n

export async function testTokenSetupCalls(): Promise<MetaTransaction[]> {
  return (await isDeployed(TEST_TOKEN)) ? [] : [{ to: CREATE2_DEPLOYER, value: 0n, data: concat([TOKEN_SALT, TOKEN_BYTECODE]) }]
}
export const mintCall = (to: Address, amount: bigint): MetaTransaction => ({
  to: TEST_TOKEN,
  value: 0n,
  data: encodeFunctionData({ abi: tokenAbi, functionName: 'mint', args: [to, amount] }),
})
export const tokenBalance = (owner: Address) =>
  publicClient.readContract({ address: TEST_TOKEN, abi: tokenAbi, functionName: 'balanceOf', args: [owner] })

// ── Reporting ───────────────────────────────────────────────────────────────
export const txLink = (hash: string) => `https://sepolia.basescan.org/tx/${hash}`

export function createReport() {
  const started = Date.now()
  const results: { id: string; ok: boolean }[] = []
  const log = (msg: string) => console.log(`[${String(Math.round((Date.now() - started) / 1000)).padStart(3)}s] ${msg}`)
  return {
    log,
    record(id: string, ok: boolean, detail: string) {
      results.push({ id, ok })
      log(`${ok ? '✅' : '❌'} ${id} — ${detail}`)
    },
    finish(error?: unknown) {
      if (error) {
        results.push({ id: 'ABORT', ok: false })
        log(`❌ ABORT — ${error instanceof Error ? `${error.message} ${JSON.stringify((error as { context?: unknown }).context ?? '')}`.slice(0, 600) : String(error)}`)
      }
      const failed = results.filter((r) => !r.ok)
      console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — FAILED: ${failed.map((f) => f.id).join(', ')}` : ''}`)
      process.exit(failed.length ? 1 : 0)
    },
  }
}

/** Runs `run` and reports whether it failed (a UserOp refused by the bundler or reverted). */
export async function fails(run: () => Promise<unknown>) {
  try {
    await run()
    return false
  } catch {
    return true
  }
}

/** Decoded revert reason of `call` executed from `from` (eth_call). */
export async function revertReason(from: Address, call: { to: string; data: string }) {
  try {
    await publicClient.call({ account: from, to: call.to as Address, data: call.data as Hex })
    return 'no revert'
  } catch (error) {
    const e = error as { details?: string; shortMessage?: string }
    return (e.details || e.shortMessage || String(error)).replace(/\s+/g, ' ').slice(0, 120)
  }
}
