import { isAddress, isHex, recoverTypedDataAddress, type Address, type Hex } from 'viem'

import { evictionTypedData, readAccount, startEvictionCall } from '@/lib/account'
import { guardianAccount, relay } from '@/server/guardian'
import { getKycSession, notifyClient, saveEviction, saveKycSession, type KycSession } from '@/server/store'

const KYC_SESSION_TTL_MS = 15 * 60 * 1000

type Body = {
  account?: string
  newOwners?: string[]
  guardianSignature?: string
  kycSessionId?: string
}

/**
 * Start a time-locked eviction of the Key Safe (ADR-019, PDR-021). Always sponsored (PDR-019).
 *
 * The backend only relays "replace the phone": exactly one owner changes and it must be the
 * Key Safe (the allowance delegate), so the Kit or a security key can never be evicted this way.
 *  - level 0 (Kit guardian only): relays the Kit guardian key's signature;
 *  - level 1 (+ Swissquote guardian): requires a fresh verified KYC session for this Account
 *    (PDR-006), then the Swissquote guardian co-signs.
 * The delay then runs on-chain; 2 factors can cancel it, the thief cannot.
 */
export async function POST(request: Request) {
  try {
    const { account, newOwners, guardianSignature, kycSessionId } = (await request.json()) as Body
    if (!account || !isAddress(account)) return fail('Invalid Account address')
    if (!Array.isArray(newOwners) || newOwners.length < 2 || !newOwners.every((o) => isAddress(o))) {
      return fail('Invalid new owners')
    }
    if (new Set(newOwners.map((o) => o.toLowerCase())).size !== newOwners.length) return fail('Duplicate new owners')
    if (!guardianSignature || !isHex(guardianSignature)) return fail('Missing guardian signature')

    const state = await readAccount(account)
    if (!state.deployed || !state.evictionModule) return fail('This Account has no eviction module', 404)
    if (state.pendingEviction) return fail('An eviction is already pending for this Account', 409)

    // Policy: replace exactly one owner, and only the Key Safe.
    const current = state.owners.map((o) => o.toLowerCase())
    const next = newOwners.map((o) => o.toLowerCase())
    const removed = current.filter((o) => !next.includes(o))
    const added = next.filter((o) => !current.includes(o))
    const keySafe = state.allowance?.delegate.toLowerCase()
    if (next.length !== current.length || removed.length !== 1 || added.length !== 1) {
      return fail('An eviction replaces exactly one owner: the phone (Key Safe)')
    }
    if (!keySafe || removed[0] !== keySafe) return fail('Only the phone (Key Safe) can be evicted', 403)

    // The guardian signature must come from a guardian of this Account (not Swissquote).
    const typedData = await evictionTypedData(account, state.evictionModule, newOwners as Address[])
    const signer = await recoverTypedDataAddress({ ...typedData, signature: guardianSignature as Hex })
    const swissquote = await guardianAccount()
    const guardians = state.guardians.map((g) => g.toLowerCase())
    if (!guardians.includes(signer.toLowerCase()) || signer.toLowerCase() === swissquote.address.toLowerCase()) {
      return fail('The signature is not from a guardian of this Account', 403)
    }

    const level: 0 | 1 = guardians.includes(swissquote.address.toLowerCase()) ? 1 : 0
    const signatures = [{ signer: signer as string, signature: guardianSignature as string }]
    let verifiedSession: KycSession | null = null
    if (level === 1) {
      const session = kycSessionId ? await getKycSession(kycSessionId) : null
      if (
        !session ||
        session.wallet !== account.toLowerCase() ||
        session.status !== 'verified' ||
        session.used ||
        Date.now() - session.createdAt > KYC_SESSION_TTL_MS
      ) {
        return fail('Identity verification required', 403)
      }
      verifiedSession = session
      signatures.push({ signer: swissquote.address, signature: await swissquote.signTypedData(typedData) })
    }
    if (signatures.length < state.guardianThreshold) return fail('Not enough guardian approvals', 403)

    const startTx = await relay([startEvictionCall(account, state.evictionModule, newOwners as Address[], signatures)])
    const executeAfter = (await readAccount(account)).pendingEviction?.executeAfter ?? 0
    if (verifiedSession) await saveKycSession({ ...verifiedSession, used: true })
    await saveEviction({
      account,
      level,
      oldKeySafe: keySafe,
      newOwners,
      startTx,
      executeAfter,
      status: 'pending',
      startedAt: Date.now(),
    })
    await notifyClient(
      account,
      `A replacement of your phone started. It takes effect at ${new Date(executeAfter * 1000).toISOString()}. ` +
        'If this was not you, cancel it now with Face ID + your Kit passphrase.',
    )
    return Response.json({ txHash: startTx, executeAfter, level })
  } catch (error) {
    console.error(error)
    return fail(error instanceof Error ? error.message : 'Eviction failed', 500)
  }
}

function fail(error: string, status = 400) {
  return Response.json({ error }, { status })
}
