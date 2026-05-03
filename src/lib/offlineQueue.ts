export type OfflineEntity = 'trade' | 'journal'
export type OfflineAction = 'create' | 'update' | 'delete' | 'upsert'
export const OFFLINE_QUEUE_UPDATED_EVENT = 'trade-reflection:offline-queue-updated'
const OFFLINE_FAILURES_KEY = 'trade_reflection_offline_failures_v1'

export interface OfflineQueueItem<TPayload = unknown> {
  id: string
  entity: OfflineEntity
  action: OfflineAction
  payload: TPayload
  queuedAt: string
}

export interface OfflineSyncFailure {
  id: string
  entity: OfflineEntity
  action: OfflineAction
  queuedAt: string
  attempts: number
  lastAttemptAt: string
  lastError: string
}

const OFFLINE_QUEUE_KEY = 'trade_reflection_offline_queue_v1'

function readQueue(): OfflineQueueItem[] {
  const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as OfflineQueueItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readFailures(): OfflineSyncFailure[] {
  const raw = localStorage.getItem(OFFLINE_FAILURES_KEY)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as OfflineSyncFailure[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeFailures(items: OfflineSyncFailure[]) {
  localStorage.setItem(OFFLINE_FAILURES_KEY, JSON.stringify(items))
}

function writeQueue(items: OfflineQueueItem[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items))

  const queueIds = new Set(items.map((item) => item.id))
  const filteredFailures = readFailures().filter((failure) => queueIds.has(failure.id))
  writeFailures(filteredFailures)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT, {
        detail: {
          total: items.length,
          trades: items.filter((item) => item.entity === 'trade').length,
          journals: items.filter((item) => item.entity === 'journal').length,
          failures: filteredFailures.length,
        },
      })
    )
  }
}

function nextQueueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function getOfflineQueue(entity?: OfflineEntity): OfflineQueueItem[] {
  const all = readQueue()
  if (!entity) return all
  return all.filter((item) => item.entity === entity)
}

export function enqueueOfflineMutation<TPayload>(
  entity: OfflineEntity,
  action: OfflineAction,
  payload: TPayload
): OfflineQueueItem<TPayload> {
  const next: OfflineQueueItem<TPayload> = {
    id: nextQueueId(),
    entity,
    action,
    payload,
    queuedAt: new Date().toISOString(),
  }

  const all = readQueue()
  all.push(next as OfflineQueueItem)
  writeQueue(all)
  return next
}

export function removeOfflineMutation(id: string) {
  const next = readQueue().filter((item) => item.id !== id)
  writeQueue(next)
}

export function replaceOfflineQueue(items: OfflineQueueItem[]) {
  writeQueue(items)
}

export function getOfflineQueueCount(entity?: OfflineEntity): number {
  return getOfflineQueue(entity).length
}

export function markOfflineMutationFailed(
  item: Pick<OfflineQueueItem, 'id' | 'entity' | 'action' | 'queuedAt'>,
  errorMessage: string
) {
  const all = readFailures()
  const existing = all.find((failure) => failure.id === item.id)

  const nextFailure: OfflineSyncFailure = {
    id: item.id,
    entity: item.entity,
    action: item.action,
    queuedAt: item.queuedAt,
    attempts: (existing?.attempts ?? 0) + 1,
    lastAttemptAt: new Date().toISOString(),
    lastError: errorMessage,
  }

  const next = existing
    ? all.map((failure) => (failure.id === item.id ? nextFailure : failure))
    : [...all, nextFailure]

  writeFailures(next)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT, {
        detail: {
          total: getOfflineQueueCount(),
          trades: getOfflineQueueCount('trade'),
          journals: getOfflineQueueCount('journal'),
          failures: next.length,
        },
      })
    )
  }
}

export function getOfflineSyncFailures(): OfflineSyncFailure[] {
  return readFailures()
}

export function getOfflineSyncFailureCount(): number {
  return readFailures().length
}

export function getOfflineSyncFailureSummary(): string | null {
  const failures = readFailures()
  if (failures.length === 0) return null

  const latest = [...failures].sort((a, b) => b.lastAttemptAt.localeCompare(a.lastAttemptAt))[0]
  return `${latest.entity} ${latest.action} failed: ${latest.lastError}`
}
