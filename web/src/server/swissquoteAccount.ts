import { erc20Abi, encodeFunctionData, getAddress, isHex, parseEventLogs, parseUnits, type Address, type Hex } from 'viem'

import { USDC_ADDRESS, USDC_DECIMALS } from '@/lib/config'
import { publicClient } from '@/lib/wallet'

import { relay, relayerAddress } from './guardian'
import { getWalletByClient } from './registry'
import { notifyClient, store } from './store'

/**
 * Transfers between the Swissquote account and the wallet (PDR-024, ADR-025).
 * MOCK: the account balance; the treasury is the Swissquote relayer Safe holding real test USDC.
 */

const OPENING_BALANCE = parseUnits('1000', USDC_DECIMALS)

export class TransferError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

async function linked(clientId?: string) {
  if (!clientId) throw new TransferError('Sign in with Swissquote first', 401)
  const wallet = await getWalletByClient(clientId)
  if (!wallet) throw new TransferError('Link your wallet to your Swissquote account first', 403)
  return wallet
}

async function balanceOf(clientId: string) {
  const stored = await store().get<string>('sqAccounts', clientId)
  if (stored !== null) return BigInt(stored)
  await store().set('sqAccounts', clientId, OPENING_BALANCE.toString())
  return OPENING_BALANCE
}

const setBalance = (clientId: string, value: bigint) => store().set('sqAccounts', clientId, value.toString())

const treasuryUsdc = async (treasury: Address) =>
  publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [treasury] })

export async function getAccountOverview(clientId?: string) {
  await linked(clientId)
  const depositAddress = (await relayerAddress()) as Address
  return {
    balance: (await balanceOf(clientId as string)).toString(),
    depositAddress,
    treasury: (await treasuryUsdc(depositAddress)).toString(),
  }
}

async function travelRule(record: Record<string, unknown>) {
  await store().append('travelRule', { ...record, at: Date.now() })
}

export async function withdrawToWallet(input: { clientId?: string; amount?: string }) {
  const wallet = await linked(input.clientId)
  const clientId = input.clientId as string
  let amount: bigint
  try {
    amount = parseUnits(input.amount ?? '', USDC_DECIMALS)
  } catch {
    throw new TransferError('Invalid amount')
  }
  if (amount <= 0n) throw new TransferError('Invalid amount')
  const balance = await balanceOf(clientId)
  if (amount > balance) throw new TransferError('Insufficient balance on your Swissquote account', 409)
  const treasury = (await relayerAddress()) as Address
  if ((await treasuryUsdc(treasury)) < amount) {
    throw new TransferError(
      `The demo treasury needs test USDC: send some to ${treasury} on Base Sepolia (Circle faucet).`,
      503,
    )
  }

  const txHash = await relay([
    {
      to: USDC_ADDRESS,
      value: 0n,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [wallet.account, amount] }),
    },
  ])
  await setBalance(clientId, balance - amount)
  await travelRule({
    direction: 'swissquote-to-wallet',
    clientId,
    originator: { name: wallet.displayName, account: 'Swissquote account' },
    beneficiary: { name: wallet.displayName, wallet: wallet.account },
    ownershipProof: { registeredAt: wallet.registeredAt, keySafe: wallet.keySafe },
    amount: amount.toString(),
    txHash,
  })
  await notifyClient(wallet.account, `Moved ${input.amount} USDC from your Swissquote account to your wallet.`)
  return { txHash, balance: (balance - amount).toString() }
}

export async function creditDeposit(input: { clientId?: string; txHash?: string }) {
  const wallet = await linked(input.clientId)
  const clientId = input.clientId as string
  if (!input.txHash || !isHex(input.txHash) || input.txHash.length !== 66) throw new TransferError('Invalid transaction hash')
  const txHash = input.txHash.toLowerCase() as Hex
  if (!(await store().setIfAbsent('deposits', txHash, { clientId, at: Date.now() }))) {
    throw new TransferError('This transaction was already credited', 409)
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash })
    const depositAddress = getAddress(await relayerAddress())
    const senders = [wallet.account, wallet.keySafe].map((a) => getAddress(a))
    const transfers = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs }).filter(
      (log) =>
        getAddress(log.address) === getAddress(USDC_ADDRESS) &&
        getAddress(log.args.to) === depositAddress &&
        senders.includes(getAddress(log.args.from)),
    )
    const amount = transfers.reduce((sum, log) => sum + log.args.value, 0n)
    if (amount === 0n) throw new TransferError('No USDC transfer from your wallet to Swissquote in this transaction')

    const balance = await balanceOf(clientId)
    await setBalance(clientId, balance + amount)
    await store().set('deposits', txHash, { clientId, amount: amount.toString(), at: Date.now() })
    await travelRule({
      direction: 'wallet-to-swissquote',
      clientId,
      originator: { name: wallet.displayName, wallet: wallet.account },
      beneficiary: { name: wallet.displayName, account: 'Swissquote account' },
      ownershipProof: { registeredAt: wallet.registeredAt, keySafe: wallet.keySafe },
      amount: amount.toString(),
      txHash,
    })
    await notifyClient(wallet.account, `Credited ${amount} USDC base units from your wallet to your Swissquote account.`)
    return { credited: amount.toString(), balance: (balance + amount).toString() }
  } catch (error) {
    await store().delete('deposits', txHash) // let the client retry (e.g. receipt not available yet)
    if (error instanceof TransferError) throw error
    throw new TransferError(error instanceof Error ? error.message : 'Could not read the transaction', 404)
  }
}
