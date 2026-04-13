import { create } from 'zustand'
import type { Trade, TradeExecution, CreateTradeInput, UpdateTradeInput, AiTradeUpdate } from '@/types'
import { db, storage } from '@/lib/supabase'
import { calcExecutionsSummary } from '@/lib/tradeUtils'
import { useNotificationStore } from '@/store/notificationStore'

interface TradeState {
  trades: Trade[]
  loading: boolean
  error: string | null
  selectedTrade: Trade | null

  // Actions
  fetchTrades: (userId: string) => Promise<void>
  createTrade: (input: CreateTradeInput & { user_id: string }) => Promise<Trade | null>
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

const TRADE_SELECT = `*, screenshots:trade_screenshots(*), executions:trade_executions(*)`

export const useTradeStore = create<TradeState>((set, get) => ({
  trades: [],
  loading: false,
  error: null,
  selectedTrade: null,

  fetchTrades: async (userId: string) => {
    set({ loading: true, error: null })
    const { data, error } = await db
      .trades()
      .select(TRADE_SELECT)
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })

    if (error) {
      set({ error: error.message, loading: false })
      return
    }

    let trades = (data as Trade[]) ?? []
    trades = trades.map(applyExecutions)

    // Batch-refresh signed URLs for every screenshot in one round-trip
    const allPaths = trades
      .flatMap((t) => t.screenshots ?? [])
      .map((s) => s.storage_path)
      .filter(Boolean)

    if (allPaths.length > 0) {
      const urlMap = await storage.getSignedUrls(allPaths)
      trades = trades.map((t) => ({
        ...t,
        screenshots: t.screenshots?.map((s) => ({
          ...s,
          url: urlMap.get(s.storage_path) ?? s.url,
        })),
      }))
    }

    set({ trades, loading: false })
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
      set({ error: error.message, loading: false })
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
    const { data, error } = await db
      .trades()
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(TRADE_SELECT)
      .single()

    if (error) {
      set({ error: error.message, loading: false })
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
      set({ error: error.message })
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

  clearError: () => set({ error: null }),
}))
