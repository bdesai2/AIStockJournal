import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useNotificationStore } from '@/store/notificationStore'
import { useAuthStore } from '@/store/authStore'
import type { Trade } from '@/types'
import { REALTIME_HEARTBEAT_EVENT } from '@/hooks/useRealtimeStatus'

function markRealtimeHeartbeat(source: string) {
  if (typeof window === 'undefined') return

  const ts = Date.now()
  window.localStorage.setItem('trade_reflection_last_sync_ts', String(ts))
  window.dispatchEvent(
    new CustomEvent(REALTIME_HEARTBEAT_EVENT, {
      detail: { source, ts },
    })
  )
}

/**
 * Hook to subscribe to real-time trade updates via Supabase Realtime
 * Listens for INSERT, UPDATE events on the trades table and displays notifications
 */
export function useTradeRealtimeSubscriptions() {
  const { user, selectedAccountId } = useAuthStore()
  const { push } = useNotificationStore.getState()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscriptionRef = useRef<boolean>(false)

  useEffect(() => {
    if (!user?.id || !selectedAccountId || subscriptionRef.current) {
      return
    }

    subscriptionRef.current = true

    // Subscribe to real-time changes on the trades table
    // Filter by user_id and account_id to only receive relevant trades
    const channel = supabase
      .channel(`trades-${user.id}-${selectedAccountId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'trades',
          filter: `user_id=eq.${user.id}`, // Only trades for current user
        },
        (payload) => {
          markRealtimeHeartbeat('trades-event')

          const operation = payload.eventType
          const newTrade = payload.new as Trade | null
          const oldTrade = payload.old as Trade | null

          // Skip if trade doesn't belong to current account
          if (newTrade && newTrade.account_id !== selectedAccountId) {
            return
          }

          // Handle different events
          if (operation === 'INSERT' && newTrade) {
            push({
              kind: 'trade_created',
              variant: 'success',
              title: 'Trade Created',
              message: `${newTrade.direction.toUpperCase()} ${newTrade.ticker} at $${newTrade.entry_price} • ${newTrade.asset_type}`,
              tradeId: newTrade.id,
            })
          } else if (operation === 'UPDATE' && newTrade && oldTrade) {
            // Only notify on certain field changes to avoid spam
            const fieldsChanged = getSignificantFieldChanges(oldTrade, newTrade)

            if (fieldsChanged.includes('status')) {
              const status = newTrade.status
              const message =
                status === 'closed'
                  ? `Trade closed • Net P&L: ${newTrade.net_pnl ? (newTrade.net_pnl >= 0 ? '+' : '') + newTrade.net_pnl.toFixed(2) : 'N/A'}`
                  : `Status changed to ${status}`

              push({
                kind: 'trade_status_changed',
                variant: newTrade.net_pnl && newTrade.net_pnl >= 0 ? 'success' : 'warning',
                title: `Trade ${status.toUpperCase()}`,
                message,
                tradeId: newTrade.id,
              })
            } else if (fieldsChanged.includes('ai_grade')) {
              push({
                kind: 'ai_graded',
                variant: 'info',
                title: 'Trade Graded',
                message: `AI Grade: ${newTrade.ai_grade} (Setup Score: ${newTrade.ai_setup_score ?? 'N/A'}/100)`,
                tradeId: newTrade.id,
              })
            } else if (
              fieldsChanged.some((f) => ['exit_price', 'exit_date', 'net_pnl'].includes(f))
            ) {
              push({
                kind: 'trade_updated',
                variant: 'info',
                title: 'Trade Updated',
                message: `${newTrade.ticker} • P&L: ${newTrade.net_pnl ? (newTrade.net_pnl >= 0 ? '+' : '') + newTrade.net_pnl.toFixed(2) : 'N/A'}`,
                tradeId: newTrade.id,
              })
            }
          } else if (operation === 'DELETE' && oldTrade) {
            push({
              kind: 'trade_deleted',
              variant: 'warning',
              title: 'Trade Deleted',
              message: `${oldTrade.ticker} deleted (was ${oldTrade.net_pnl ? (oldTrade.net_pnl >= 0 ? '+' : '') + oldTrade.net_pnl.toFixed(2) : 'N/A'})`,
            })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          markRealtimeHeartbeat('trades-subscribed')
          console.log('✅ Realtime trade subscriptions active')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error')
        } else if (status === 'CLOSED') {
          console.log('🔌 Realtime subscription closed')
        }
      })

    channelRef.current = channel

    return () => {
      // Cleanup: unsubscribe when component unmounts or dependencies change
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      subscriptionRef.current = false
    }
  }, [user?.id, selectedAccountId])
}

/**
 * Helper function to detect significant field changes
 * Returns array of field names that changed in meaningful ways
 */
function getSignificantFieldChanges(oldTrade: Trade, newTrade: Trade): string[] {
  const changed: string[] = []

  // Check significant fields
  const fieldsToWatch: (keyof Trade)[] = [
    'status',
    'exit_price',
    'exit_date',
    'net_pnl',
    'ai_grade',
    'ai_setup_score',
    'setup_notes',
    'mistakes',
    'lessons',
  ]

  for (const field of fieldsToWatch) {
    if (oldTrade[field] !== newTrade[field]) {
      changed.push(field)
    }
  }

  return changed
}

/**
 * Hook to subscribe to execution (multi-leg trade) updates
 */
export function useExecutionRealtimeSubscriptions() {
  const { user } = useAuthStore()
  const { push } = useNotificationStore.getState()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscriptionRef = useRef<boolean>(false)

  useEffect(() => {
    if (!user?.id || subscriptionRef.current) {
      return
    }

    subscriptionRef.current = true

    const channel = supabase
      .channel(`executions-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_executions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          markRealtimeHeartbeat('executions-event')

          const execution = payload.new
          if (execution) {
            push({
              kind: 'execution_added',
              variant: 'info',
              title: 'Trade Leg Executed',
              message: `Execution added to trade`,
              tradeId: execution.trade_id,
            })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          markRealtimeHeartbeat('executions-subscribed')
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      subscriptionRef.current = false
    }
  }, [user?.id])
}

/**
 * Hook to subscribe to screenshot uploads
 */
export function useScreenshotRealtimeSubscriptions() {
  const { user } = useAuthStore()
  const { push } = useNotificationStore.getState()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscriptionRef = useRef<boolean>(false)

  useEffect(() => {
    if (!user?.id || subscriptionRef.current) {
      return
    }

    subscriptionRef.current = true

    const channel = supabase
      .channel(`screenshots-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_screenshots',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          markRealtimeHeartbeat('screenshots-event')

          push({
            kind: 'screenshot_uploaded',
            variant: 'success',
            title: 'Screenshot Uploaded',
            message: 'Trade screenshot saved',
          })
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          markRealtimeHeartbeat('screenshots-subscribed')
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      subscriptionRef.current = false
    }
  }, [user?.id])
}

/**
 * Hook to subscribe to journal entry updates
 */
export function useJournalRealtimeSubscriptions() {
  const { user } = useAuthStore()
  const { push } = useNotificationStore.getState()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const subscriptionRef = useRef<boolean>(false)

  useEffect(() => {
    if (!user?.id || subscriptionRef.current) {
      return
    }

    subscriptionRef.current = true

    const channel = supabase
      .channel(`journals-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_journals',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          markRealtimeHeartbeat('journals-event')

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            push({
              kind: 'journal_saved',
              variant: 'success',
              title: 'Journal Saved',
              message: 'Daily journal entry saved',
            })
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          markRealtimeHeartbeat('journals-subscribed')
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      subscriptionRef.current = false
    }
  }, [user?.id])
}
