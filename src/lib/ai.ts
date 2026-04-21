import type { Trade } from '@/types'

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
  console.log(`[AI API] POST ${path}`, body)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── API Client ───────────────────────────────────────────────────────────────

export const aiApi = {
  /**
   * Grade a closed trade using Claude
   */
  gradeTrade: (trade: Trade) => {
    // Extract only the fields we need to send to the backend
    const tradeForGrading = {
      id: trade.id,
      ticker: trade.ticker,
      status: trade.status,
      asset_type: trade.asset_type,
      direction: trade.direction,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
      entry_date: trade.entry_date,
      exit_date: trade.exit_date,
      quantity: trade.quantity,
      r_multiple: trade.r_multiple,
      net_pnl: trade.net_pnl,
      execution_quality: trade.execution_quality,
      strategy_tags: trade.strategy_tags,
      setup_notes: trade.setup_notes,
      mistakes: trade.mistakes,
      lessons: trade.lessons,
    }
    return post<GradeTradeResult>('/api/ai/grade-trade', { trade: tradeForGrading })
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
  weeklyDigest: (trades: Trade[]) =>
    post<WeeklyDigestResult>('/api/ai/weekly-digest', { trades }),

  /**
   * Analyze an open/active trade with current market context
   */
  tradeAnalysis: (trade: Trade) =>
    post<TradeAnalysisResult>('/api/ai/trade-analysis', { trade }),

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
