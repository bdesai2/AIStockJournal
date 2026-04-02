import { create } from 'zustand'
import type { Trade, CreateTradeInput, UpdateTradeInput } from '@/types'
import { db, storage } from '@/lib/supabase'

interface TradeState {
  trades: Trade[]
  loading: boolean
  error: string | null
  selectedTrade: Trade | null

  // Actions
  fetchTrades: (userId: string) => Promise<void>
  createTrade: (input: CreateTradeInput & { user_id: string }) => Promise<Trade | null>
  updateTrade: (id: string, input: UpdateTradeInput) => Promise<Trade | null>
  deleteTrade: (id: string) => Promise<boolean>
  setSelectedTrade: (trade: Trade | null) => void
  uploadScreenshot: (userId: string, tradeId: string, file: File, label?: string) => Promise<boolean>
  deleteScreenshot: (screenshotId: string, storagePath: string) => Promise<boolean>
  clearError: () => void
}

export const useTradeStore = create<TradeState>((set, get) => ({
  trades: [],
  loading: false,
  error: null,
  selectedTrade: null,

  fetchTrades: async (userId: string) => {
    set({ loading: true, error: null })
    const { data, error } = await db
      .trades()
      .select(`
        *,
        screenshots:trade_screenshots(*)
      `)
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })

    if (error) {
      set({ error: error.message, loading: false })
      return
    }

    set({ trades: (data as Trade[]) ?? [], loading: false })
  },

  createTrade: async (input) => {
    set({ loading: true, error: null })
    const { data, error } = await db
      .trades()
      .insert(input)
      .select(`*, screenshots:trade_screenshots(*)`)
      .single()

    if (error) {
      set({ error: error.message, loading: false })
      return null
    }

    const newTrade = data as Trade
    set((state) => ({
      trades: [newTrade, ...state.trades],
      loading: false,
    }))
    return newTrade
  },

  updateTrade: async (id, input) => {
    set({ loading: true, error: null })
    const { data, error } = await db
      .trades()
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`*, screenshots:trade_screenshots(*)`)
      .single()

    if (error) {
      set({ error: error.message, loading: false })
      return null
    }

    const updated = data as Trade
    set((state) => ({
      trades: state.trades.map((t) => (t.id === id ? updated : t)),
      selectedTrade: state.selectedTrade?.id === id ? updated : state.selectedTrade,
      loading: false,
    }))
    return updated
  },

  deleteTrade: async (id) => {
    const trade = get().trades.find((t) => t.id === id)

    // Delete screenshots from storage first
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

    // Update trade in state with new screenshot
    set((state) => ({
      trades: state.trades.map((t) =>
        t.id === tradeId
          ? { ...t, screenshots: [...(t.screenshots ?? []), data] }
          : t
      ),
    }))
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
    return true
  },

  clearError: () => set({ error: null }),
}))
