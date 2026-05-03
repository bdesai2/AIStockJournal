import { useEffect, useState } from 'react'

/**
 * Real-time status monitoring hook
 * Tracks connection state and displays indicators in the UI
 */

export const REALTIME_HEARTBEAT_EVENT = 'trade-reflection:realtime-heartbeat'
const LAST_SYNC_STORAGE_KEY = 'trade_reflection_last_sync_ts'

export interface RealtimeStatus {
  isConnected: boolean
  connectionQuality: 'excellent' | 'good' | 'poor' | 'offline'
  lastUpdate: Date | null
  subscriptionCount: number
}

function getStoredLastSync(): Date | null {
  const raw = localStorage.getItem(LAST_SYNC_STORAGE_KEY)
  if (!raw) return null

  const ts = Number(raw)
  if (!Number.isFinite(ts) || ts <= 0) return null

  return new Date(ts)
}

function getConnectionQuality(isOnline: boolean, lastUpdate: Date | null): RealtimeStatus['connectionQuality'] {
  if (!isOnline) return 'offline'
  if (!lastUpdate) return 'poor'

  const ageMs = Date.now() - lastUpdate.getTime()
  if (ageMs <= 60_000) return 'excellent'
  if (ageMs <= 180_000) return 'good'
  return 'poor'
}

/**
 * Hook to monitor Realtime connection status
 * Note: Currently simplified; Supabase JS SDK doesn't expose detailed realtime metrics
 */
export function useRealtimeStatus(): RealtimeStatus {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(() => getStoredLastSync())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)

    const onRealtimeHeartbeat = (event: Event) => {
      const customEvent = event as CustomEvent<{ ts?: number }>
      const ts = customEvent.detail?.ts ?? Date.now()
      localStorage.setItem(LAST_SYNC_STORAGE_KEY, String(ts))
      setLastUpdate(new Date(ts))
    }

    const timer = window.setInterval(() => {
      // Keep relative timestamps fresh ("x seconds ago")
      setNow(Date.now())
    }, 30_000)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener(REALTIME_HEARTBEAT_EVENT, onRealtimeHeartbeat as EventListener)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener(REALTIME_HEARTBEAT_EVENT, onRealtimeHeartbeat as EventListener)
    }
  }, [])

  const connectionQuality = getConnectionQuality(isOnline, lastUpdate)

  // read `now` so hook recalculates quality over time after last update
  void now

  return {
    isConnected: isOnline && connectionQuality !== 'offline',
    connectionQuality,
    lastUpdate,
    subscriptionCount: 4, // trades, executions, screenshots, journals
  }
}

/**
 * Hook to display realtime connection status (optional UI component)
 * Can be used to show a connection indicator in the UI
 */
export function useRealtimeIndicator() {
  const status = useRealtimeStatus()

  const getLastSyncedLabel = () => {
    if (!status.lastUpdate) return 'Never synced'

    const elapsedMs = Date.now() - status.lastUpdate.getTime()
    if (elapsedMs < 10_000) return 'Synced just now'

    const seconds = Math.floor(elapsedMs / 1000)
    if (seconds < 60) return `Synced ${seconds}s ago`

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `Synced ${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    return `Synced ${hours}h ago`
  }

  const getIndicatorColor = () => {
    if (!status.isConnected) return 'bg-[#ff4d6d]' // Red
    if (status.connectionQuality === 'excellent') return 'bg-[#00d4a1]' // Green
    if (status.connectionQuality === 'good') return 'bg-[#f0b429]' // Amber
    return 'bg-[#ff4d6d]' // Red for poor
  }

  const getIndicatorText = () => {
    if (!status.isConnected) return 'Offline'
    return 'Live'
  }

  return {
    color: getIndicatorColor(),
    text: getIndicatorText(),
    lastSyncedLabel: getLastSyncedLabel(),
    isConnected: status.isConnected,
    quality: status.connectionQuality,
    subscriptionCount: status.subscriptionCount,
  }
}
