import type { DailyJournal, Trade } from '@/types'

const DB_NAME = 'trade-reflection-offline-cache'
const DB_VERSION = 1
const STORE_TRADES = 'tradesByAccount'
const STORE_JOURNALS = 'journalsByMonth'

interface TradesCacheRecord {
  key: string
  updatedAt: number
  trades: Trade[]
}

interface JournalsCacheRecord {
  key: string
  updatedAt: number
  journals: DailyJournal[]
}

let openDbPromise: Promise<IDBDatabase> | null = null

function openCacheDb(): Promise<IDBDatabase> {
  if (openDbPromise) return openDbPromise

  openDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains(STORE_TRADES)) {
        db.createObjectStore(STORE_TRADES, { keyPath: 'key' })
      }

      if (!db.objectStoreNames.contains(STORE_JOURNALS)) {
        db.createObjectStore(STORE_JOURNALS, { keyPath: 'key' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Failed to open offline cache DB'))
  })

  return openDbPromise
}

function getRecord<T>(storeName: string, key: string): Promise<T | null> {
  return openCacheDb().then(
    (db) =>
      new Promise<T | null>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly')
        const store = tx.objectStore(storeName)
        const req = store.get(key)

        req.onsuccess = () => resolve((req.result as T | undefined) ?? null)
        req.onerror = () => reject(req.error ?? new Error(`Failed to read cache key ${key}`))
      })
  )
}

function putRecord<T>(storeName: string, value: T): Promise<void> {
  return openCacheDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        const req = store.put(value)

        req.onerror = () => reject(req.error ?? new Error('Failed to write cache record'))
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('Failed to commit cache transaction'))
      })
  )
}

function tradesKey(userId: string, accountId: string): string {
  return `${userId}::${accountId}`
}

function journalsKey(userId: string, year: number, month: number): string {
  return `${userId}::${year}-${String(month).padStart(2, '0')}`
}

export async function saveTradesCache(userId: string, accountId: string, trades: Trade[]): Promise<void> {
  const record: TradesCacheRecord = {
    key: tradesKey(userId, accountId),
    updatedAt: Date.now(),
    trades,
  }
  await putRecord(STORE_TRADES, record)
}

export async function loadTradesCache(userId: string, accountId: string): Promise<Trade[] | null> {
  const record = await getRecord<TradesCacheRecord>(STORE_TRADES, tradesKey(userId, accountId))
  return record?.trades ?? null
}

export async function saveJournalsCache(
  userId: string,
  year: number,
  month: number,
  journals: DailyJournal[]
): Promise<void> {
  const record: JournalsCacheRecord = {
    key: journalsKey(userId, year, month),
    updatedAt: Date.now(),
    journals,
  }
  await putRecord(STORE_JOURNALS, record)
}

export async function loadJournalsCache(
  userId: string,
  year: number,
  month: number
): Promise<DailyJournal[] | null> {
  const record = await getRecord<JournalsCacheRecord>(STORE_JOURNALS, journalsKey(userId, year, month))
  return record?.journals ?? null
}
