import {
  Erc7677Paymaster,
  SafeMultiChainSigAccountV1 as SafeAccount,
  fromSafeWebauthn,
  type MetaTransaction,
  type WebauthnPublicKey,
} from 'abstractionkit'
import { createPublicClient, encodeFunctionData, erc20Abi, http, parseUnits } from 'viem'
import { baseSepolia } from 'viem/chains'

import {
  BUNDLER_URL,
  CHAIN_ID,
  NODE_URL,
  PAYMASTER_URL,
  USDC_ADDRESS,
  USDC_DECIMALS,
} from './config'
import { signWithPasskey } from './passkey'

/**
 * Smart account = Safe (ERC-4337, EntryPoint v0.9) owned by a passkey.
 * The address is deterministic from the passkey public key, so it is known
 * before deployment; the first UserOp deploys it (gas sponsored).
 */

export const publicClient = createPublicClient({ chain: baseSepolia, transport: http(NODE_URL) })

export function predictAddress(publicKey: WebauthnPublicKey): `0x${string}` {
  return SafeAccount.createAccountAddress([publicKey]) as `0x${string}`
}

export async function isDeployed(address: `0x${string}`) {
  const code = await publicClient.getCode({ address })
  return !!code && code !== '0x'
}

export async function getUsdcBalance(address: `0x${string}`) {
  return publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  })
}

export function usdcTransfer(to: `0x${string}`, amount: string): MetaTransaction {
  return {
    to: USDC_ADDRESS,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, parseUnits(amount, USDC_DECIMALS)],
    }),
  }
}

export type SendStep = 'preparing' | 'sponsoring' | 'signing' | 'submitting' | 'confirming'

/**
 * Build → sponsor (paymaster) → sign (passkey) → submit (bundler) → wait.
 * The user only sees one biometric prompt and never pays gas.
 */
export async function sendCalls(params: {
  address: `0x${string}`
  credentialId: string
  publicKey: WebauthnPublicKey
  calls: MetaTransaction[]
  onStep?: (step: SendStep) => void
}): Promise<{ txHash: string; userOpHash: string }> {
  const { address, credentialId, publicKey, calls, onStep } = params

  onStep?.('preparing')
  const account = (await isDeployed(address))
    ? new SafeAccount(address)
    : SafeAccount.initializeNewAccount([publicKey])

  let userOp = await account.createUserOperation(calls, NODE_URL, BUNDLER_URL, {
    expectedSigners: [publicKey],
  })

  onStep?.('sponsoring')
  const paymaster = new Erc7677Paymaster(PAYMASTER_URL)
  userOp = (await paymaster.createPaymasterUserOperation(account, userOp, BUNDLER_URL)).userOperation

  onStep?.('signing')
  const signer = fromSafeWebauthn({
    publicKey,
    isInit: userOp.nonce === 0n,
    accountClass: SafeAccount,
    getAssertion: (challenge) => signWithPasskey(credentialId, challenge),
  })
  userOp.signature = await account.signUserOperationWithSigners(userOp, [signer], CHAIN_ID)

  onStep?.('submitting')
  const response = await account.sendUserOperation(userOp, BUNDLER_URL)

  onStep?.('confirming')
  const receipt = await response.included()
  if (!receipt) throw new Error('Timed out waiting for the transaction to be included')
  if (!receipt.success) throw new Error('The transaction reverted on-chain')

  return { txHash: receipt.receipt.transactionHash, userOpHash: response.userOperationHash }
}
