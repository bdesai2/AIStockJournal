import { create } from 'zustand'
import type { Trade, TradeExecution, CreateTradeInput, UpdateTradeInput, AiTradeUpdate } from '@/types'
import { db, storage } from '@/lib/supabase'
import { calcExecutionsSummary } from '@/lib/tradeUtils'
import { useNotificationStore } from '@/store/notificationStore'
import {
  enqueueOfflineMutation,
  getOfflineQueue,
  markOfflineMutationFailed,
  removeOfflineMutation,
} from '@/lib/offlineQueue'
import { loadTradesCache, saveTradesCache } from '@/lib/offlineCache'

interface TradeState {
  trades: Trade[]
  loading: boolean
  error: string | null
  selectedTrade: Trade | null

  // Actions
  fetchTrades: (userId: string, accountId: string) => Promise<void>
  createTrade: (input: CreateTradeInput & { user_id: string; account_id: string }) => Promise<Trade | null>
  updateTrade: (id: string, input: UpdateTradeInput | AiTradeUpdate) => Promise<Trade | null>
  deleteTrade: (id: string) => Promise<boolean>
  setSelectedTrade: (trade: Trade | null) => void
  uploadScreenshot: (userId: string, tradeId: string, file: File, label?: string) => Promise<boolean>
  deleteScreenshot: (screenshotId: string, storagePath: string) => Promise<boolean>
  // Execution actions
  addExecution: (userId: string, tradeId: string, exec: Omit<TradeExecution, 'id' | 'trade_id' | 'user_id' | 'created_at'>) => Promise<boolean>
  updateExecution: (
    executionId: string,
    tradeId: string,
    patch: Partial<Omit<TradeExecution, 'id' | 'trade_id' | 'user_id' | 'created_at'>>
  ) => Promise<boolean>
  deleteExecution: (executionId: string, tradeId: string) => Promise<boolean>
  flushQueuedMutations: (userId: string, accountId: string) => Promise<number>
  clearError: () => void
}

// Apply execution-derived P&L back onto the trade object so the rest of the
// app (dashboard stats, trade list) sees up-to-date numbers without a refetch.
function applyExecutions(trade: Trade): Trade {
  if (!trade.has_executions || !trade.executions?.length) return trade
  const s = calcExecutionsSummary(trade.executions, trade.asset_type)
  return {
    ...trade,
    net_pnl: s.realizedPnl,
    gross_pnl: s.realizedPnl + s.totalFees,
    status: s.status,
    entry_date: s.entryDate ?? trade.entry_date,
    exit_date: s.exitDate ?? trade.exit_date,
    quantity: s.netQty > 0 ? s.netQty : trade.quantity,
    entry_price: s.avgCostBasis > 0 ? s.avgCostBasis : trade.entry_price,
  }
}

function shouldQueueMutation(errorMessage: string): boolean {
  if (!navigator.onLine) return true
  return /network|offline|fetch|timeout|failed to fetch/i.test(errorMessage)
}

const TRADE_SELECT = `*, screenshots:trade_screenshots(*), executions:trade_executions(*)`

