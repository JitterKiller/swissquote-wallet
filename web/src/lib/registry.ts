import { hashTypedData, type Address, type Hex } from 'viem'

import { api } from './api'
import { CHAIN_ID } from './config'
import { assertWithPasskey } from './passkey'
import type { StoredWallet } from './storage'

/**
 * Wallet registry (PDR-022, ADR-021): a linked client proves with one Face ID that they
 * control their Account. Shared by the client (signing) and the server (verification).
 */

export type OwnershipStatementInput = {
  clientId: string
  account: Address
  keySafe: Address
  nonce: Hex
  issuedAt: bigint
}

export function ownershipStatement(input: OwnershipStatementInput) {
  return {
    domain: { name: 'Swissquote Wallet Registry', version: '1', chainId: CHAIN_ID },
    types: {
      OwnershipProof: [
        { name: 'client', type: 'string' },
        { name: 'account', type: 'address' },
        { name: 'keySafe', type: 'address' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'issuedAt', type: 'uint64' },
      ],
    },
    primaryType: 'OwnershipProof',
    message: {
      client: input.clientId,
      account: input.account,
      keySafe: input.keySafe,
      nonce: input.nonce,
      issuedAt: input.issuedAt,
    },
  } as const
}

/** The WebAuthn challenge the passkey signs. */
export const ownershipChallenge = (input: OwnershipStatementInput) => hashTypedData(ownershipStatement(input))

export type WebAuthnAssertion = {
  authenticatorData: Hex
  clientDataJSON: string
  signature: { r: Hex; s: Hex }
}

export type RegisterWalletRequest = {
  clientId: string
  displayName: string
  account: Address
  keySafe: Address
  publicKey: { x: string; y: string }
  nonce: Hex
  assertion: WebAuthnAssertion
}

/** Public view of a registry entry. */
export type RegisteredWallet = {
  clientId: string
  displayName: string
  maskedName: string
  account: Address
  keySafe: Address
  level: 0 | 1
  registeredAt: number
  updatedAt: number
}

/**
 * Links this wallet to a Swissquote client: challenge → Face ID → registration.
 * MOCK: the client id and name come from the mock Swissquote session (#21).
 */
export async function linkWallet(params: {
  clientId: string
  displayName: string
  wallet: StoredWallet & { account?: Address }
}): Promise<RegisteredWallet> {
  const { clientId, displayName, wallet } = params
  const keySafe = wallet.address
  const account = wallet.account ?? wallet.address
  const { nonce, issuedAt } = await api<{ nonce: Hex; issuedAt: string }>('/api/wallets/challenge', {
    clientId,
    account,
    keySafe,
  })
  const challenge = ownershipChallenge({ clientId, account, keySafe, nonce, issuedAt: BigInt(issuedAt) })
  const assertion = await assertWithPasskey(wallet.credentialId, challenge)
  const request: RegisterWalletRequest = {
    clientId,
    displayName,
    account,
    keySafe,
    publicKey: wallet.publicKey,
    nonce,
    assertion,
  }
  return api<RegisteredWallet>('/api/wallets', request)
}

export const getMyWallet = (clientId: string) =>
  api<RegisteredWallet>(`/api/wallets/me?clientId=${encodeURIComponent(clientId)}`)
