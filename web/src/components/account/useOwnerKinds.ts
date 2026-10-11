'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'

import type { AccountState } from '@/lib/account'
import { kitAddresses } from '@/lib/recoveryKit'
import { loadLocalKit, loadSecurityKey } from '@/lib/storage'
import { publicClient } from '@/lib/wallet'

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase()

/**
 * Which owner is which (#26, #17): this phone's Key Safe, the Kit's owner key (an EOA) and the security
 * key (a WebAuthn verifier proxy, a contract). This device's public records name them first; otherwise
 * the chain does: the app only ever adds the Kit and, at most, one key as the other owners.
 */
export function useOwnerKinds(state: Pick<AccountState, 'owners'>, keySafe: Address) {
  const [records] = useState(() => ({ kit: loadLocalKit(), key: loadSecurityKey() }))
  const others = state.owners.filter((o) => !same(o, keySafe))
  const ownersKey = others.join(',')
  const [code, setCode] = useState<{ key: string; contracts: Address[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    const list = ownersKey ? (ownersKey.split(',') as Address[]) : []
    Promise.all(list.map(async (o) => ((await publicClient.getCode({ address: o }))?.length ?? 0) > 2))
      .then((flags) => !cancelled && setCode({ key: ownersKey, contracts: list.filter((_, i) => flags[i]) }))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [ownersKey])

  const fromKit = records.kit ? kitAddresses(records.kit).owner : null
  const contracts = code?.key === ownersKey ? code.contracts : null
  const keyOwner =
    others.find((o) => same(o, records.key?.proxy)) ?? (contracts ? (others.find((o) => contracts.some((c) => same(c, o))) ?? null) : null)
  const kitOwner =
    others.find((o) => same(o, fromKit)) ??
    (keyOwner ? (others.filter((o) => !same(o, keyOwner)).length === 1 ? others.find((o) => !same(o, keyOwner))! : null) : others.length === 1 ? others[0] : null)
  const unknown = others.filter((o) => !same(o, kitOwner) && !same(o, keyOwner))
  return { kitOwner, keyOwner, unknown, checked: contracts !== null }
}
