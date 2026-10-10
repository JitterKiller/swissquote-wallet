import { SocialRecoveryModuleGracePeriodSelector } from 'abstractionkit'

// Network: Base Sepolia (testnet). Base supports the RIP-7212 P-256 precompile,
// which keeps passkey signature verification cheap.
export const CHAIN_ID = 84532n

export const NODE_URL = process.env.NEXT_PUBLIC_NODE_URL ?? 'https://sepolia.base.org'

// Transaction history (eth_getLogs): sepolia.base.org caps log queries at 200
// blocks, publicnode allows 50k-block ranges.
export const LOGS_NODE_URL =
  process.env.NEXT_PUBLIC_LOGS_NODE_URL ?? 'https://base-sepolia-rpc.publicnode.com'

// Candide public endpoints (no API key on testnets). The paymaster sponsors gas,
// so wallets never need to hold ETH.
export const BUNDLER_URL =
  process.env.NEXT_PUBLIC_BUNDLER_URL ?? 'https://api.candide.dev/public/v3/84532'
// Upstream ERC-7677 paymaster. Only the Swissquote backend talks to it directly (relayer, proxy).
export const UPSTREAM_PAYMASTER_URL =
  process.env.PAYMASTER_UPSTREAM_URL ?? 'https://api.candide.dev/public/v3/84532'
// Wallet UserOps go through Swissquote's sponsorship policy (PDR-019, issue #23): /api/paymaster.
export const PAYMASTER_URL =
  process.env.NEXT_PUBLIC_PAYMASTER_URL ??
  (typeof window === 'undefined' ? UPSTREAM_PAYMASTER_URL : `${window.location.origin}/api/paymaster`)

// Circle's official testnet USDC on Base Sepolia (faucet: https://faucet.circle.com).
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const
export const USDC_DECIMALS = 6

export const EXPLORER_URL = 'https://sepolia.basescan.org'
export const USDC_FAUCET_URL = 'https://faucet.circle.com'

// Candide Social Recovery Module. Each deployment has a fixed recovery delay:
// 3 minutes for the demo; production would use After3Days or longer.
export const RECOVERY_MODULE_ADDRESS = SocialRecoveryModuleGracePeriodSelector.After3Minutes
export const RECOVERY_DELAY_LABEL = '3 minutes (demo)'
export const RECOVERY_DELAY_SECONDS = 180

// ── Account Safe (ADR-017, ADR-019) ────────────────────────────────────────
// The Account holds all funds. Owners: Key Safe + Kit owner key (+ hardware key),
// threshold 2. Plain Safe L2 v1.4.1, no 4337 module. Canonical deployments,
// checked on Base Sepolia by the spike (scripts/spike-two-safe.mts).
export const SAFE_L2_141_SINGLETON = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762' as const
export const SAFE_PROXY_FACTORY_141 = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as const
// keccak256(proxyCreationCode ++ uint256(singleton)): CREATE2 init-code hash of an Account.
export const SAFE_L2_141_PROXY_INIT_HASH =
  '0xe298282cefe913ab5d282047161268a8222e4bd4ed106300c547894bbefd31ee' as const
export const SAFE_FALLBACK_HANDLER_141 = '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99' as const
export const SAFE_MODULE_SETUP = '0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47' as const // enableModules(address[])
export const MULTISEND_CALL_ONLY_141 = '0x9641d764fc13c8B624c04430C7356C1C7C8102e2' as const

// Safe Allowance Module v1.0.0: the Key Safe's daily allowance on the Account.
export const ALLOWANCE_MODULE_ADDRESS = '0x691f59471Bfd2B7d639DCF74671a2d648ED1E331' as const
export const ALLOWANCE_RESET_MINUTES = 1440n // resets at 00:00 UTC (reset base 0)
export const SUGGESTED_DAILY_LIMIT = 500n * 10n ** BigInt(USDC_DECIMALS) // PDR-020, chosen by the user

/** 0 = everyone (Kit guardian alone), 1 = linked Swissquote client (+ Swissquote). */
export type Level = 0 | 1

// Eviction (Account recovery module): 7 days at level 0, 3 days at level 1.
// The demo uses the 3-minute deployment for both; set NEXT_PUBLIC_EVICTION_DELAYS=production.
const EVICTION_DELAYS =
  process.env.NEXT_PUBLIC_EVICTION_DELAYS === 'production'
    ? {
        modules: {
          0: SocialRecoveryModuleGracePeriodSelector.After7Days,
          1: SocialRecoveryModuleGracePeriodSelector.After3Days,
        },
        seconds: { 0: 7 * 86_400, 1: 3 * 86_400 },
      }
    : {
        modules: {
          0: SocialRecoveryModuleGracePeriodSelector.After3Minutes,
          1: SocialRecoveryModuleGracePeriodSelector.After3Minutes,
        },
        seconds: { 0: 180, 1: 180 },
      }
export const ACCOUNT_RECOVERY_MODULE: Record<Level, `0x${string}`> = EVICTION_DELAYS.modules
export const EVICTION_DELAY_SECONDS: Record<Level, number> = EVICTION_DELAYS.seconds
/** Product delays (PDR-018), used for the loss bound shown to the user (PDR-020). */
export const EVICTION_DAYS: Record<Level, number> = { 0: 7, 1: 3 }
export const EVICTION_DELAY_IS_DEMO = process.env.NEXT_PUBLIC_EVICTION_DELAYS !== 'production'