export const useTradeStore = create<TradeState>((set, get) => ({
  trades: [],
  loading: false,
  error: null,
  selectedTrade: null,

  fetchTrades: async (userId: string, accountId: string) => {
    set({ loading: true, error: null })
    const { data, error } = await db
      .trades()
      .select(TRADE_SELECT)
      .eq('user_id', userId)
      .eq('account_id', accountId)
      .order('entry_date', { ascending: false })

    if (error) {
      const cached = await loadTradesCache(userId, accountId).catch(() => null)
      if (cached?.length) {
        set({
          trades: cached,
          error: `Offline mode: showing cached trades (${cached.length})`,
          loading: false,
        })
      } else {
        set({ error: error.message, loading: false })
      }
      return
    }

    let trades = (data as Trade[]) ?? []
    trades = trades.map(applyExecutions)

    // Batch-refresh signed URLs for every screenshot in one round-trip
    const allPaths = trades
      .flatMap((t) => t.screenshots ?? [])
      .map((s) => s.storage_path)
      .filter(Boolean)

    console.log(`[fetchTrades] Found ${allPaths.length} screenshot paths to refresh`)

    if (allPaths.length > 0) {
      const urlMap = await storage.getSignedUrls(allPaths)

      trades = trades.map((t) => ({
        ...t,
        screenshots: t.screenshots?.map((s) => {
          const newUrl = urlMap.get(s.storage_path)
          if (newUrl && newUrl !== s.url) {
            //console.log(`[fetchTrades] Updated URL for ${s.storage_path}`)
          } else if (!newUrl) {
            //console.warn(`[fetchTrades] No signed URL found for ${s.storage_path}`)
          }
          return {
            ...s,
            url: newUrl ?? s.url,
          }
        }),
      }))
    }

    set({ trades, loading: false })
    void saveTradesCache(userId, accountId, trades)
  },

  createTrade: async (input) => {
    set({ loading: true, error: null })

    // Create the trade with has_executions=true from the start
    const { data, error } = await db
      .trades()
      .insert({ ...input, has_executions: true })
      .select(TRADE_SELECT)
      .single()

    if (error) {
      const errorMsg = error.message || 'Failed to create trade'

      if (shouldQueueMutation(errorMsg)) {
        enqueueOfflineMutation('trade', 'create', input)
        set({ loading: false, error: 'Offline: trade queued and will sync when online.' })
        const { push } = useNotificationStore.getState()
        push({
          kind: 'error',
          variant: 'warning',
          title: 'Trade queued offline',
          message: 'We will create this trade automatically once connection is restored.',
        })
        return null
      }

      set({ error: errorMsg, loading: false })

      // Notify user and suggest re-login if auth error
      const { push } = useNotificationStore.getState()
      const isAuthError = errorMsg.includes('auth') || errorMsg.includes('token') || errorMsg.includes('401')
      push({
        kind: 'error',
        variant: 'error',
        title: isAuthError ? 'Session expired' : 'Error creating trade',
        message: isAuthError
          ? 'Your session has expired. Please log in again and resubmit your trade.'
          : errorMsg,
      })

      return null
    }

    const trade = data as Trade

    // Build initial executions from the form entry/exit fields
    // Long opens with buy; short opens with sell
    const openAction = input.direction === 'long' ? 'buy' : 'sell'
    const closeAction = input.direction === 'long' ? 'sell' : 'buy'

    const execsToInsert: object[] = [
      {
        trade_id: trade.id,
        user_id: input.user_id,
        action: openAction,
        datetime: input.entry_date,
        quantity: input.quantity,
        price: input.entry_price,
        fee: input.fees ?? 0,
      },
    ]

    // If the trade is already closed/partial at creation time, add closing execution
    if (input.exit_price && input.exit_date && input.status !== 'open') {
      execsToInsert.push({
        trade_id: trade.id,
        user_id: input.user_id,
        action: closeAction,
        datetime: input.exit_date,
        quantity: input.quantity,
        price: input.exit_price,
        fee: 0,
      })
    }

    const { data: execData } = await db
      .executions()
      .insert(execsToInsert)
      .select()

    const newTrade = applyExecutions({
      ...trade,
      has_executions: true,
      executions: (execData ?? []) as import('@/types').TradeExecution[],
    })

    set((state) => ({
      trades: [newTrade, ...state.trades],
      loading: false,
    }))

    const { push } = useNotificationStore.getState()
    push({
      kind: 'trade_created',
      variant: 'success',
      title: 'Trade created',
      message: `${newTrade.ticker} ${newTrade.direction?.toUpperCase?.() ?? ''} · qty ${newTrade.quantity}`,
      tradeId: newTrade.id,
    })

    return newTrade
  },

  updateTrade: async (id, input) => {
    set({ loading: true, error: null })

    // Convert undefined values to null so Supabase actually clears them
    const payload = Object.entries(input).reduce((acc, [key, value]) => {
      acc[key as keyof typeof input] = value === undefined ? null : value
      return acc
    }, {} as Record<keyof typeof input, any>)

    const { data, error } = await db
      .trades()
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(TRADE_SELECT)
      .single()

    if (error) {
      const errorMsg = error.message || 'Failed to update trade'

      if (shouldQueueMutation(errorMsg)) {
        enqueueOfflineMutation('trade', 'update', { id, input })
        set((state) => ({
          trades: state.trades.map((t) => (t.id === id ? ({ ...t, ...input } as Trade) : t)),
          selectedTrade:
            state.selectedTrade?.id === id
              ? ({ ...state.selectedTrade, ...input } as Trade)
              : state.selectedTrade,
          loading: false,
          error: 'Offline: update queued and will sync when online.',
        }))
        return get().trades.find((t) => t.id === id) ?? null
      }

      set({ error: errorMsg, loading: false })

      // Notify user and suggest re-login if auth error
      const { push } = useNotificationStore.getState()
      const isAuthError = errorMsg.includes('auth') || errorMsg.includes('token') || errorMsg.includes('401')
      push({
        kind: 'error',
        variant: 'error',
        title: isAuthError ? 'Session expired' : 'Error updating trade',
        message: isAuthError
          ? 'Your session has expired. Please log in again and resubmit your changes.'
          : errorMsg,
      })

      return null
    }

    const updated = applyExecutions(data as Trade)
    set((state) => ({
      trades: state.trades.map((t) => (t.id === id ? updated : t)),
      selectedTrade: state.selectedTrade?.id === id ? updated : state.selectedTrade,
      loading: false,
    }))

    const { push } = useNotificationStore.getState()
    push({
      kind: 'trade_updated',
      variant: 'success',
      title: 'Trade updated',
      message: `${updated.ticker} · status ${updated.status}`,
      tradeId: updated.id,
    })

    return updated
  },

  deleteTrade: async (id) => {
    const trade = get().trades.find((t) => t.id === id)

    if (trade?.screenshots?.length) {
      for (const s of trade.screenshots) {
        await storage.deleteScreenshot(s.storage_path)
      }
    }

    const { error } = await db.trades().delete().eq('id', id)
    if (error) {
      const errorMsg = error.message || 'Failed to delete trade'

      if (shouldQueueMutation(errorMsg)) {
        enqueueOfflineMutation('trade', 'delete', { id })
        set((state) => ({
          trades: state.trades.filter((t) => t.id !== id),
          selectedTrade: state.selectedTrade?.id === id ? null : state.selectedTrade,
          error: 'Offline: deletion queued and will sync when online.',
        }))
        return true
      }

      set({ error: errorMsg })
      return false
    }

    set((state) => ({
      trades: state.trades.filter((t) => t.id !== id),
      selectedTrade: state.selectedTrade?.id === id ? null : state.selectedTrade,
    }))

    if (trade) {
      const { push } = useNotificationStore.getState()
      push({
        kind: 'trade_deleted',
        variant: 'warning',
        title: 'Trade deleted',
        message: trade.ticker ?? 'Trade removed',
        tradeId: trade.id,
      })
    }
    return true
  },

  setSelectedTrade: (trade) => set({ selectedTrade: trade }),

  uploadScreenshot: async (userId, tradeId, file, label) => {
    const result = await storage.uploadScreenshot(userId, tradeId, file, label)
    if (!result) return false

    const { data, error } = await db
      .screenshots()
      .insert({
        trade_id: tradeId,
        user_id: userId,
        storage_path: result.path,
        url: result.url,
        label: label ?? null,
      })
      .select()
      .single()

    if (error) return false

    set((state) => ({
      trades: state.trades.map((t) =>
        t.id === tradeId
          ? { ...t, screenshots: [...(t.screenshots ?? []), data] }
          : t
      ),
    }))

    const { push } = useNotificationStore.getState()
    push({
      kind: 'screenshot_uploaded',
      variant: 'success',
      title: 'Screenshot uploaded',
      message: label ? `${label} · attached to trade` : 'Screenshot attached to trade',
      tradeId,
    })

    return true
  },

  deleteScreenshot: async (screenshotId, storagePath) => {
    await storage.deleteScreenshot(storagePath)
    const { error } = await db.screenshots().delete().eq('id', screenshotId)
    if (error) return false

    set((state) => ({
      trades: state.trades.map((t) => ({
        ...t,
        screenshots: t.screenshots?.filter((s) => s.id !== screenshotId),
      })),
    }))

    const { push } = useNotificationStore.getState()
    push({
      kind: 'screenshot_deleted',
      variant: 'warning',
      title: 'Screenshot removed',
      message: 'Screenshot deleted from trade',
    })

    return true
  },

  addExecution: async (userId, tradeId, exec) => {
    // Insert execution row
    const { data, error } = await db
      .executions()
      .insert({ ...exec, trade_id: tradeId, user_id: userId })
      .select()
      .single()

    if (error) {
      const errorMsg = error.message || JSON.stringify(error)
      console.error('❌ addExecution error:', errorMsg, error)
      set({ error: errorMsg })
      return false
    }

    // Mark trade as execution-driven (disables DB trigger P&L)
    await db
      .trades()
      .update({ has_executions: true })
      .eq('id', tradeId)

    // Update local state: append execution, re-derive P&L
    set((state) => ({
      trades: state.trades.map((t) => {
        if (t.id !== tradeId) return t
        const updated = {
          ...t,
          has_executions: true,
          executions: [...(t.executions ?? []), data as TradeExecution],
        }
        return applyExecutions(updated)
      }),
    }))

    const { push } = useNotificationStore.getState()
    push({
      kind: 'execution_added',
      variant: 'success',
      title: 'Execution added',
      message: `Execution added to trade`,
      tradeId,
    })

    return true
  },

  updateExecution: async (executionId, tradeId, patch) => {
    const { data, error } = await db
      .executions()
      .update({ ...patch })
      .eq('id', executionId)
      .select()
      .single()

    if (error) {
      const errorMsg = error.message || JSON.stringify(error)
      console.error('❌ updateExecution error:', errorMsg, error)
      set({ error: errorMsg })
      return false
    }

    set((state) => ({
      trades: state.trades.map((t) => {
        if (t.id !== tradeId) return t
        const updated = {
          ...t,
          executions: (t.executions ?? []).map((e) =>
            e.id === executionId ? (data as TradeExecution) : e
          ),
        }
        return applyExecutions(updated)
      }),
    }))

    const { push } = useNotificationStore.getState()
    push({
      kind: 'execution_updated',
      variant: 'success',
      title: 'Execution updated',
      message: 'Execution edited',
      tradeId,
    })

    return true
  },

  deleteExecution: async (executionId, tradeId) => {
    const { error } = await db.executions().delete().eq('id', executionId)
    if (error) {
      set({ error: error.message })
      return false
    }

    set((state) => ({
      trades: state.trades.map((t) => {
        if (t.id !== tradeId) return t
        const updated = {
          ...t,
          executions: t.executions?.filter((e) => e.id !== executionId),
        }
        return applyExecutions(updated)
      }),
    }))

    const { push } = useNotificationStore.getState()
    push({
      kind: 'execution_deleted',
      variant: 'warning',
      title: 'Execution deleted',
      message: 'Execution removed',
      tradeId,
    })

    return true
  },

  flushQueuedMutations: async (userId, accountId) => {
    const queued = getOfflineQueue('trade')
    if (queued.length === 0) return 0

    let processed = 0

    for (const item of queued) {
      try {
        if (item.action === 'create') {
          const payload = item.payload as CreateTradeInput & {
            user_id: string
            account_id: string
          }

          await db
            .trades()
            .insert({ ...payload, has_executions: true })
        }

        if (item.action === 'update') {
          const payload = item.payload as { id: string; input: UpdateTradeInput | AiTradeUpdate }
          await db
            .trades()
            .update({ ...payload.input, updated_at: new Date().toISOString() })
            .eq('id', payload.id)
        }

        if (item.action === 'delete') {
          const payload = item.payload as { id: string }
          await db.trades().delete().eq('id', payload.id)
        }

        removeOfflineMutation(item.id)
        processed += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error'
        markOfflineMutationFailed(item, message)
        // Keep mutation in queue; it will retry on next reconnect
      }
    }

    if (processed > 0) {
      await get().fetchTrades(userId, accountId)
      const { push } = useNotificationStore.getState()
      push({
        kind: 'trade_updated',
        variant: 'success',
        title: 'Offline changes synced',
        message: `${processed} queued trade change${processed === 1 ? '' : 's'} synchronized.`,
      })
    }

    return processed
  },

  clearError: () => set({ error: null }),
}))
