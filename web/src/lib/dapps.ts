import type { MetaTransaction } from 'abstractionkit'
import { encodeFunctionData, erc20Abi, getAddress, maxUint256, parseAbi, parseUnits, type Address } from 'viem'

import { batchCalls, twoFactorCall, type AccountCall, type KitSigner } from './account'
import { USDC_ADDRESS, USDC_DECIMALS } from './config'
import { formatUsdc } from './format'
import { publicClient } from './wallet'

/**
 * Approved dApps (PDR-025, ADR-028, issue #25). The wallet builds the calls itself for a short,
 * curated list of protocols; it does not connect to arbitrary dApp front-ends. Every action leaves
 * the Account with 2 factors (Face ID + Kit): a protocol call is not a payment the daily limit covers.
 * The paymaster reads the same list and only sponsors calls to these contracts.
 */

export type DappId = 'aave-v3' | 'compound-v3'

export type Dapp = {
  id: DappId
  name: string
  description: string
  url: string
  /** Disclosed before Face ID. */
  risks: string
  /** The only contracts this dApp's actions call or approve. */
  contracts: Address[]
}

const AAVE_POOL = '0x07eA79F68B2B3df564D0A34F8e19D9B1e339814b' as const
const COMPOUND_COMET = '0x571621Ce60Cebb0c1D442B5afb38B1663C6Bf017' as const // cUSDCv3

export const APPROVED_DAPPS: Dapp[] = [
  {
    id: 'aave-v3',
    name: 'Aave v3',
    description: 'Lend USDC to the Aave market and earn a variable rate.',
    url: 'https://app.aave.com',
    risks: 'Smart-contract and liquidity risk. The rate changes with demand. Not a deposit, not guaranteed.',
    contracts: [AAVE_POOL],
  },
  {
    id: 'compound-v3',
    name: 'Compound III',
    description: 'Supply USDC to the Compound cUSDCv3 market and earn a variable rate.',
    url: 'https://app.compound.finance',
    risks: 'Smart-contract and liquidity risk. The rate changes with demand. Not a deposit, not guaranteed.',
    contracts: [COMPOUND_COMET],
  },
]

/** Uniswap v3 SwapRouter02 on Base Sepolia: the swap venue (PDR-028, ADR-032). Approved for swaps only. */
export const UNISWAP_V3_ROUTER = '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4' as const

/** Every contract Swissquote approved, with the name the app shows: the Earn protocols and the swap router. */
export const APPROVED_CONTRACTS: { name: string; address: Address }[] = [
  ...APPROVED_DAPPS.flatMap((d) => d.contracts.map((address) => ({ name: d.name, address }))),
  { name: 'Uniswap v3', address: UNISWAP_V3_ROUTER },
]

/** Used by the sponsorship policy (server) and the UI. */
export const isApprovedContract = (address: string) => APPROVED_CONTRACTS.some((c) => c.address.toLowerCase() === address.toLowerCase())

export const approvedContractName = (address: string) =>
  APPROVED_CONTRACTS.find((c) => c.address.toLowerCase() === address.toLowerCase())?.name ?? null

export const dappById = (id: DappId) => {
  const dapp = APPROVED_DAPPS.find((d) => d.id === id)
  if (!dapp) throw new Error(`Unknown dApp ${id}`)
  return dapp
}

const aaveAbi = parseAbi([
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
  'function getReserveData(address asset) view returns ((uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt) reserve)',
])
const cometAbi = parseAbi([
  'function supply(address asset, uint256 amount)',
  'function withdraw(address asset, uint256 amount)',
  'function balanceOf(address account) view returns (uint256)',
  'function getUtilization() view returns (uint256)',
  'function getSupplyRate(uint256 utilization) view returns (uint64)',
])

export type DappAction = 'deposit' | 'withdraw'

type ActionParams = { dapp: Dapp; action: DappAction; account: Address; amount: bigint | 'max' }

