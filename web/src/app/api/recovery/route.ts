import { SafeMultiChainSigAccountV1 as SafeAccount } from 'abstractionkit'
import { isAddress, isHex, verifyTypedData } from 'viem'

import {
  getRecoveryStatus,
  ownerAddressForPasskey,
  recoveryModule,
  recoveryTypedData,
} from '@/lib/recovery'
import { guardianAccount, relay } from '@/server/guardian'
import { notifyClient, readDb, updateDb } from '@/server/store'

const KYC_SESSION_TTL_MS = 15 * 60 * 1000

type Body = {
  wallet?: string
  newPublicKey?: { x: string; y: string }
  kitGuardian?: string
  kitSignature?: string
  kycSessionId?: string
}

/**
 * Recovery request. The Swissquote Guardian co-signs only if:
 *  - identity verification passed for this wallet (fresh, single-use session),
 *  - the Recovery Kit signature is valid and the kit is a registered guardian,
 *  - no recovery is already pending.
 * Then the relayer deploys the new passkey's signer and starts the recovery
 * (the on-chain delay begins; the current owner can still cancel).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body
    const { wallet, newPublicKey, kitGuardian, kitSignature, kycSessionId } = body
    if (!wallet || !isAddress(wallet) || !kitGuardian || !isAddress(kitGuardian)) {
      return fail('Invalid wallet or Recovery Kit address')
    }
    if (!newPublicKey?.x || !newPublicKey?.y || !kitSignature || !isHex(kitSignature)) {
      return fail('Missing new passkey or Recovery Kit signature')
    }

    // 1. Identity verification (mock KYC session).
    const session = kycSessionId ? readDb().kycSessions[kycSessionId] : undefined
    if (
      !session ||
      session.wallet !== wallet.toLowerCase() ||
      session.status !== 'verified' ||
      session.used ||
      Date.now() - session.createdAt > KYC_SESSION_TTL_MS
    ) {
      return fail('Identity verification required', 403)
    }

    // 2. On-chain guardian setup and no pending recovery.
    const guardian = guardianAccount()
    const status = await getRecoveryStatus(wallet)
    const guardians = status.guardians.map((g) => g.toLowerCase())
    if (!guardians.includes(guardian.address.toLowerCase())) {
      return fail('Swissquote is not a guardian of this wallet')
    }
    if (!guardians.includes(kitGuardian.toLowerCase())) {
      return fail('This Recovery Kit does not belong to this wallet', 403)
    }
    if (status.pending) return fail('A recovery is already pending for this wallet', 409)

    // 3. Both guardians approve "new owner = new passkey".
    const publicKey = { x: BigInt(newPublicKey.x), y: BigInt(newPublicKey.y) }
    const newOwner = ownerAddressForPasskey(publicKey)
    const typedData = await recoveryTypedData(wallet, newOwner)
    const kitOk = await verifyTypedData({
      ...typedData,
      address: kitGuardian,
      signature: kitSignature,
    })
    if (!kitOk) return fail('Invalid Recovery Kit signature', 403)
    const swissquoteSignature = await guardian.signTypedData(typedData)

    // 4. Relay: deploy the new passkey signer + confirm & start the recovery.
    const txHash = await relay([
      SafeAccount.createDeployWebAuthnVerifierMetaTransaction(publicKey.x, publicKey.y),
      recoveryModule.createMultiConfirmRecoveryMetaTransaction(
        wallet,
        [newOwner],
        1,
        [
          { signer: kitGuardian, signature: kitSignature },
          { signer: guardian.address, signature: swissquoteSignature },
        ],
        true,
      ),
    ])

    updateDb((db) => {
      db.kycSessions[session.id].used = true
    })
    notifyClient(
      wallet,
      'A recovery of your wallet to a new device was requested. If this was not you, cancel it from your current device.',
    )

    const after = await getRecoveryStatus(wallet)
    return Response.json({ txHash, newOwner, executeAfter: after.pending?.executeAfter ?? null })
  } catch (error) {
    console.error(error)
    return fail(error instanceof Error ? error.message : 'Recovery request failed', 500)
  }
}

function fail(error: string, status = 400) {
  return Response.json({ error }, { status })
}
