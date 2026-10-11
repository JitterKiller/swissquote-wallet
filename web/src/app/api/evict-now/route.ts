import { isAddress, isHex, parseAbi, type Address, type Hex } from 'viem'

import { accountExecCall, contractSignature, encodeSafeSignatures, readAccount, replaceKeySafeCall } from '@/lib/account'
import { publicClient } from '@/lib/wallet'
import { relay, relayerAddress } from '@/server/guardian'
import { notifyClient } from '@/server/store'

type Body = {
  account?: string
  oldKeySafe?: string
  newKeySafe?: string
  kitOwner?: string
  kitSignature?: string
  keyProxy?: string
  keySignature?: string
}

const safeAbi = parseAbi(['function getOwners() view returns (address[])'])

/**
 * Immediate lock-out with the Kit and the security key (#17, PDR-017, ADR-038): two of the Account's
 * own owners replace the old phone's Key Safe and move the daily allowance to the new one, at once.
 * The Swissquote relayer only submits: it rebuilds the call from the chain (never relays calldata it
 * was given) and the Account checks both signatures. Always sponsored (a security operation).
 */
export async function POST(request: Request) {
  try {
    const { account, oldKeySafe, newKeySafe, kitOwner, kitSignature, keyProxy, keySignature } = (await request.json()) as Body
    if (![account, oldKeySafe, newKeySafe, kitOwner, keyProxy].every((a) => a && isAddress(a))) return fail('Invalid address')
    if (!kitSignature || !isHex(kitSignature) || !keySignature || !isHex(keySignature)) return fail('Invalid signatures')
    const [acc, oldKs, newKs, kit, key] = [account, oldKeySafe, newKeySafe, kitOwner, keyProxy] as Address[]

    const state = await readAccount(acc, { keySafe: oldKs })
    const owned = (a: Address) => state.owners.some((o) => o.toLowerCase() === a.toLowerCase())
    if (!owned(oldKs)) return fail('The old phone is no longer an owner', 409)
    if (!owned(kit) || !owned(key)) return fail('The Kit and the security key must both be owners of this Account', 409)
    if (owned(newKs)) return fail('This device is already an owner', 409)
    if (state.allowance?.delegate.toLowerCase() !== oldKs.toLowerCase()) return fail('The old phone does not hold the daily limit', 409)

    const replace = replaceKeySafeCall({
      account: acc,
      owners: state.owners,
      oldKeySafe: oldKs,
      newKeySafe: newKs,
      dailyLimit: state.allowance.amount,
      // A time-locked lock-out still running ends in the same transaction (the client builds the same call).
      cancelEviction: state.pendingEviction ? (state.evictionModule ?? undefined) : undefined,
    })
    const signatures = encodeSafeSignatures([{ kind: 'ecdsa', signer: kit, data: kitSignature as Hex }, contractSignature(key, keySignature as Hex)])
    const exec = accountExecCall(acc, replace, signatures)

    // Dry run from the relayer first: a wrong signature fails here with the Safe's reason, not in the bundler.
    try {
      await publicClient.call({ account: (await relayerAddress()) as Address, to: exec.to as Address, data: exec.data as Hex })
    } catch (error) {
      const reason = /GS0\d\d/.exec(error instanceof Error ? error.message : String(error))?.[0]
      return fail(reason === 'GS026' ? 'The Kit and the key did not both sign this lock-out (GS026).' : `The Account refused this lock-out${reason ? ` (${reason})` : ''}.`, 409)
    }

    const txHash = await relay([exec])
    await notifyClient(acc, 'Your old phone was locked out at once with your Recovery Kit and your security key.')
    const owners = await publicClient.readContract({ address: acc, abi: safeAbi, functionName: 'getOwners' })
    return Response.json({ txHash, owners })
  } catch (error) {
    console.error(error)
    return fail(error instanceof Error ? error.message : 'Lock-out failed', 500)
  }
}

function fail(error: string, status = 400) {
  return Response.json({ error }, { status })
}