/** The Account's calls for an action, step by step: deposit = exact approval then supply; withdraw = back to the Account. */
export function dappActionSteps({ dapp, action, account, amount }: ActionParams): AccountCall[] {
  if (action === 'deposit') {
    if (amount === 'max' || amount <= 0n) throw new Error('Deposit an exact amount')
    const spender = dapp.contracts[0]
    const approve: AccountCall = {
      to: USDC_ADDRESS,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, amount] }),
    }
    const supply: AccountCall =
      dapp.id === 'aave-v3'
        ? { to: AAVE_POOL, data: encodeFunctionData({ abi: aaveAbi, functionName: 'supply', args: [USDC_ADDRESS, amount, account, 0] }) }
        : { to: COMPOUND_COMET, data: encodeFunctionData({ abi: cometAbi, functionName: 'supply', args: [USDC_ADDRESS, amount] }) }
    return [approve, supply]
  }
  // Withdraw: `max` (uint256 max) takes the whole position, so no dust is left behind.
  const value = amount === 'max' ? maxUint256 : amount
  return [
    dapp.id === 'aave-v3'
      ? { to: AAVE_POOL, data: encodeFunctionData({ abi: aaveAbi, functionName: 'withdraw', args: [USDC_ADDRESS, value, account] }) }
      : { to: COMPOUND_COMET, data: encodeFunctionData({ abi: cometAbi, functionName: 'withdraw', args: [USDC_ADDRESS, value] }) },
  ]
}

/** One Account call per action (a deposit's two steps are batched through MultiSend). */
export function dappActionCall(params: ActionParams): AccountCall {
  const steps = dappActionSteps(params)
  return steps.length === 1 ? steps[0] : batchCalls(steps)
}

/** The 2-factor Key Safe UserOp calls for a dApp action (Kit owner key + Key Safe as msg.sender). */
export async function dappActionCalls(params: {
  dapp: Dapp
  action: DappAction
  account: Address
  keySafe: Address
  amount: bigint | 'max'
  kit: KitSigner
}): Promise<MetaTransaction[]> {
  const { dapp, action, account, keySafe, amount, kit } = params
  return [await twoFactorCall({ account, keySafe, call: dappActionCall({ dapp, action, account, amount }), kit })]
}

/** Readable preview lines, shown before Face ID with the simulation and screening (PDR-023). */
export function describeDappAction(dapp: Dapp, action: DappAction, amount: bigint | 'max'): string[] {
  const usdc = (v: bigint) => `${formatUsdc(v)} USDC`
  if (action === 'deposit' && amount !== 'max') {
    return [`Allow ${dapp.name} to take exactly ${usdc(amount)}, no more`, `Supply ${usdc(amount)} to ${dapp.name} from your Account`]
  }
  return [`Withdraw ${amount === 'max' ? 'your whole position' : usdc(amount as bigint)} from ${dapp.name} back to your Account`]
}

/**
 * Demo (issue #25): a real contract that is not on the list, Uniswap's Universal Router on Base Sepolia
 * (any route, Permit2 signatures; only SwapRouter02 is approved, for swaps). The Key Safe asks to
 * approve it; the paymaster refuses to sponsor it (`unapproved-dapp`) before any Face ID prompt.
 * Friction, not a veto: the client could still pay the network fee.
 */
export const UNLISTED_DEMO = { name: 'Uniswap Universal Router', contract: '0x492E6456D9528771018DeB9E87ef7750EF184104' as Address }

export const unlistedDemoCalls = (): MetaTransaction[] => [
  {
    to: USDC_ADDRESS,
    value: 0n,
    data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [UNLISTED_DEMO.contract, parseUnits('1', USDC_DECIMALS)] }),
  },
]

const SECONDS_PER_YEAR = 31_536_000

/** USDC supplied by `account` (with accrued interest) and the current supply APY (0.034 = 3.4%). */
export async function readDappPosition(dapp: Dapp, account: Address): Promise<{ supplied: bigint; apy: number }> {
  if (dapp.id === 'aave-v3') {
    const reserve = await publicClient.readContract({ address: AAVE_POOL, abi: aaveAbi, functionName: 'getReserveData', args: [USDC_ADDRESS] })
    const supplied = await publicClient.readContract({
      address: getAddress(reserve.aTokenAddress),
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account],
    })
    const apr = Number(reserve.currentLiquidityRate) / 1e27
    return { supplied, apy: Math.pow(1 + apr / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1 }
  }
  const [supplied, utilization] = await Promise.all([
    publicClient.readContract({ address: COMPOUND_COMET, abi: cometAbi, functionName: 'balanceOf', args: [account] }),
    publicClient.readContract({ address: COMPOUND_COMET, abi: cometAbi, functionName: 'getUtilization' }),
  ])
  const perSecond = await publicClient.readContract({ address: COMPOUND_COMET, abi: cometAbi, functionName: 'getSupplyRate', args: [utilization] })
  const apy = Math.pow(1 + Number(perSecond) / 1e18, SECONDS_PER_YEAR) - 1
  return { supplied, apy }
}
