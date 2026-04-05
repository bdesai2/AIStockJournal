import { create } from 'zustand'
import { aiApi, type SetupCheckResult, type WeeklyDigestResult, type TradeAnalysisResult } from '@/lib/ai'
import { useTradeStore } from '@/store/tradeStore'
import type { Trade } from '@/types'

// ─── State Interface ──────────────────────────────────────────────────────────

interface AiState {
  // Feature 1: Grade Trade
  gradeLoading: boolean
  gradeError: string | null
  lastGradedId: string | null   // id of the trade just graded (for optimistic UI)

  // Feature 2: Setup Check
  setupLoading: boolean
  setupError: string | null
  setupResult: SetupCheckResult | null

  // Feature 3: Weekly Digest
  digestLoading: boolean
  digestError: string | null
  digestResult: WeeklyDigestResult | null

  // Feature 4: Trade Analysis (for open trades)
  analysisLoading: boolean
  analysisError: string | null
  analysisResult: TradeAnalysisResult | null

  // Actions
  gradeTrade: (trade: Trade) => Promise<void>
  runSetupCheck: (params: Parameters<typeof aiApi.setupCheck>[0]) => Promise<void>
  clearSetupResult: () => void
  runWeeklyDigest: (trades: Trade[]) => Promise<void>
  analyzeOpenTrade: (trade: Trade) => Promise<void>
  clearGradeError: () => void
  clearSetupError: () => void
  clearDigestError: () => void
  clearAnalysisError: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAiStore = create<AiState>((set) => ({
  gradeLoading: false,
  gradeError: null,
  lastGradedId: null,

  setupLoading: false,
  setupError: null,
  setupResult: null,

  digestLoading: false,
  digestError: null,
  digestResult: null,

  analysisLoading: false,
  analysisError: null,
  analysisResult: null,

  gradeTrade: async (trade) => {
    // If we already have a non-expired grade, just reuse it
    const now = new Date()
    if (trade.ai_grade && trade.ai_expires_at) {
      const expiresAt = new Date(trade.ai_expires_at)
      if (expiresAt > now) {
        set({ gradeLoading: false, gradeError: null, lastGradedId: trade.id })
        return
      }
    }

    set({ gradeLoading: true, gradeError: null })
    try {
      const result = await aiApi.gradeTrade(trade)
      const { updateTrade } = useTradeStore.getState()

      const analyzedAt = new Date()
      // Expiration: 7 days from grading time (can be adjusted)
      const expiresAt = new Date(analyzedAt.getTime() + 7 * 24 * 60 * 60 * 1000)

      await updateTrade(trade.id, {
        ai_grade: result.grade,
        ai_grade_rationale: result.rationale,
        ai_setup_score: result.setup_score,
        ai_suggestions: result.suggestions,
        ai_analyzed_at: analyzedAt.toISOString(),
        ai_model_version: result.model,
        ai_expires_at: expiresAt.toISOString(),
      })
      set({ gradeLoading: false, lastGradedId: trade.id })
    } catch (err) {
      set({
        gradeLoading: false,
        gradeError: err instanceof Error ? err.message : 'AI grading failed',
      })
    }
  },

  runSetupCheck: async (params) => {
    set({ setupLoading: true, setupError: null, setupResult: null })
    try {
      const result = await aiApi.setupCheck(params)
      set({ setupLoading: false, setupResult: result })
    } catch (err) {
      set({
        setupLoading: false,
        setupError: err instanceof Error ? err.message : 'Setup check failed',
      })
    }
  },

  clearSetupResult: () => set({ setupResult: null, setupError: null }),

  runWeeklyDigest: async (trades) => {
    set({ digestLoading: true, digestError: null, digestResult: null })
    try {
      const result = await aiApi.weeklyDigest(trades)
      set({ digestLoading: false, digestResult: result })
    } catch (err) {
      set({
        digestLoading: false,
        digestError: err instanceof Error ? err.message : 'Digest failed',
      })
    }
  },

  analyzeOpenTrade: async (trade) => {
    set({ analysisLoading: true, analysisError: null, analysisResult: null })
    try {
      const result = await aiApi.tradeAnalysis(trade)
      set({ analysisLoading: false, analysisResult: result })
    } catch (err) {
      set({
        analysisLoading: false,
        analysisError: err instanceof Error ? err.message : 'Trade analysis failed',
      })
    }
  },

  clearGradeError: () => set({ gradeError: null }),
  clearSetupError: () => set({ setupError: null }),
  clearDigestError: () => set({ digestError: null }),
  clearAnalysisError: () => set({ analysisError: null, analysisResult: null }),
}))
