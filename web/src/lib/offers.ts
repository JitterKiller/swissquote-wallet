import { api } from './api'

/**
 * The offers (PDR-019, issue #22, ADR-039): Free (level 0, everyone), Client (a linked Swissquote
 * client, level 1) and Premium "Theft protection" (a linked client with a subscription). Basic
 * security is the same in all three. Shared by the client and the MOCK backend (`server/offers.ts`).
 */

export type OfferId = 'free' | 'client' | 'premium'

/** MOCK: Premium as Swissquote's billing would record it. No payment is taken and no key ships. */
export type Subscription = {
  clientId: string
  plan: 'premium'
  since: number
  /** When "Order my security key" was used (MOCK shipping), or null. */
  keyOrderedAt: number | null
}

export type OfferStatus = {
  subscription: Subscription | null
  /** Network fees Swissquote covers each month at level 0 (ADR-023). */
  sponsoredPerMonth: number
}

export type OfferAction = 'subscribe' | 'order-key' | 'end'

/** The caller's subscription, if any. MOCK auth: `?clientId=` stands in for the e-banking session. */
export const getOfferStatus = (clientId?: string | null) =>
  api<OfferStatus>(clientId ? `/api/offers?clientId=${encodeURIComponent(clientId)}` : '/api/offers')

/** MOCK: subscribe to Premium, order its security key, or end it. */
export const changeOffer = (clientId: string, action: OfferAction) => api<OfferStatus>('/api/offers', { clientId, action })

/** The offer a wallet is on: Premium needs the link and a subscription, Client the link alone. */
export const offerOf = (linked: boolean, subscription: Subscription | null): OfferId =>
  !linked ? 'free' : subscription ? 'premium' : 'client'
