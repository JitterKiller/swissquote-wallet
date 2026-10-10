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

type Db = {
  guardianKey?: `0x${string}`
  kycSessions: Record<string, KycSession>
  notifications: ClientNotification[]
}

const DIR = path.join(process.cwd(), '.data')
const FILE = path.join(DIR, 'db.json')

export function readDb(): Db {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as Db
  } catch {
    return { kycSessions: {}, notifications: [] }
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
