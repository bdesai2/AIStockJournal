// ─── Asset & Trade Types ──────────────────────────────────────────────────────

export type AssetType = 'stock' | 'option' | 'etf' | 'crypto'
export type TradeDirection = 'long' | 'short'
export type TradeStatus = 'open' | 'closed' | 'partial'
export type OptionType = 'call' | 'put'
export type OptionAction = 'buy' | 'sell'
export type TradeDuration = 'scalp' | 'swing' | 'long_term'

// ─── Option Leg ───────────────────────────────────────────────────────────────

export interface OptionLeg {
  id?: string
  action: OptionAction       // buy | sell
  option_type: OptionType    // call | put
  strike: number
  expiration: string         // ISO date
  contracts: number
  premium: number            // per contract cost/credit
  delta?: number
  iv?: number                // implied volatility %
}

// ─── Trade Execution ──────────────────────────────────────────────────────────

export interface TradeExecution {
  id: string
  trade_id: string
  user_id: string
  action: 'buy' | 'sell'
  datetime: string           // ISO datetime
  quantity: number
  price: number
  fee?: number
  dividend?: number
  created_at: string
}

// ─── Screenshot / Attachment ──────────────────────────────────────────────────

export interface TradeScreenshot {
  id: string
  url: string
  storage_path: string
  label?: string             // e.g. "Entry chart", "Exit chart"
  created_at: string
}

// ─── User-Defined Strategy Library ───────────────────────────────────────────

export interface StrategyScreenshot {
  id: string
  strategy_id: string
  user_id: string
  storage_path: string
  url: string
  label?: string
  created_at: string
}

export interface Strategy {
  id: string
  user_id: string
  name: string
  description?: string
  setup_rules?: string
  entry_conditions?: string
  exit_conditions?: string
  strengths?: string
  weaknesses?: string
  likelihood_of_success?: number
  confidence_level?: 1 | 2 | 3 | 4 | 5
  tags?: StrategyTag[]
  created_at: string
  updated_at: string
  screenshots?: StrategyScreenshot[]
}

// ─── Strategy Tag ─────────────────────────────────────────────────────────────

export type StrategyTag =
  | 'breakout'
  | 'breakdown'
  | 'trend_follow'
  | 'mean_reversion'
  | 'gap_fill'
  | 'earnings_play'
  | 'momentum'
  | 'swing'
  | 'scalp'
  | 'news_catalyst'
  | 'support_bounce'
  | 'resistance_reject'
  | 'vwap_reclaim'
  | 'iron_condor'
  | 'vertical_spread'
  | 'covered_call'
  | 'cash_secured_put'
  | 'straddle'
  | 'strangle'
  | 'custom'

// ─── Core Trade ───────────────────────────────────────────────────────────────

export interface Trade {
  id: string
  user_id: string
  account_id: string            // NEW: Links trade to specific account

  // Identification
  ticker: string
  asset_type: AssetType
  direction: TradeDirection
  status: TradeStatus

  // Timing
  entry_date: string         // ISO datetime
  exit_date?: string         // ISO datetime
  holding_period_days?: number

  // Pricing
  entry_price: number
  exit_price?: number
  quantity: number           // shares / contracts / units
  fees?: number

  // P&L (computed but stored for query perf)
  gross_pnl?: number
  net_pnl?: number
  pnl_percent?: number
  r_multiple?: number        // risk/reward realized

  // Risk
  stop_loss?: number
  take_profit?: number
  initial_risk?: number      // $ risked (entry - stop) * qty
  risk_percent?: number      // % of account risked

  // Options (only when asset_type === 'option')
  option_type?: OptionType   // call | put (quick reference, independent of legs)
  option_legs?: OptionLeg[]
  option_strategy?: string   // e.g. "Bull Call Spread", "Iron Condor"

  // Crypto-specific
  exchange?: string          // e.g. "Coinbase", "Binance"

  // Journal
  setup_notes?: string       // Why you took the trade
  entry_notes?: string       // What happened on entry
  exit_notes?: string        // Why you exited
  mistakes?: string          // What went wrong
  lessons?: string           // What you learned
  emotional_state?: 'calm' | 'fomo' | 'fearful' | 'confident' | 'impulsive' | 'disciplined' | 'impatient' | 'anxious'
  execution_quality?: 1 | 2 | 3 | 4 | 5   // 1–5 self-rating

  // Categorization
  strategy_tags: StrategyTag[]
  custom_tags?: string[]
  primary_strategy_name?: string
  sector?: string
  market_conditions?: 'trending_up' | 'trending_down' | 'ranging' | 'volatile'
  timeframe?: '1m' | '5m' | '15m' | '1h' | '4h' | 'D' | 'W'
  duration?: TradeDuration

  // Executions (multi-leg position tracking)
  executions?: TradeExecution[]
  has_executions?: boolean

  // Media
  screenshots?: TradeScreenshot[]

