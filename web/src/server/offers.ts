import type { OfferAction, OfferStatus, Subscription } from '@/lib/offers'

import { getWalletByClient } from './registry'
import { SPONSORED_OPS_PER_MONTH } from './sponsorship'
import { store } from './store'

/**
 * MOCK: Premium "Theft protection" (PDR-019, issue #22, ADR-039). Stands in for Swissquote's
 * subscription billing and the shipping of the security key: no payment is taken and nothing
 * ships. One record per Swissquote client in the `subscriptions` collection (ADR-020).
 *
 * Premium is for linked clients only (the registry, ADR-021). It changes nothing onchain: the key's
 * powers come from adding it as an owner of the Account (#17), which any level can do.
 */

const COLLECTION = 'subscriptions'

export class OfferError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

const status = (subscription: Subscription | null): OfferStatus => ({ subscription, sponsoredPerMonth: SPONSORED_OPS_PER_MONTH })

export async function getOfferStatus(clientId?: string): Promise<OfferStatus> {
  return status(clientId ? await store().get<Subscription>(COLLECTION, clientId) : null)
}

export async function changeOffer(input: { clientId?: string; action?: OfferAction }): Promise<OfferStatus> {
  const { clientId, action } = input
  if (!clientId) throw new OfferError('Sign in with Swissquote first', 401)
  const current = await store().get<Subscription>(COLLECTION, clientId)

  switch (action) {
    case 'subscribe': {
      if (!(await getWalletByClient(clientId))) throw new OfferError('Premium is for Swissquote clients who linked this wallet', 403)
      if (current) return status(current)
      const subscription: Subscription = { clientId, plan: 'premium', since: Date.now(), keyOrderedAt: null }
      await store().set(COLLECTION, clientId, subscription)
      return status(subscription)
    }
    case 'order-key': {
      if (!current) throw new OfferError('Subscribe to Premium first', 409)
      if (current.keyOrderedAt) return status(current)
      const subscription: Subscription = { ...current, keyOrderedAt: Date.now() }
      await store().set(COLLECTION, clientId, subscription)
      return status(subscription)
    }
    case 'end':
      await store().delete(COLLECTION, clientId)
      return status(null)
    default:
      throw new OfferError('Unknown action')
  }
}
