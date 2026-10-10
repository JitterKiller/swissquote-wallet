import {
  EXECUTE_RECOVERY_PRIMARY_TYPE,
  SafeMultiChainSigAccountV1 as SafeAccount,
  SocialRecoveryModule,
  type MetaTransaction,
  type WebauthnPublicKey,
} from 'abstractionkit'

import { CHAIN_ID, NODE_URL, RECOVERY_MODULE_ADDRESS } from './config'
import { isDeployed } from './wallet'

/**
 * Guardian-based recovery (shared by the app and the mock Swissquote backend).
 *
 * Guardians: the client's Recovery Kit + the Swissquote Guardian, threshold 2.
 * A recovery replaces the Safe owner with a NEW passkey, after a delay during
 * which the current owner can cancel. Swissquote alone can never recover.
 */

export const recoveryModule = new SocialRecoveryModule(RECOVERY_MODULE_ADDRESS)

/** Safe owner address of a passkey = its deterministic WebAuthn verifier proxy. */
export function ownerAddressForPasskey(publicKey: WebauthnPublicKey): `0x${string}` {
  return SafeAccount.createWebAuthnSignerVerifierAddress(publicKey.x, publicKey.y) as `0x${string}`
}

/** One UserOp: enable the module and register both guardians (threshold 2). */
export function recoverySetupCalls(
  wallet: string,
  recoveryKitGuardian: string,
  swissquoteGuardian: string,
): MetaTransaction[] {
  return [
    recoveryModule.createEnableModuleMetaTransaction(wallet),
    recoveryModule.createAddGuardianWithThresholdMetaTransaction(recoveryKitGuardian, 1n),
    recoveryModule.createAddGuardianWithThresholdMetaTransaction(swissquoteGuardian, 2n),
  ]
}

export type PendingRecovery = {
  newOwners: string[]
  executeAfter: number // unix seconds
  approvals: number
}

export type RecoveryStatus = {
  guardians: string[]
  threshold: number
  pending: PendingRecovery | null
}

export async function getRecoveryStatus(wallet: string): Promise<RecoveryStatus> {
  const [guardians, threshold, request] = await Promise.all([
    recoveryModule.getGuardians(NODE_URL, wallet),
    recoveryModule.threshold(NODE_URL, wallet),
    recoveryModule.getRecoveryRequest(NODE_URL, wallet),
  ])
  return {
    guardians,
    threshold: Number(threshold),
    pending:
      request.executeAfter > 0n
        ? {
            newOwners: request.newOwners,
            executeAfter: Number(request.executeAfter),
            approvals: Number(request.guardiansApprovalCount),
          }
        : null,
  }
}

/** Is this passkey still an owner of the wallet? (false once recovered elsewhere) */
export async function isPasskeyOwner(wallet: `0x${string}`, publicKey: WebauthnPublicKey) {
  if (!(await isDeployed(wallet))) return true // counterfactual: owner by construction
  const owners = await new SafeAccount(wallet).getOwners(NODE_URL)
  const me = ownerAddressForPasskey(publicKey).toLowerCase()
  return owners.some((owner) => owner.toLowerCase() === me)
}

/** EIP-712 payload each guardian signs to approve "new owner = newOwner". */
export async function recoveryTypedData(wallet: string, newOwner: string) {
  const { domain, types, messageValue } = await recoveryModule.getRecoveryRequestEip712Data(
    NODE_URL,
    CHAIN_ID,
    wallet,
    [newOwner],
    1n,
  )
  return {
    domain: { ...domain, verifyingContract: domain.verifyingContract as `0x${string}` },
    types,
    primaryType: EXECUTE_RECOVERY_PRIMARY_TYPE,
    message: messageValue,
  } as const
}
