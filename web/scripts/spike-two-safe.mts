/**
 * Spike — ADR-017 (two-Safe account) + ADR-019 (time-locked eviction), on Base Sepolia.
 *
 * Real sponsored UserOps, simulated passkeys (ox, as in smoke-passkey.mts):
 *  C1  The Key Safe spends within its daily allowance (Allowance Module, delegate = msg.sender),
 *      with the SDK's default `v = 1` delegate signature and with an empty signature.
 *  C2  Spending above the remaining allowance reverts.
 *  C3  A Key Safe UserOp runs account.execTransaction with the Kit's ECDSA signature + v = 1.
 *  C4  A relayer runs account.execTransaction with the Kit + the hardware key's WebAuthn
 *      contract signature, without the Key Safe (large payment / eviction path, PDR-017).
 *  C5  Time-locked eviction (ADR-019): the Kit's guardian key alone starts a recovery on the
 *      Account; the Key Safe alone cannot cancel it; 2 factors can; after the delay the
 *      recovery replaces the Key Safe, the new Key Safe takes over the allowance and the old
 *      one can no longer spend.
 *
 * Funds: SpikeToken, a TEST-ONLY token anyone can mint (source below), deployed once at a
 * deterministic address. The Allowance Module is token-agnostic.
 *
 * Takes ~5 minutes (3-minute recovery delay). Run: node scripts/spike-two-safe.mts
 *
 * SpikeToken (solc 0.8.28, optimizer 200, evm cancun):
 *   contract SpikeToken {
 *     string public constant name = "Spike Test USD"; string public constant symbol = "tUSD";
 *     uint8 public constant decimals = 6; uint256 public totalSupply;
 *     mapping(address => uint256) public balanceOf;
 *     mapping(address => mapping(address => uint256)) public allowance;
 *     function mint(address to, uint256 amount) external { totalSupply += amount; balanceOf[to] += amount; emit Transfer(address(0), to, amount); }
 *     function transfer(address to, uint256 amount) external returns (bool) { balanceOf[msg.sender] -= amount; balanceOf[to] += amount; emit Transfer(msg.sender, to, amount); return true; }
 *     function approve(...) / transferFrom(...) // standard
 *   }
 */
