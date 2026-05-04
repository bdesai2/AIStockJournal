import { create } from 'zustand'
import { aiApi, type SetupCheckResult, type WeeklyDigestResult, type TradeAnalysisResult } from '@/lib/ai'
import { useTradeStore } from '@/store/tradeStore'
import { useAuthStore } from '@/store/authStore'
import { db, supabase } from '@/lib/supabase'
import type { Trade } from '@/types'
import { useNotificationStore } from '@/store/notificationStore'
import { canAccess } from '@/lib/featureGates'

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
  gradeTrade: (trade: Trade, opts?: { force?: boolean }) => Promise<void>
  runSetupCheck: (params: Parameters<typeof aiApi.setupCheck>[0]) => Promise<void>
  clearSetupResult: () => void
  runWeeklyDigest: (trades: Trade[]) => Promise<void>
  analyzeOpenTrade: (trade: Trade) => Promise<TradeAnalysisResult | null>
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

  gradeTrade: async (trade, opts) => {
    const force = opts?.force ?? false

    // Check if user has access to trade grading
    const subscription = useAuthStore.getState().subscription
    if (!canAccess('TRADE_GRADING', subscription?.tier || 'free')) {
      set({
        gradeLoading: false,
        gradeError: 'Trade grading is a Pro feature. Upgrade to unlock AI-powered trade analysis.',
      })
      return
    }

    // If we already have a non-expired grade and this is not an explicit re-grade,
    // just reuse the cached result to avoid unnecessary AI calls.
    const now = new Date()
    if (!force && trade.ai_grade && trade.ai_expires_at) {
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

      const { push } = useNotificationStore.getState()
      push({
        kind: 'ai_graded',
        variant: 'success',
        title: 'Trade graded',
        message: `${trade.ticker} · grade ${result.grade}`,
        tradeId: trade.id,
      })
    } catch (err) {
      set({
        gradeLoading: false,
        gradeError: err instanceof Error ? err.message : 'AI grading failed',
      })
    }
  },

  runSetupCheck: async (params) => {
    // Check if user has access to setup validation
    const subscription = useAuthStore.getState().subscription
    if (!canAccess('SETUP_VALIDATION', subscription?.tier || 'free')) {
      set({
        setupLoading: false,
        setupError: 'Setup validation is a Pro feature. Upgrade to unlock pre-trade quality checks.',
      })
      return
    }

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
    // Check if user has access to weekly digest
    const subscription = useAuthStore.getState().subscription
    if (!canAccess('WEEKLY_DIGEST', subscription?.tier || 'free')) {
      set({
        digestLoading: false,
        digestError: 'Weekly digest is a Pro feature. Upgrade to unlock AI pattern analysis and lessons.',
      })
      return
    }

    set({ digestLoading: true, digestError: null, digestResult: null })
    try {
      const result = await aiApi.weeklyDigest(trades)
      set({ digestLoading: false, digestResult: result })
      const { push } = useNotificationStore.getState()
      push({
        kind: 'weekly_digest_ready',
        variant: 'success',
        title: 'Weekly digest ready',
        message: `Digest generated for ${trades.length} closed trades`,
      })

      // Save to database
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user?.id) throw new Error('User not authenticated')

        await db.digests().insert({
          user_id: user.id,
          positive_patterns: result.positive_patterns,
          negative_patterns: result.negative_patterns,
          actionable_lesson: result.actionable_lesson,
          performance_trend: result.performance_trend,
          trend_feedback: result.trend_feedback,
          increasing_mistakes: result.increasing_mistakes,
          performance_drivers: result.performance_drivers,
          trade_count: trades.length,
          generated_at: new Date().toISOString(),
        })
      } catch (dbErr) {
        console.error('Failed to save digest to DB:', dbErr)
        // Don't fail the UI — digest is still shown, just not persisted
      }
    } catch (err) {
      set({
        digestLoading: false,
        digestError: err instanceof Error ? err.message : 'Digest failed',
      })
    }
  },

  analyzeOpenTrade: async (trade) => {
    // Check if user has access to open trade analysis
    const subscription = useAuthStore.getState().subscription
    if (!canAccess('OPEN_TRADE_ANALYSIS', subscription?.tier || 'free')) {
      set({
        analysisLoading: false,
        analysisError: 'Open trade analysis is a Pro feature. Upgrade to unlock real-time AI recommendations.',
      })
      return null
    }

    set({ analysisLoading: true, analysisError: null, analysisResult: null })
    try {
      const result = await aiApi.tradeAnalysis(trade)
      const { updateTrade } = useTradeStore.getState()
      const analyzedAt = new Date().toISOString()

      const saved = await updateTrade(trade.id, {
        open_trade_analysis: result,
        open_trade_analyzed_at: analyzedAt,
        open_trade_model_version: 'trade-analysis-v1',
      })

      if (!saved) {
        throw new Error('Analysis generated but failed to save to database')
      }

      set({ analysisLoading: false, analysisResult: result })

      const { push } = useNotificationStore.getState()
      push({
        kind: 'analysis_ready',
        variant: 'info',
        title: 'Analysis saved',
        message: `${trade.ticker} · AI analysis saved to trade record`,
        tradeId: trade.id,
      })
      return result
    } catch (err) {
      set({
        analysisLoading: false,
        analysisError: err instanceof Error ? err.message : 'Trade analysis failed',
      })
      return null
    }
  },

  clearGradeError: () => set({ gradeError: null }),
  clearSetupError: () => set({ setupError: null }),
  clearDigestError: () => set({ digestError: null }),
  clearAnalysisError: () => set({ analysisError: null, analysisResult: null }),
}))