  // AI fields (populated in M3)
  ai_grade?: string          // A+, A, B+, B, C, D, F
  ai_grade_rationale?: string
  ai_setup_score?: number    // 0–100
  ai_suggestions?: string[]
  ai_analyzed_at?: string    // ISO timestamp of last AI grade run
  ai_model_version?: string  // Claude model used, e.g. claude-haiku-4-5-20251001
  ai_expires_at?: string     // ISO timestamp when cached AI grade should be refreshed

  // Metadata
  created_at: string
  updated_at: string
}

// ─── Trade Form (for create/edit) ─────────────────────────────────────────────

export type CreateTradeInput = Omit<
  Trade,
  | 'id'
  | 'user_id'
  | 'account_id'
  | 'created_at'
  | 'updated_at'
  | 'screenshots'
  | 'ai_grade'
  | 'ai_grade_rationale'
  | 'ai_setup_score'
  | 'ai_suggestions'
  | 'gross_pnl'
  | 'net_pnl'
  | 'pnl_percent'
  | 'holding_period_days'
>

export type UpdateTradeInput = Partial<CreateTradeInput>

// ─── AI Trade Update (server-side write-back) ──────────────────────────────────

export interface AiTradeUpdate {
  ai_grade?: string
  ai_grade_rationale?: string
  ai_setup_score?: number
  ai_suggestions?: string[]
  ai_analyzed_at?: string
  ai_model_version?: string
  ai_expires_at?: string
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  account_size?: number      // Starting account value for risk % calc
  default_risk_percent?: number
  preferred_timeframe?: string
  broker?: string
  timezone?: string
  created_at: string
  updated_at: string
}

// ─── User Accounts (Multi-account support) ────────────────────────────────────

export interface Account {
  id: string
  user_id: string
  account_name: string
  starting_balance: number
  broker?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Daily Journal ────────────────────────────────────────────────────────────

export interface DailyJournal {
  id: string
  user_id: string
  date: string               // ISO date YYYY-MM-DD
  pre_market_notes?: string
  post_market_notes?: string
  market_mood?: 'bullish' | 'bearish' | 'neutral'
  personal_mood?: 1 | 2 | 3 | 4 | 5
  goals?: string[]
  reviewed_rules?: boolean
  created_at: string
  updated_at: string
}

// ─── AI / Weekly Digest ───────────────────────────────────────────────────────

export interface DigestPattern {
  pattern: string
  detail: string
}

export interface WeeklyDigest {
  id: string
  user_id: string
  positive_patterns: DigestPattern[]
  negative_patterns: DigestPattern[]
  actionable_lesson: string
  performance_trend?: 'increasing' | 'decreasing' | 'mixed' | 'flat'
  trend_feedback?: string
  increasing_mistakes?: string[]
  performance_drivers?: string[]
  trade_count?: number
  generated_at: string
  created_at: string
  updated_at: string
}

// ─── Analytics / Stats ────────────────────────────────────────────────────────

export interface TradeStats {
  total_trades: number
  winning_trades: number
  losing_trades: number
  win_rate: number           // 0–1
  total_pnl: number
  avg_win: number
  avg_loss: number
  avg_loss_percent: number   // Avg loss as percentage
  profit_factor: number
  expectancy: number         // (Avg Win × Win% - Avg Loss × Loss%)
  avg_r_multiple: number
  best_trade: number
  worst_trade: number
  avg_holding_period: number
  avg_win_hold_time: number  // Avg hold time for winning trades (days)
  avg_loss_hold_time: number // Avg hold time for losing trades (days)
  avg_size: number           // Avg trade size (quantity)
  avg_daily_trades: number   // Avg trades per day
  by_asset_type: Record<AssetType, { count: number; pnl: number }>
  by_strategy: Record<string, { count: number; pnl: number; win_rate: number }>
  // Dimensional Analysis (M4)
  by_sector: Record<string, { count: number; pnl: number; win_rate: number }>
  by_timeframe: Record<string, { count: number; pnl: number; win_rate: number }>
  by_duration: Record<string, { count: number; pnl: number; win_rate: number }>
  by_market_condition: Record<string, { count: number; pnl: number; win_rate: number }>
  // Time-Based Analysis (M4)
  by_duration_impact: Record<string, { count: number; pnl: number; win_rate: number }>
  by_time_of_day: Record<string, { count: number; pnl: number; win_rate: number }>
  // Advanced Analysis (M4)
  by_emotional_state: Record<string, { count: number; pnl: number; win_rate: number }>
  by_execution_quality: Record<string, { count: number; pnl: number; win_rate: number }>
  // Advanced metrics (M4)
  sharpe_ratio: number | null
  sortino_ratio: number | null
  max_drawdown: number
  recovery_factor: number | null
  max_consecutive_wins: number
  max_consecutive_losses: number
}

// ─── Subscription & Billing (M6.5) ────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due'
export type SubscriptionTier = 'free' | 'pro'

export interface UserSubscription {
  tier: SubscriptionTier
  status: SubscriptionStatus
  startDate: string | null
  renewalDate: string | null
  trialEndsAt: string | null
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  earlyAdopterDiscount: boolean
}