import {
  AllowanceModule,
  EXECUTE_RECOVERY_PRIMARY_TYPE,
  Erc7677Paymaster,
  SafeMultiChainSigAccountV1 as SafeAccount,
  SocialRecoveryModule,
  SocialRecoveryModuleGracePeriodSelector,
  fromSafeWebauthn,
  webauthnSignatureFromAssertion,
  type MetaTransaction,
  type WebauthnPublicKey,
} from 'abstractionkit'
import { Hex as OxHex, P256, WebAuthnP256 } from 'ox'
import {
  concat,
  createPublicClient,
  encodeFunctionData,
  getContractAddress,
  hashTypedData,
  http,
  pad,
  parseAbi,
  toHex,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const CHAIN_ID = 84532n
const NODE_URL = 'https://sepolia.base.org'
const BUNDLER_URL = 'https://api.candide.dev/public/v3/84532'
const PAYMASTER_URL = BUNDLER_URL

// Safe v1.4.1 canonical deployments (checked on Base Sepolia).
const SAFE_L2_141 = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762'
const PROXY_FACTORY_141 = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67'
const FALLBACK_HANDLER_141 = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99'
const SAFE_MODULE_SETUP = '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47' // enableModules(address[])
const CREATE2_DEPLOYER = '0x4e59b44847b379578588920ca78fbf26c0b4956c'
const RECOVERY_MODULE = SocialRecoveryModuleGracePeriodSelector.After3Minutes

const TOKEN_BYTECODE = '0x6080604052348015600e575f5ffd5b506105b88061001c5f395ff3fe608060405234801561000f575f5ffd5b506004361061009b575f3560e01c806340c10f191161006357806340c10f191461014857806370a082311461015d57806395d89b411461017c578063a9059cbb1461019f578063dd62ed3e146101b2575f5ffd5b806306fdde031461009f578063095ea7b3146100e257806318160ddd1461010557806323b872dd1461011b578063313ce5671461012e575b5f5ffd5b6100cc6040518060400160405280600e81526020016d14dc1a5ad94815195cdd081554d160921b81525081565b6040516100d99190610445565b60405180910390f35b6100f56100f0366004610495565b6101dc565b60405190151581526020016100d9565b61010d5f5481565b6040519081526020016100d9565b6100f56101293660046104bd565b610248565b610136600681565b60405160ff90911681526020016100d9565b61015b610156366004610495565b610332565b005b61010d61016b3660046104f7565b60016020525f908152604090205481565b6100cc604051806040016040528060048152602001631d1554d160e21b81525081565b6100f56101ad366004610495565b6103b7565b61010d6101c0366004610517565b600260209081525f928352604080842090915290825290205481565b335f8181526002602090815260408083206001600160a01b038716808552925280832085905551919290917f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925906102369086815260200190565b60405180910390a35060015b92915050565b6001600160a01b0383165f90815260026020908152604080832033845290915281208054839190839061027c90849061055c565b90915550506001600160a01b0384165f90815260016020526040812080548492906102a890849061055c565b90915550506001600160a01b0383165f90815260016020526040812080548492906102d490849061056f565b92505081905550826001600160a01b0316846001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8460405161032091815260200190565b60405180910390a35060019392505050565b805f5f828254610342919061056f565b90915550506001600160a01b0382165f908152600160205260408120805483929061036e90849061056f565b90915550506040518181526001600160a01b038316905f907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a35050565b335f908152600160205260408120805483919083906103d790849061055c565b90915550506001600160a01b0383165f908152600160205260408120805484929061040390849061056f565b90915550506040518281526001600160a01b0384169033907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef90602001610236565b602081525f82518060208401528060208501604085015e5f604082850101526040601f19601f83011684010191505092915050565b80356001600160a01b0381168114610490575f5ffd5b919050565b5f5f604083850312156104a6575f5ffd5b6104af8361047a565b946020939093013593505050565b5f5f5f606084860312156104cf575f5ffd5b6104d88461047a565b92506104e66020850161047a565b929592945050506040919091013590565b5f60208284031215610507575f5ffd5b6105108261047a565b9392505050565b5f5f60408385031215610528575f5ffd5b6105318361047a565b915061053f6020840161047a565b90509250929050565b634e487b7160e01b5f52601160045260245ffd5b8181038181111561024257610242610548565b808201808211156102425761024261054856fea264697066735822122082d7d4778c8fbb99e63e75c5accfa1362e7448c253cc98f775aaf26ed17dc20d64736f6c634300081c0033' as Hex
const TOKEN_SALT = pad('0x535157', { size: 32 }) // "SQW"
const UNIT = 1_000_000n // 6 decimals
const DAILY_LIMIT = 100n * UNIT

const client = createPublicClient({ chain: baseSepolia, transport: http(NODE_URL) })
const allowance = new AllowanceModule()
const recovery = new SocialRecoveryModule(RECOVERY_MODULE)
const paymaster = new Erc7677Paymaster(PAYMASTER_URL)

const safeAbi = parseAbi([
  'function setup(address[] _owners, uint256 _threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) payable returns (bool)',
  'function nonce() view returns (uint256)',
  'function getOwners() view returns (address[])',
  'function getThreshold() view returns (uint256)',
])
const factoryAbi = parseAbi([
  'function createProxyWithNonce(address _singleton, bytes initializer, uint256 saltNonce) returns (address proxy)',
])
const moduleSetupAbi = parseAbi(['function enableModules(address[] modules)'])
const tokenAbi = parseAbi([
  'function mint(address to, uint256 amount)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
])

// ── Reporting ───────────────────────────────────────────────────────────────
const started = Date.now()
const results: { id: string; ok: boolean; detail: string }[] = []
const tx = (hash: string) => `https://sepolia.basescan.org/tx/${hash}`
const log = (msg: string) => console.log(`[${String(Math.round((Date.now() - started) / 1000)).padStart(3)}s] ${msg}`)
function record(id: string, ok: boolean, detail: string) {
  results.push({ id, ok, detail })
  log(`${ok ? '✅' : '❌'} ${id} — ${detail}`)
}
function reason(error: unknown) {
  const text = error instanceof Error ? `${error.message} ${JSON.stringify((error as { context?: unknown }).context ?? '')}` : String(error)
  const match = text.match(/(GS0\d\d|SM: [^"\\]+|[a-zA-Z]+ > [^"\\]+|newSpent[^"\\]*|reverted[^"\\]{0,80})/)
  return match ? match[0] : text.slice(0, 140)
}
/** Decoded revert reason of `call` executed from `from` (eth_call), to show WHY a UserOp was refused. */
async function revertReason(from: Address, call: { to: string; data: string }) {
  try {
    await client.call({ account: from, to: call.to as Address, data: call.data as Hex })
    return 'no revert'
  } catch (error) {
    const e = error as { details?: string; shortMessage?: string }
    return (e.details || e.shortMessage || String(error)).replace(/\s+/g, ' ').slice(0, 120)
  }
}

async function expectRevert(run: () => Promise<unknown>) {
  try {
    await run()
    return { reverted: false, why: '' }
  } catch (error) {
    return { reverted: true, why: reason(error) }
  }
}

// ── Passkeys (simulated P-256, exact WebAuthn payload format) ───────────────
type Passkey = { privateKey: Hex; publicKey: WebauthnPublicKey }
function newPasskey(): Passkey {
  const privateKey = P256.randomPrivateKey()
  const { x, y } = P256.getPublicKey({ privateKey })
  return { privateKey, publicKey: { x: BigInt(x), y: BigInt(y) } }
}
function assertion(passkey: Passkey, challenge: Hex) {
  const { metadata, payload } = WebAuthnP256.getSignPayload({
    challenge,
    rpId: 'localhost',
    origin: 'http://localhost:3000',
  })
  const signature = P256.sign({ payload, privateKey: passkey.privateKey, hash: true })
  return webauthnSignatureFromAssertion({
    authenticatorData: metadata.authenticatorData,
    clientDataJSON: metadata.clientDataJSON,
    signature: { r: BigInt(signature.r), s: BigInt(signature.s) },
  })
}

// ── Senders ─────────────────────────────────────────────────────────────────
const isDeployed = async (address: Address) => ((await client.getCode({ address })) ?? '0x').length > 2

async function waitFor(account: SafeAccount, op: Awaited<ReturnType<SafeAccount['createUserOperation']>>) {
  const receipt = await (await account.sendUserOperation(op, BUNDLER_URL)).included()
  if (!receipt) throw new Error('timeout waiting for inclusion')
  if (!receipt.success) throw new Error(`reverted on-chain ${receipt.receipt.transactionHash}`)
  return receipt.receipt.transactionHash
}

/** UserOp from a passkey Safe (Key Safe), sponsored. */
async function keySafeSend(passkey: Passkey, address: Address, calls: MetaTransaction[]) {
  const account = (await isDeployed(address))
    ? new SafeAccount(address)
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

/** Relayer: any third party submitting pre-signed transactions (ADR-007). */
const relayerKey = generatePrivateKey()
const relayerOwner = privateKeyToAccount(relayerKey)
const relayerAddress = SafeAccount.createAccountAddress([relayerOwner.address]) as Address
async function relayerSend(calls: MetaTransaction[]) {
  const account = (await isDeployed(relayerAddress))
    ? new SafeAccount(relayerAddress)
    : SafeAccount.initializeNewAccount([relayerOwner.address])
  let op = await account.createUserOperation(calls, NODE_URL, BUNDLER_URL)
  op = (await paymaster.createPaymasterUserOperation(account, op, BUNDLER_URL)).userOperation
  op.signature = account.signUserOperation(op, [relayerKey], CHAIN_ID)
  return waitFor(account, op)
}

// ── Safe execTransaction signatures ─────────────────────────────────────────
function safeTxTypedData(account: Address, to: Address, data: Hex, nonce: bigint) {
  return {
    domain: { chainId: Number(CHAIN_ID), verifyingContract: account },
    types: {
      SafeTx: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'safeTxGas', type: 'uint256' },
        { name: 'baseGas', type: 'uint256' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasToken', type: 'address' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'SafeTx' as const,
    message: {
      to, value: 0n, data, operation: 0, safeTxGas: 0n, baseGas: 0n, gasPrice: 0n,
      gasToken: zeroAddress, refundReceiver: zeroAddress, nonce,
    },
  }
}

type SafeSignature =
  | { signer: Address; kind: 'ecdsa'; data: Hex } // EOA (the Kit): v = 27/28
  | { signer: Address; kind: 'sender' } // owner that is msg.sender: v = 1
  | { signer: Address; kind: 'contract'; data: Hex } // EIP-1271 owner (passkey verifier proxy): v = 0

/** Safe signature blob: owners sorted ascending, static parts, then dynamic contract signatures. */
function encodeSafeSignatures(signatures: SafeSignature[]): Hex {
  const sorted = [...signatures].sort((a, b) => (BigInt(a.signer) < BigInt(b.signer) ? -1 : 1))
  const staticLength = 65 * sorted.length
  let dynamic: Hex = '0x'
  const statics = sorted.map((sig) => {
    if (sig.kind === 'ecdsa') return sig.data
    if (sig.kind === 'sender') return concat([pad(sig.signer, { size: 32 }), pad('0x00', { size: 32 }), '0x01'])
    const offset = staticLength + (dynamic.length - 2) / 2
    dynamic = concat([dynamic, pad(toHex((sig.data.length - 2) / 2), { size: 32 }), sig.data])
    return concat([pad(sig.signer, { size: 32 }), pad(toHex(offset), { size: 32 }), '0x00'])
  })
  return concat([...statics, dynamic])
}

function execTransaction(account: Address, call: { to: string; data: string }, signatures: Hex): MetaTransaction {
  return {
    to: account,
    value: 0n,
    data: encodeFunctionData({
      abi: safeAbi,
      functionName: 'execTransaction',
      args: [call.to as Address, 0n, call.data as Hex, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, signatures],
    }),
  }
}

const accountNonce = (account: Address) => client.readContract({ address: account, abi: safeAbi, functionName: 'nonce' })
const balanceOf = (token: Address, owner: Address) =>
  client.readContract({ address: token, abi: tokenAbi, functionName: 'balanceOf', args: [owner] })

// ── Actors ──────────────────────────────────────────────────────────────────
const keyPasskey = newPasskey() // the phone (Face ID)
const keySafe = SafeAccount.createAccountAddress([keyPasskey.publicKey]) as Address
const hwPasskey = newPasskey() // hardware key (FIDO2)
const hwProxy = SafeAccount.createWebAuthnSignerVerifierAddress(hwPasskey.publicKey.x, hwPasskey.publicKey.y) as Address
const kitOwner = privateKeyToAccount(generatePrivateKey()) // Recovery Kit: Account owner key
const kitGuardian = privateKeyToAccount(generatePrivateKey()) // Recovery Kit: Account guardian key (ADR-019)
const recipient = privateKeyToAccount(generatePrivateKey()).address
const token = getContractAddress({ opcode: 'CREATE2', from: CREATE2_DEPLOYER, salt: TOKEN_SALT, bytecode: TOKEN_BYTECODE })

/** Kit (ECDSA) + another factor sign an Account transaction at `nonce`. */
async function signAccountTx(
  account: Address,
  call: { to: string; data: string },
  nonce: bigint,
  second: { kind: 'sender'; signer: Address } | { kind: 'hardware' },
) {
  const typed = safeTxTypedData(account, call.to as Address, call.data as Hex, nonce)
  const kit: SafeSignature = { kind: 'ecdsa', signer: kitOwner.address, data: await kitOwner.signTypedData(typed) }
  const other: SafeSignature =
    second.kind === 'sender'
      ? second
      : { kind: 'contract', signer: hwProxy, data: SafeAccount.createWebAuthnSignature(assertion(hwPasskey, hashTypedData(typed))) as Hex }
  return encodeSafeSignatures([kit, other])
}

async function main() {
  log(`Key Safe ${keySafe} · hardware key proxy ${hwProxy} · Kit ${kitOwner.address} · Kit guardian ${kitGuardian.address}`)
  log(`Test token ${token} · relayer ${relayerAddress}`)

  // Setup 1: deploy the Key Safe (first UserOp), the test token (once) and the hardware key's verifier proxy.
  const setup1: MetaTransaction[] = []
  if (!(await isDeployed(token))) setup1.push({ to: CREATE2_DEPLOYER, value: 0n, data: concat([TOKEN_SALT, TOKEN_BYTECODE]) })
  setup1.push(SafeAccount.createDeployWebAuthnVerifierMetaTransaction(hwPasskey.publicKey.x, hwPasskey.publicKey.y))
  log(`Setup: Key Safe + verifier proxy${setup1.length > 1 ? ' + test token' : ''} → ${tx(await keySafeSend(keyPasskey, keySafe, setup1))}`)

  // Setup 2 = C3: deploy the Account [Key Safe, Kit, hardware key] (threshold 2) and configure it with
  // account.execTransaction signed by the Kit (ECDSA) + the Key Safe (v = 1, it is msg.sender).
  const owners = [keySafe, kitOwner.address, hwProxy]
  const initializer = encodeFunctionData({
    abi: safeAbi,
    functionName: 'setup',
    args: [
      owners, 2n, SAFE_MODULE_SETUP,
      encodeFunctionData({ abi: moduleSetupAbi, functionName: 'enableModules', args: [[allowance.moduleAddress as Address, RECOVERY_MODULE as Address]] }),
      FALLBACK_HANDLER_141, zeroAddress, 0n, zeroAddress,
    ],
  })
  const saltNonce = BigInt(Date.now())
  const { result: account } = await client.simulateContract({
    address: PROXY_FACTORY_141, abi: factoryAbi, functionName: 'createProxyWithNonce',
    args: [SAFE_L2_141, initializer, saltNonce], account: relayerOwner.address,
  })
  log(`Account ${account}`)
  const configure = [
    allowance.createAddDelegateMetaTransaction(keySafe),
    allowance.createBaseSetAllowanceMetaTransaction(keySafe, token, DAILY_LIMIT, 1440n, 0n),
    recovery.createAddGuardianWithThresholdMetaTransaction(kitGuardian.address, 1n),
  ]
  const setup2: MetaTransaction[] = [
    { to: PROXY_FACTORY_141, value: 0n, data: encodeFunctionData({ abi: factoryAbi, functionName: 'createProxyWithNonce', args: [SAFE_L2_141, initializer, saltNonce] }) },
  ]
  for (const [i, call] of configure.entries()) {
    setup2.push(execTransaction(account, call, await signAccountTx(account, call, BigInt(i), { kind: 'sender', signer: keySafe })))
  }
  setup2.push({ to: token, value: 0n, data: encodeFunctionData({ abi: tokenAbi, functionName: 'mint', args: [account, 1000n * UNIT] }) })
  const setupTx = await keySafeSend(keyPasskey, keySafe, setup2)
  const [onchainOwners, threshold, delegates, isGuardian] = await Promise.all([
    client.readContract({ address: account, abi: safeAbi, functionName: 'getOwners' }),
    client.readContract({ address: account, abi: safeAbi, functionName: 'getThreshold' }),
    allowance.getDelegates(NODE_URL, account),
    recovery.isGuardian(NODE_URL, account, kitGuardian.address),
  ])
  record('C3', onchainOwners.length === 3 && threshold === 2n && delegates.map((d) => d.toLowerCase()).includes(keySafe.toLowerCase()) && isGuardian,
    `Key Safe UserOp ran 3 account.execTransaction (Kit ECDSA + v=1): owners ${onchainOwners.length}, threshold ${threshold}, delegate set, Kit guardian set → ${tx(setupTx)}`)

  // C1: spend within the allowance — SDK default delegate signature (v = 1) and empty signature.
  const t1 = await keySafeSend(keyPasskey, keySafe, [allowance.createAllowanceTransferMetaTransaction(account, token, recipient, 20n * UNIT, keySafe)])
  const t2 = await keySafeSend(keyPasskey, keySafe, [allowance.createAllowanceTransferMetaTransaction(account, token, recipient, 20n * UNIT, keySafe, { delegateSignature: '0x' })])
  record('C1', (await balanceOf(token, recipient)) === 40n * UNIT, `Face ID alone spent 20 + 20 tUSD within the 100 tUSD/day limit (v=1, then empty signature) → ${tx(t1)} , ${tx(t2)}`)

  // C2: above the remaining allowance (60 left) → reverts.
  const overLimit = allowance.createAllowanceTransferMetaTransaction(account, token, recipient, 70n * UNIT, keySafe)
  const c2 = await expectRevert(() => keySafeSend(keyPasskey, keySafe, [overLimit]))
  record('C2', c2.reverted && (await balanceOf(token, recipient)) === 40n * UNIT,
    `70 tUSD with 60 left: ${c2.reverted ? `UserOp refused — contract says: ${await revertReason(keySafe, overLimit)}` : 'DID NOT REVERT'}`)

  // C4: large payment by a relayer, signed by the Kit + the hardware key (no Key Safe involved).
  const bigPayment = { to: token, data: encodeFunctionData({ abi: tokenAbi, functionName: 'transfer', args: [recipient, 500n * UNIT] }) }
  const t4 = await relayerSend([execTransaction(account, bigPayment, await signAccountTx(account, bigPayment, await accountNonce(account), { kind: 'hardware' }))])
  record('C4', (await balanceOf(token, recipient)) === 540n * UNIT, `relayer moved 500 tUSD with Kit ECDSA + hardware key WebAuthn contract signature → ${tx(t4)}`)

  // C5: time-locked eviction. The phone is "stolen": its passkey is the thief's.
  const newKeyPasskey = newPasskey()
  const newKeySafe = SafeAccount.createAccountAddress([newKeyPasskey.publicKey]) as Address
  const newOwners = [newKeySafe, kitOwner.address, hwProxy]
  const startEviction = async () => {
    const typed = await recovery.getRecoveryRequestEip712Data(NODE_URL, CHAIN_ID, account, newOwners, 2n)
    const signature = await kitGuardian.signTypedData({
      domain: { ...typed.domain, verifyingContract: typed.domain.verifyingContract as Address },
      types: typed.types,
      primaryType: EXECUTE_RECOVERY_PRIMARY_TYPE,
      message: typed.messageValue,
    })
    return relayerSend([recovery.createMultiConfirmRecoveryMetaTransaction(account, newOwners, 2, [{ signer: kitGuardian.address, signature }], true)])
  }
  const pending = async () => (await recovery.getRecoveryRequest(NODE_URL, account)).executeAfter > 0n

  const s1 = await startEviction()
  record('C5a', await pending(), `Kit guardian key alone started the eviction (new owners: new Key Safe, Kit, hardware key) → ${tx(s1)}`)

  const cancel = recovery.createCancelRecoveryMetaTransaction()
  const thiefCancel = execTransaction(account, cancel, encodeSafeSignatures([{ kind: 'sender', signer: keySafe }]))
  const c5b = await expectRevert(() => keySafeSend(keyPasskey, keySafe, [thiefCancel]))
  record('C5b', c5b.reverted && (await pending()),
    `thief (Key Safe alone) tries to cancel: ${c5b.reverted ? `UserOp refused — Safe says: ${await revertReason(keySafe, thiefCancel)} (GS020 = not enough signatures)` : 'DID NOT REVERT'}, eviction still pending`)

  const t5c = await keySafeSend(keyPasskey, keySafe, [
    execTransaction(account, cancel, await signAccountTx(account, cancel, await accountNonce(account), { kind: 'sender', signer: keySafe })),
  ])
  record('C5c', !(await pending()), `owner with 2 factors (Face ID + Kit) cancels → ${tx(t5c)}`)

  const s2 = await startEviction()
  log(`Eviction restarted → ${tx(s2)}`)
  const drain = await keySafeSend(keyPasskey, keySafe, [allowance.createAllowanceTransferMetaTransaction(account, token, recipient, 10n * UNIT, keySafe)])
  log(`ℹ️  During the delay the thief can still draw the daily limit (10 tUSD) → ${tx(drain)}`)

  const { executeAfter } = await recovery.getRecoveryRequest(NODE_URL, account)
  for (;;) {
    const now = (await client.getBlock()).timestamp
    if (now >= executeAfter) break
    log(`waiting for the delay… ${executeAfter - now}s left`)
    await new Promise((r) => setTimeout(r, Math.min(30, Number(executeAfter - now) + 2) * 1000))
  }
  const t5d = await relayerSend([recovery.createFinalizeRecoveryMetaTransaction(account)])
  const finalOwners = (await client.readContract({ address: account, abi: safeAbi, functionName: 'getOwners' })).map((o) => o.toLowerCase())
  const sameSet = finalOwners.length === 3 && newOwners.every((o) => finalOwners.includes(o.toLowerCase())) && !finalOwners.includes(keySafe.toLowerCase())
  record('C5d', sameSet && (await client.readContract({ address: account, abi: safeAbi, functionName: 'getThreshold' })) === 2n,
    `after the delay, finalize (anyone) replaced the stolen Key Safe; owners = new Key Safe, Kit, hardware key; threshold 2 → ${tx(t5d)}`)

  // The new Key Safe (new phone) + Kit move the allowance away from the stolen Key Safe.
  const n = await accountNonce(account)
  const handover = [
    allowance.createRemoveDelegateMetaTransaction(keySafe, true),
    allowance.createAddDelegateMetaTransaction(newKeySafe),
    allowance.createBaseSetAllowanceMetaTransaction(newKeySafe, token, DAILY_LIMIT, 1440n, 0n),
  ]
  const handoverCalls: MetaTransaction[] = []
  for (const [i, call] of handover.entries()) {
    handoverCalls.push(execTransaction(account, call, await signAccountTx(account, call, n + BigInt(i), { kind: 'sender', signer: newKeySafe })))
  }
  const t5e = await keySafeSend(newKeyPasskey, newKeySafe, handoverCalls)
  log(`Allowance moved to the new Key Safe (new phone + Kit) → ${tx(t5e)}`)

  const oldSpend = allowance.createAllowanceTransferMetaTransaction(account, token, recipient, 1n * UNIT, keySafe)
  const c5f = await expectRevert(() => keySafeSend(keyPasskey, keySafe, [oldSpend]))
  if (c5f.reverted) c5f.why = await revertReason(keySafe, oldSpend)
  const before = await balanceOf(token, recipient)
  const t5g = await keySafeSend(newKeyPasskey, newKeySafe, [allowance.createAllowanceTransferMetaTransaction(account, token, recipient, 10n * UNIT, newKeySafe)])
  const after = await balanceOf(token, recipient)
  record('C5e', c5f.reverted && after - before === 10n * UNIT,
    `stolen Key Safe can no longer spend (${c5f.reverted ? `reverted: ${c5f.why}` : 'DID NOT REVERT'}); new phone spends 10 tUSD → ${tx(t5g)}`)
}

main()
  .catch((error) => record('ABORT', false, error instanceof Error ? `${error.message} ${JSON.stringify((error as { context?: unknown }).context ?? '')}`.slice(0, 600) : String(error)))
  .finally(() => {
    const failed = results.filter((r) => !r.ok)
    console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — FAILED: ${failed.map((f) => f.id).join(', ')}` : ''}`)
    process.exit(failed.length ? 1 : 0)
  })
