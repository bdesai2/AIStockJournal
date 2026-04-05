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

// ─── HTTP Utility ─────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
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
  gradeTrade: (trade: Trade) =>
    post<GradeTradeResult>('/api/ai/grade-trade', { trade }),

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
}
