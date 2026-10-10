import fs from 'node:fs'
import path from 'node:path'

import { Redis } from '@upstash/redis'

/**
 * MOCK persistence for the Swissquote backend (ADR-020). Stands in for Swissquote's databases.
 *
 * - Deployed (Vercel): Upstash Redis, configured by the Vercel integration
 *   (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) or by `UPSTASH_REDIS_REST_URL` / `_TOKEN`.
 * - Local: one JSON file in `web/.data/db.json` (gitignored).
 *
 * The API is async and per record, so concurrent requests on a serverless platform never
 * overwrite each other's data. Add a new table by picking a collection name:
 * `store.set('wallets', id, value)`.
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

export interface Store {
  readonly kind: 'upstash-redis' | 'local-file'
  /** One record of a collection, or null. */
  get<T>(collection: string, id: string): Promise<T | null>
  set<T>(collection: string, id: string, value: T): Promise<void>
  /** Writes only if the record does not exist yet. Returns true if it was written. */
  setIfAbsent<T>(collection: string, id: string, value: T): Promise<boolean>
  delete(collection: string, id: string): Promise<void>
  /** Every record of a collection (fine for mock-sized data). */
  all<T>(collection: string): Promise<Record<string, T>>
  /** Atomic counter (quotas, rate limits). The TTL is set when the counter is created. */
  increment(counter: string, ttlSeconds?: number): Promise<number>
  /** Current value of a counter (0 if absent or expired). */
  count(counter: string): Promise<number>
  /** Appends to a capped log, newest first. */
  append<T>(log: string, value: T, maxLength?: number): Promise<void>
  recent<T>(log: string, count?: number): Promise<T[]>
}

const PREFIX = 'sq'

class RedisStore implements Store {
  readonly kind = 'upstash-redis'
  private readonly redis: Redis
  constructor(redis: Redis) {
    this.redis = redis
  }

  async get<T>(collection: string, id: string) {
    const raw = await this.redis.hget<string>(`${PREFIX}:${collection}`, id)
    return raw === null ? null : (JSON.parse(raw) as T)
  }
  async set<T>(collection: string, id: string, value: T) {
    await this.redis.hset(`${PREFIX}:${collection}`, { [id]: JSON.stringify(value) })
  }
  async setIfAbsent<T>(collection: string, id: string, value: T) {
    return (await this.redis.hsetnx(`${PREFIX}:${collection}`, id, JSON.stringify(value))) === 1
  }
  async delete(collection: string, id: string) {
    await this.redis.hdel(`${PREFIX}:${collection}`, id)
  }
  async all<T>(collection: string) {
    const raw = (await this.redis.hgetall<Record<string, string>>(`${PREFIX}:${collection}`)) ?? {}
    return Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, JSON.parse(value) as T]))
  }
  async increment(counter: string, ttlSeconds?: number) {
    const key = `${PREFIX}:counter:${counter}`
    const value = await this.redis.incr(key)
    if (value === 1 && ttlSeconds) await this.redis.expire(key, ttlSeconds)
    return value
  }
  async count(counter: string) {
    return Number((await this.redis.get<string>(`${PREFIX}:counter:${counter}`)) ?? 0)
  }
  async append<T>(log: string, value: T, maxLength = 500) {
    const key = `${PREFIX}:log:${log}`
    await this.redis.lpush(key, JSON.stringify(value))
    await this.redis.ltrim(key, 0, maxLength - 1)
  }
  async recent<T>(log: string, count = 50) {
    const raw = await this.redis.lrange<string>(`${PREFIX}:log:${log}`, 0, count - 1)
    return raw.map((value) => JSON.parse(value) as T)
  }
}

type FileData = {
  collections: Record<string, Record<string, unknown>>
  counters: Record<string, { value: number; expiresAt: number | null }>
  logs: Record<string, unknown[]>
}

/** Local development only: a single Node process, so synchronous file access is safe. */
class FileStore implements Store {
  readonly kind = 'local-file'
  private readonly dir = path.join(process.cwd(), '.data')
  private readonly file = path.join(this.dir, 'db.json')

