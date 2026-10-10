import fs from 'node:fs'
import path from 'node:path'

/**
 * MOCK persistence for the Swissquote backend: one JSON file in `web/.data/`
 * (gitignored). Stands in for Swissquote's databases. Not suitable for
 * serverless deployments (read-only filesystem).
 */

export type KycSession = {
  id: string
  wallet: string
  status: 'verified' | 'failed'
  createdAt: number
  used: boolean
}

export type ClientNotification = {
  wallet: string
  channels: string[]
  message: string
  at: number
}

/** A time-locked eviction relayed by the backend (ADR-019, PDR-021). Keyed by Account (lowercase). */
export type EvictionRecord = {
  account: string
  level: 0 | 1
  oldKeySafe: string
  newOwners: string[]
  startTx: string
  executeAfter: number // unix seconds
  status: 'pending' | 'finalized'
  startedAt: number
  finalizeTx?: string
}

type Db = {
  guardianKey?: `0x${string}`
  kycSessions: Record<string, KycSession>
  notifications: ClientNotification[]
  evictions: Record<string, EvictionRecord>
}

const DIR = path.join(process.cwd(), '.data')
const FILE = path.join(DIR, 'db.json')

const EMPTY_DB = (): Db => ({ kycSessions: {}, notifications: [], evictions: {} })

export function readDb(): Db {
  try {
    // Older files may lack newer tables: fill in the defaults.
    return { ...EMPTY_DB(), ...(JSON.parse(fs.readFileSync(FILE, 'utf8')) as Partial<Db>) }
  } catch {
    return EMPTY_DB()
  }
}

export function updateDb<T>(fn: (db: Db) => T): T {
  const db = readDb()
  const result = fn(db)
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2))
  return result
}

/** MOCK: Swissquote would push to the app, email, SMS and the e-banking inbox. */
export function notifyClient(wallet: string, message: string) {
  const notification = {
    wallet,
    channels: ['push', 'email', 'sms', 'e-banking'],
    message,
    at: Date.now(),
  }
  updateDb((db) => db.notifications.push(notification))
  console.log(`[notify ${wallet}] ${message}`)
}
