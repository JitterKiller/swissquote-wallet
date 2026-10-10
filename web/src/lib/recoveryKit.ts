import { isAddress, isHex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

import { CHAIN_ID } from './config'

/**
 * Recovery Kit: a guardian key generated on the client and handed to the user
 * as a file. The app never stores it. On its own it is worth nothing: it is one
 * guardian vote out of two, and any recovery still goes through the delay.
 *
 * Demo format is a plain JSON file. Production: printed sheet / password
 * manager entry, ideally encrypted or split (SLIP-39).
 */

export type RecoveryKit = {
  type: 'swissquote-wallet-recovery-kit'
  version: 1
  chainId: number
  wallet: `0x${string}`
  guardianAddress: `0x${string}`
  guardianKey: `0x${string}`
  createdAt: string
}

export function createRecoveryKit(wallet: `0x${string}`): RecoveryKit {
  const guardianKey = generatePrivateKey()
  return {
    type: 'swissquote-wallet-recovery-kit',
    version: 1,
    chainId: Number(CHAIN_ID),
    wallet,
    guardianAddress: privateKeyToAccount(guardianKey).address,
    guardianKey,
    createdAt: new Date().toISOString(),
  }
}

export function parseRecoveryKit(text: string): RecoveryKit {
  let kit: Partial<RecoveryKit>
  try {
    kit = JSON.parse(text)
  } catch {
    throw new Error('This is not a valid Recovery Kit file.')
  }
  if (
    kit.type !== 'swissquote-wallet-recovery-kit' ||
    !kit.wallet ||
    !isAddress(kit.wallet) ||
    !kit.guardianKey ||
    !isHex(kit.guardianKey)
  ) {
    throw new Error('This is not a valid Recovery Kit file.')
  }
  if (kit.chainId !== Number(CHAIN_ID)) throw new Error('This Recovery Kit is for another network.')
  const address = privateKeyToAccount(kit.guardianKey).address
  return { ...(kit as RecoveryKit), guardianAddress: address }
}

export function downloadRecoveryKit(kit: RecoveryKit) {
  const blob = new Blob([JSON.stringify(kit, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `swissquote-recovery-kit-${kit.wallet.slice(2, 8).toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