  private read(): FileData {
    let raw: Record<string, unknown>
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      return { collections: {}, counters: {}, logs: {} }
    }
    if (raw.collections) return raw as unknown as FileData
    // Pre-ADR-020 format ({ guardianKey, kycSessions, notifications }): keep the team's guardian keys.
    return {
      collections: {
        config: raw.guardianKey ? { guardianKey: raw.guardianKey } : {},
        kycSessions: (raw.kycSessions as Record<string, unknown>) ?? {},
        evictions: (raw.evictions as Record<string, unknown>) ?? {},
      },
      counters: {},
      logs: { notifications: ((raw.notifications as unknown[]) ?? []).slice().reverse() },
    }
  }

  private update<T>(fn: (data: FileData) => T): T {
    const data = this.read()
    const result = fn(data)
    fs.mkdirSync(this.dir, { recursive: true })
    fs.writeFileSync(this.file, JSON.stringify(data, null, 2))
    return result
  }

  async get<T>(collection: string, id: string) {
    return (this.read().collections[collection]?.[id] as T | undefined) ?? null
  }
  async set<T>(collection: string, id: string, value: T) {
    this.update((data) => {
      data.collections[collection] = { ...data.collections[collection], [id]: value }
    })
  }
  async setIfAbsent<T>(collection: string, id: string, value: T) {
    return this.update((data) => {
      if (data.collections[collection]?.[id] !== undefined) return false
      data.collections[collection] = { ...data.collections[collection], [id]: value }
      return true
    })
  }
  async delete(collection: string, id: string) {
    this.update((data) => {
      delete data.collections[collection]?.[id]
    })
  }
  async all<T>(collection: string) {
    return (this.read().collections[collection] ?? {}) as Record<string, T>
  }
  async increment(counter: string, ttlSeconds?: number) {
    return this.update((data) => {
      const now = Date.now()
      const current = data.counters[counter]
      const live = current && (current.expiresAt === null || current.expiresAt > now) ? current : undefined
      const next = {
        value: (live?.value ?? 0) + 1,
        expiresAt: live ? live.expiresAt : ttlSeconds ? now + ttlSeconds * 1000 : null,
      }
      data.counters[counter] = next
      return next.value
    })
  }
  async count(counter: string) {
    const current = this.read().counters[counter]
    return current && (current.expiresAt === null || current.expiresAt > Date.now()) ? current.value : 0
  }
  async append<T>(log: string, value: T, maxLength = 500) {
    this.update((data) => {
      data.logs[log] = [value, ...(data.logs[log] ?? [])].slice(0, maxLength)
    })
  }
  async recent<T>(log: string, count = 50) {
    return ((this.read().logs[log] ?? []) as T[]).slice(0, count)
  }
}

function createStore(): Store {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) return new RedisStore(new Redis({ url, token, automaticDeserialization: false }))
  if (process.env.VERCEL) {
    throw new Error(
      'No store configured: connect Upstash Redis to the Vercel project (Storage → Upstash), see ADR-020.',
    )
  }
  return new FileStore()
}

let instance: Store | undefined

/** The backend store. Created lazily, so a missing configuration fails the request, not the build. */
export function store(): Store {
  instance ??= createStore()
  return instance
}

// ── Domain helpers ────────────────────────────────────────────────────────────

export const getKycSession = (id: string) => store().get<KycSession>('kycSessions', id)
export const saveKycSession = (session: KycSession) => store().set('kycSessions', session.id, session)

/** One eviction per Account (ADR-019), keyed by the lowercase Account address. */
export const getEviction = (account: string) => store().get<EvictionRecord>('evictions', account.toLowerCase())
export const saveEviction = (record: EvictionRecord) => store().set('evictions', record.account.toLowerCase(), record)

/** MOCK: Swissquote would push to the app, email, SMS and the e-banking inbox. */
export async function notifyClient(wallet: string, message: string) {
  const notification: ClientNotification = {
    wallet,
    channels: ['push', 'email', 'sms', 'e-banking'],
    message,
    at: Date.now(),
  }
  await store().append('notifications', notification)
  console.log(`[notify ${wallet}] ${message}`)
}
