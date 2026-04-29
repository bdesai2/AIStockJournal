import type { Trade } from '@/types'
import { supabase } from '@/lib/supabase'

// ─── Response Types ───────────────────────────────────────────────────────────

export interface GradeTradeResult {
  grade: string
  setup_score: number
  rationale: string
  suggestions: string[]
  model: string
}

export interface SetupCheckResult {
  rr_rating: 'poor' | 'acceptable' | 'good' | 'excellent'
  rr_comment: string
  setup_quality: 'weak' | 'moderate' | 'strong'
  setup_comment: string
  position_size_note: string
  warnings: string[]
}

export interface DigestPattern {
  pattern: string
  detail: string
}

export interface WeeklyDigestResult {
  positive_patterns: DigestPattern[]
  negative_patterns: DigestPattern[]
  actionable_lesson: string
}

export interface TradeAnalysisResult {
  market_overview: string
  current_price_estimate: number
  estimated_pnl: number
  estimated_pnl_percent: number
  bullish_factors: string[]
  bearish_factors: string[]
  technical_outlook: string
  recommendation: 'hold' | 'reduce' | 'exit' | 'add'
  confidence: 'low' | 'moderate' | 'high'
  next_key_levels: {
    resistance: number
    support: number
  }
}

export interface PotentialTradeResult {
  setup_quality: 'weak' | 'moderate' | 'strong' | 'excellent'
  rr_potential: number | null
  key_levels: {
    entry: number
    stop: number
    target: number
  }
  bullish_case: string
  bearish_case: string
  probability: 'low' | 'medium' | 'high'
  recommendation: 'pass' | 'watch' | 'consider' | 'strong buy'
  model?: string
}

// ─── HTTP Utility ─────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const url = baseUrl ? `${baseUrl}${path}` : path
  console.log(`[AI API] POST ${path}`, JSON.stringify(body, null, 2))

  let { data: { session } } = await supabase.auth.getSession()

  // If the cached token is expired, force a refresh before sending the request.
  // getSession() returns the stored session without awaiting a token refresh,
  // so an expired access_token will cause a 401 on the backend.
  if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
    const { data } = await supabase.auth.refreshSession()
    session = data.session
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.')
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  let responseData: any
  try {
    responseData = await res.json()
  } catch (e) {
    console.error(`[AI API] Failed to parse response as JSON:`, e)
    throw new Error(`HTTP ${res.status}: Failed to parse response`)
  }

  if (!res.ok) {
    console.error(`[AI API] Error response:`, responseData)
    throw new Error((responseData as { error?: string }).error ?? `HTTP ${res.status}`)
  }

  console.log(`[AI API] Success response from ${path}:`, responseData)
  return responseData as Promise<T>
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const aiApi = {
  /**
   * Grade a closed trade using Claude
   */
  gradeTrade: (trade: Trade) => {
    // Validate required fields
    if (!trade.ticker || !trade.status || trade.entry_price === undefined) {
      console.error('[AI API] Missing required fields for gradeTrade:', {
        ticker: trade.ticker,
        status: trade.status,
        entry_price: trade.entry_price,
      })
      throw new Error('Trade missing required fields: ticker, status, entry_price')
    }

    // Send as nested trade object (backend may expect { trade: {...} })
    const tradeObj = {
      ticker: trade.ticker,
      status: trade.status,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      entry_date: trade.entry_date,
      exit_date: trade.exit_date,
      quantity: trade.quantity,
      asset_type: trade.asset_type,
      direction: trade.direction,
      stop_loss: trade.stop_loss,
      take_profit: trade.take_profit,
      option_type: trade.option_type,
      r_multiple: trade.r_multiple,
      net_pnl: trade.net_pnl,
      execution_quality: trade.execution_quality,
      emotional_state: trade.emotional_state,
      strategy_tags: trade.strategy_tags,
      setup_notes: trade.setup_notes,
      mistakes: trade.mistakes,
      lessons: trade.lessons,
    }
    return post<GradeTradeResult>('/api/ai/grade-trade', { trade: tradeObj })
  },

  /**
   * Evaluate the quality of a proposed trade setup (pre-trade check)
   */
  setupCheck: (params: {
    ticker: string
    entry_price: number
    stop_loss?: number
    take_profit?: number
    direction?: string
    quantity?: number
  }) => post<SetupCheckResult>('/api/ai/setup-check', params),

  /**
   * Analyze patterns from the last 30 closed trades
   */
  weeklyDigest: (trades: Trade[]) => {
    // Extract only needed fields for each trade
    const tradesForDigest = trades.map(trade => ({
      ticker: trade.ticker,
      direction: trade.direction,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      net_pnl: trade.net_pnl,
      pnl_percent: trade.pnl_percent,
      r_multiple: trade.r_multiple,
      strategy_tags: trade.strategy_tags,
      execution_quality: trade.execution_quality,
      setup_notes: trade.setup_notes,
      mistakes: trade.mistakes,
      lessons: trade.lessons,
    }))
    return post<WeeklyDigestResult>('/api/ai/weekly-digest', { trades: tradesForDigest })
  },

  /**
   * Analyze an open/active trade with current market context
   */
  tradeAnalysis: (trade: Trade) => {
    const tradeObj = {
      ticker: trade.ticker,
      asset_type: trade.asset_type,
      direction: trade.direction,
      entry_price: trade.entry_price,
      quantity: trade.quantity,
      entry_date: trade.entry_date,
      stop_loss: trade.stop_loss,
      take_profit: trade.take_profit,
      setup_notes: trade.setup_notes,
    }
    return post<TradeAnalysisResult>('/api/ai/trade-analysis', { trade: tradeObj })
  },

  /**
   * Evaluate a potential trade setup before entry
   */
  potentialTrade: (params: {
    symbol: string
    market_type?: string
    direction?: string
    proposed_entry: number
    stop_level?: number
    target_level?: number
    notes?: string
  }) => post<PotentialTradeResult>('/api/ai/potential-trade', params),
}
