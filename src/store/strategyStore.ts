import { create } from 'zustand'
import type { Strategy, StrategyScreenshot } from '@/types'
import { db, storage } from '@/lib/supabase'

interface StrategyState {
  strategies: Strategy[]
  loading: boolean
  error: string | null
  selectedStrategy: Strategy | null

  fetchStrategies: (userId: string) => Promise<void>
  createStrategy: (input: Omit<Strategy, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'screenshots'> & { user_id: string }) => Promise<Strategy | null>
  updateStrategy: (id: string, patch: Partial<Omit<Strategy, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'screenshots'>>) => Promise<Strategy | null>
  deleteStrategy: (id: string) => Promise<boolean>
  setSelectedStrategy: (strategy: Strategy | null) => void
  uploadScreenshot: (userId: string, strategyId: string, file: File, label?: string) => Promise<boolean>
  deleteScreenshot: (screenshotId: string, storagePath: string) => Promise<boolean>
  clearError: () => void
}

const STRATEGY_SELECT = '*, screenshots:strategy_screenshots(*)'

export const useStrategyStore = create<StrategyState>((set, get) => ({
  strategies: [],
  loading: false,
  error: null,
  selectedStrategy: null,

  fetchStrategies: async (userId: string) => {
    set({ loading: true, error: null })
    const { data, error } = await db
      .strategies()
      .select(STRATEGY_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      set({ error: error.message, loading: false })
      return
    }

    let strategies = (data as Strategy[]) ?? []

    // Refresh signed URLs for screenshots
    const allPaths = strategies
      .flatMap((s) => (s.screenshots as StrategyScreenshot[] | undefined) ?? [])
      .map((s) => s.storage_path)
      .filter(Boolean)

    if (allPaths.length > 0) {
      const urlMap = await storage.getSignedUrls(allPaths)
      strategies = strategies.map((s) => ({
        ...s,
        screenshots: (s.screenshots as StrategyScreenshot[] | undefined)?.map((shot) => ({
          ...shot,
          url: urlMap.get(shot.storage_path) ?? shot.url,
        })),
      }))
    }

    set({ strategies, loading: false })
  },

  createStrategy: async (input) => {
    set({ loading: true, error: null })

    const { data, error } = await db
      .strategies()
      .insert({
        ...input,
        confidence_level: input.confidence_level ?? 3,
      })
      .select(STRATEGY_SELECT)
      .single()

    if (error) {
      set({ error: error.message, loading: false })
      return null
    }

    const created = data as Strategy
    set((state) => ({
      strategies: [created, ...state.strategies],
      selectedStrategy: created,
      loading: false,
    }))
    return created
  },

  updateStrategy: async (id, patch) => {
    set({ loading: true, error: null })

    const { data, error } = await db
      .strategies()
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(STRATEGY_SELECT)
      .single()

    if (error) {
      set({ error: error.message, loading: false })
      return null
    }

    const updated = data as Strategy
    set((state) => ({
      strategies: state.strategies.map((s) => (s.id === id ? updated : s)),
      selectedStrategy: state.selectedStrategy?.id === id ? updated : state.selectedStrategy,
      loading: false,
    }))

    return updated
  },

  deleteStrategy: async (id) => {
    // Delete any associated screenshots from storage
    const strategy = get().strategies.find((s) => s.id === id)
    if (strategy?.screenshots?.length) {
      for (const shot of strategy.screenshots as StrategyScreenshot[]) {
        await storage.deleteScreenshot(shot.storage_path)
      }
    }

    const { error } = await db
      .strategies()
      .delete()
      .eq('id', id)

    if (error) {
      set({ error: error.message })
      return false
    }

    set((state) => ({
      strategies: state.strategies.filter((s) => s.id !== id),
      selectedStrategy: state.selectedStrategy?.id === id ? null : state.selectedStrategy,
    }))
    return true
  },

  setSelectedStrategy: (strategy) => set({ selectedStrategy: strategy }),

  uploadScreenshot: async (userId, strategyId, file, label) => {
    const result = await storage.uploadScreenshot(userId, strategyId, file, label)
    if (!result) return false

    const { data, error } = await db
      .strategyScreenshots()
      .insert({
        strategy_id: strategyId,
        user_id: userId,
        storage_path: result.path,
        url: result.url,
        label: label ?? null,
      })
      .select()
      .single()

    if (error) return false

    set((state) => ({
      strategies: state.strategies.map((s) =>
        s.id === strategyId
          ? { ...s, screenshots: [...((s.screenshots as StrategyScreenshot[] | undefined) ?? []), data as StrategyScreenshot] }
          : s
      ),
    }))

    return true
  },

  deleteScreenshot: async (screenshotId, storagePath) => {
    await storage.deleteScreenshot(storagePath)

    const { error } = await db
      .strategyScreenshots()
      .delete()
      .eq('id', screenshotId)

    if (error) return false

    set((state) => ({
      strategies: state.strategies.map((s) => ({
        ...s,
        screenshots: (s.screenshots as StrategyScreenshot[] | undefined)?.filter((shot) => shot.id !== screenshotId),
      })),
    }))

    return true
  },

  clearError: () => set({ error: null }),
}))
