import { getAddress, isAddress, isHex, parseAbi, recoverMessageAddress } from 'viem'

import { isDeployed, publicClient } from '@/lib/wallet'
import { getKycSession, notifyClient, saveKycSession, store } from '@/server/store'
import { getWalletByKeySafe } from '@/server/registry'

/**
 * Report a stolen phone (PDR-017 step 3, issue #23): Swissquote stops sponsoring the
 * operations of that Key Safe. Friction, not a veto: nothing is blocked on-chain.
 *
 * Proof that the reporter owns the wallet:
 *  - level 1: a fresh, verified identity session (PDR-006) for the registered Account;
 *  - any level: a Recovery Kit signature over the report message, the Kit being an owner of
 *    the Account (ADR-017).
 */
const SIGNATURE_TTL_S = 10 * 60
const safeAbi = parseAbi(['function isOwner(address owner) view returns (bool)'])

export const reportMessage = (keySafe: string, account: string, issuedAt: number) =>
  `Swissquote Wallet: report stolen device ${getAddress(keySafe)} of Account ${getAddress(account)} at ${issuedAt}`

type Body = { keySafe?: string; account?: string; kycSessionId?: string; issuedAt?: number; kitSignature?: string }

export async function POST(request: Request) {
  try {
    const { keySafe, account, kycSessionId, issuedAt, kitSignature } = (await request.json()) as Body
    if (!keySafe || !isAddress(keySafe) || !account || !isAddress(account)) {
      return fail('keySafe and account are required')
    }
    let via: 'kyc' | 'kit'
    if (kycSessionId) {
      const linked = await getWalletByKeySafe(keySafe)
      const session = await getKycSession(kycSessionId)
      if (
        !linked ||
        linked.account.toLowerCase() !== account.toLowerCase() ||
        !session ||
        session.status !== 'verified' ||
        session.used ||
        session.wallet !== account.toLowerCase()
      ) {
        return fail('Identity verification for this linked Account is required', 403)
      }
      await saveKycSession({ ...session, used: true })
      via = 'kyc'
    } else {
      if (!kitSignature || !isHex(kitSignature) || !issuedAt) return fail('Kit signature or identity session required')
      if (Math.abs(Date.now() / 1000 - issuedAt) > SIGNATURE_TTL_S) return fail('Expired report signature', 403)
      const kit = await recoverMessageAddress({ message: reportMessage(keySafe, account, issuedAt), signature: kitSignature })
      const isKitOwner =
        getAddress(account) !== getAddress(keySafe) && (await isDeployed(getAddress(account)))
          ? await publicClient.readContract({ address: getAddress(account), abi: safeAbi, functionName: 'isOwner', args: [kit] })
          : false
      if (!isKitOwner) return fail('This Recovery Kit does not belong to this wallet', 403)
      via = 'kit'
    }

    await store().set('stolenKeySafes', keySafe.toLowerCase(), {
      keySafe: getAddress(keySafe),
      account: getAddress(account),
      via,
      reportedAt: Date.now(),
    })
    await notifyClient(account, 'A device was reported stolen. Swissquote no longer sponsors its operations.')
    return Response.json({ reported: true, via })
  } catch (error) {
    console.error(error)
    return fail(error instanceof Error ? error.message : 'Report failed', 500)
  }
}

function fail(error: string, status = 400) {
  return Response.json({ error }, { status })
}
