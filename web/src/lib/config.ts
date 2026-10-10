import { SocialRecoveryModuleGracePeriodSelector } from 'abstractionkit'

// Network: Base Sepolia (testnet). Base supports the RIP-7212 P-256 precompile,
// which keeps passkey signature verification cheap.
export const CHAIN_ID = 84532n

export const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL ?? 'https://sepolia.base.org'

// Candide public endpoints (no API key on testnets). The paymaster sponsors gas,
// so wallets never need to hold ETH.
export const BUNDLER_URL =
  process.env.NEXT_PUBLIC_BUNDLER_URL ?? 'https://api.candide.dev/public/v3/84532'
export const PAYMASTER_URL =
  process.env.NEXT_PUBLIC_PAYMASTER_URL ?? 'https://api.candide.dev/public/v3/84532'

// Circle's official testnet USDC on Base Sepolia (faucet: https://faucet.circle.com).
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const
export const USDC_DECIMALS = 6

export const EXPLORER_URL = 'https://sepolia.basescan.org'
export const USDC_FAUCET_URL = 'https://faucet.circle.com'

// Candide Social Recovery Module. Each deployment has a fixed recovery delay:
// 3 minutes for the demo; production would use After3Days or longer.
export const RECOVERY_MODULE_ADDRESS = SocialRecoveryModuleGracePeriodSelector.After3Minutes
export const RECOVERY_DELAY_LABEL = '3 minutes (demo)'
