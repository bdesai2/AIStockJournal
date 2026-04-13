import type { Trade, TradeStats, TradeExecution, AssetType } from '@/types'

// ─── Formatters ───────────────────────────────────────────────────────────────

export const fmt = {
  currency: (n?: number | null, digits = 2) =>
    n == null
      ? '—'
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(n),

  percent: (n?: number | null, digits = 2) =>
    n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`,

  rMultiple: (n?: number | null) =>
    n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}R`,

  number: (n?: number | null, digits = 2) =>
    n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: digits }),

  date: (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',

  dateTime: (d?: string | null) =>
    d
      ? new Date(d).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—',

  ticker: (t: string) => t.toUpperCase(),
}

// ─── P&L helpers ──────────────────────────────────────────────────────────────

export function calcGrossPnl(trade: Partial<Trade>): number | null {
  if (!trade.entry_price || !trade.exit_price || !trade.quantity) return null

  const multiplier = trade.asset_type === 'option' ? 100 : 1
  const raw =
    trade.direction === 'long'
      ? (trade.exit_price - trade.entry_price) * trade.quantity * multiplier
      : (trade.entry_price - trade.exit_price) * trade.quantity * multiplier

  return raw
}

export function calcNetPnl(trade: Partial<Trade>): number | null {
  const gross = calcGrossPnl(trade)
  if (gross == null) return null
  return gross - (trade.fees ?? 0)
}

export function calcPnlPercent(trade: Partial<Trade>): number | null {
  const net = trade.net_pnl ?? calcNetPnl(trade)
  if (net == null) return null

  const buyAmount = calcBuyAmount(trade)
  if (buyAmount == null || buyAmount === 0) return null

  return (net / buyAmount) * 100
}

export function calcRMultiple(trade: Partial<Trade>): number | null {
  const net = calcNetPnl(trade)
  if (net == null || !trade.initial_risk || trade.initial_risk === 0) return null
  return net / trade.initial_risk
}

export function calcUnrealizedPnl(trade: Partial<Trade>, currentPrice?: number | null): number | null {
  if (currentPrice == null) return null
  if (!trade.quantity || !trade.entry_price) return null

  const multiplier = trade.asset_type === 'option' ? 100 : 1
  const qty = trade.quantity

  const raw =
    trade.direction === 'long'
      ? (currentPrice - trade.entry_price) * qty * multiplier
      : (trade.entry_price - currentPrice) * qty * multiplier

  return raw
}

export function calcUnrealizedPercent(trade: Partial<Trade>, currentPrice?: number | null): number | null {
  const unrealized = calcUnrealizedPnl(trade, currentPrice)
  if (unrealized == null) return null

  const buyAmount = calcBuyAmount(trade)
  if (buyAmount == null || buyAmount === 0) return null

  return (unrealized / buyAmount) * 100
}

export function calcBuyAmount(trade: Partial<Trade>): number | null {
  const multiplier = trade.asset_type === 'option' ? 100 : 1

  if (trade.executions && trade.executions.length > 0) {
    const total = trade.executions
      .filter((e) => e.action === 'buy')
      .reduce((sum, e) => sum + e.quantity * e.price * multiplier, 0)
    return total === 0 ? null : total
  }

  if (!trade.entry_price || !trade.quantity) return null
  return trade.entry_price * trade.quantity * multiplier
}

export function calcSellAmount(trade: Partial<Trade>): number | null {
  const multiplier = trade.asset_type === 'option' ? 100 : 1

  if (trade.executions && trade.executions.length > 0) {
    const total = trade.executions
      .filter((e) => e.action === 'sell')
      .reduce((sum, e) => sum + e.quantity * e.price * multiplier, 0)
    return total === 0 ? null : total
  }

  if (!trade.exit_price || !trade.quantity) return null
  return trade.exit_price * trade.quantity * multiplier
}

// ─── Helper: Calculate mean and standard deviation ─────────────────────────────

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function calculateStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

// ─── Dimension breakdown helper ────────────────────────────────────────────────

function buildDimension(
  trades: Trade[],
  keys: string[],
  getKey: (t: Trade) => string | undefined
): Record<string, { count: number; pnl: number; win_rate: number }> {
  return keys.reduce((acc, key) => {
    const group = trades.filter((t) => getKey(t) === key)
    const wins = group.filter((t) => (t.net_pnl ?? 0) > 0)
    acc[key] = {
      count: group.length,
      pnl: group.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
      win_rate: group.length > 0 ? wins.length / group.length : 0,
    }
    return acc
  }, {} as Record<string, { count: number; pnl: number; win_rate: number }>)
}

// ─── Stats aggregation ────────────────────────────────────────────────────────

export function aggregateStats(trades: Trade[]): TradeStats {
  const closed = trades.filter((t) => t.status === 'closed')
  const winners = closed.filter((t) => (t.net_pnl ?? 0) > 0)
  const losers = closed.filter((t) => (t.net_pnl ?? 0) < 0)

  const totalPnl = closed.reduce((sum, t) => sum + (t.net_pnl ?? 0), 0)
  const totalWin = winners.reduce((sum, t) => sum + (t.net_pnl ?? 0), 0)
  const totalLoss = Math.abs(losers.reduce((sum, t) => sum + (t.net_pnl ?? 0), 0))

  const by_asset_type = (['stock', 'option', 'etf', 'crypto'] as AssetType[]).reduce(
    (acc, type) => {
      const group = closed.filter((t) => t.asset_type === type)
      acc[type] = {
        count: group.length,
        pnl: group.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
      }
      return acc
    },
    {} as TradeStats['by_asset_type']
  )

  const allTags = [...new Set(closed.flatMap((t) => t.strategy_tags))]
  const by_strategy = allTags.reduce(
    (acc, tag) => {
      const group = closed.filter((t) => t.strategy_tags.includes(tag))
      const wins = group.filter((t) => (t.net_pnl ?? 0) > 0)
      acc[tag] = {
        count: group.length,
        pnl: group.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
        win_rate: group.length > 0 ? wins.length / group.length : 0,
      }
      return acc
    },
    {} as TradeStats['by_strategy']
  )

  // ─── Dimensional Analysis (M4) ────────────────────────────────────────────────

  // Sector (dynamic — free-form string)
  const allSectors = [...new Set(closed.map((t) => t.sector).filter(Boolean))] as string[]
  const by_sector = allSectors.reduce((acc, key) => {
    const group = closed.filter((t) => t.sector === key)
    const wins = group.filter((t) => (t.net_pnl ?? 0) > 0)
    acc[key] = {
      count: group.length,
      pnl: group.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
      win_rate: group.length > 0 ? wins.length / group.length : 0,
    }
    return acc
  }, {} as Record<string, { count: number; pnl: number; win_rate: number }>)

  // Timeframe, Duration, Market Condition (enum-bounded)
  const by_timeframe = buildDimension(closed, ['1m','5m','15m','1h','4h','D','W'], (t) => t.timeframe)
  const by_duration = buildDimension(closed, ['scalp','swing','long_term'], (t) => t.duration)
  const by_market_condition = buildDimension(closed, ['trending_up','trending_down','ranging','volatile'], (t) => t.market_conditions)

  // ─── Time-Based Analysis (M4) ────────────────────────────────────────────────

  // Duration Impact: group by holding_period_days
  const getDurationBucket = (days: number | undefined): string => {
    if (days == null || days < 1) return 'intraday'
    if (days <= 5)  return '1-5d'
    if (days <= 20) return '6-20d'
    if (days <= 60) return '21-60d'
    return '60d+'
  }
  const DURATION_BUCKETS = ['intraday', '1-5d', '6-20d', '21-60d', '60d+'] as const
  const by_duration_impact = buildDimension(closed, [...DURATION_BUCKETS], (t) => getDurationBucket(t.holding_period_days))

  // Time of Day: group by entry_date hour
  const getTimeOfDayBucket = (dateStr: string): string => {
    const h = new Date(dateStr).getHours()
    if (h < 4)  return 'overnight'
    if (h < 9)  return 'pre-market'
    if (h < 11) return 'open'
    if (h < 14) return 'midday'
    if (h < 16) return 'afternoon'
    return 'after-hours'
  }
  const TOD_BUCKETS = ['overnight', 'pre-market', 'open', 'midday', 'afternoon', 'after-hours'] as const
  const by_time_of_day = buildDimension(closed, [...TOD_BUCKETS], (t) => getTimeOfDayBucket(t.entry_date))

  // ─── Advanced Analysis (M4) ───────────────────────────────────────────────────

  // Emotional State: group by emotional_state
  const EMOTIONAL_STATES = ['calm', 'fomo', 'fearful', 'confident', 'impulsive', 'disciplined', 'impatient', 'anxious'] as const
  const by_emotional_state = buildDimension(closed, [...EMOTIONAL_STATES], (t) => t.emotional_state)

  // Execution Quality: group by execution_quality (1-5 rating)
  const EXECUTION_QUALITIES = ['1', '2', '3', '4', '5'] as const
  const by_execution_quality = buildDimension(
    closed,
    [...EXECUTION_QUALITIES],
    (t) => t.execution_quality ? String(t.execution_quality) : undefined
  )

  const rMultiples = closed
    .map((t) => t.r_multiple ?? calcRMultiple(t))
    .filter((r) => r != null) as number[]

  // ─── Advanced Metrics (M4) ───────────────────────────────────────────────────

  // Sharpe Ratio: mean(rMultiples) / stdev(rMultiples)
  let sharpe_ratio: number | null = null
  if (rMultiples.length >= 2) {
    const meanR = calculateMean(rMultiples)
    const stdR = calculateStdDev(rMultiples, meanR)
    sharpe_ratio = stdR > 0 ? meanR / stdR : null
  }

  // Sortino Ratio: mean(rMultiples) / downside_stdev(rMultiples)
  let sortino_ratio: number | null = null
  if (rMultiples.length >= 2) {
    const meanR = calculateMean(rMultiples)
    const downside = rMultiples.filter((r) => r < 0)
    if (downside.length > 0) {
      const downsideStd = calculateStdDev(downside, calculateMean(downside))
      sortino_ratio = downsideStd > 0 ? meanR / downsideStd : null
    }
  }

  // Max Drawdown: largest peak-to-trough from cumulative P&L
  let max_drawdown = 0
  if (closed.length > 0) {
    const sorted = closed.sort((a, b) => {
      const aDate = new Date(a.exit_date || a.entry_date).getTime()
      const bDate = new Date(b.exit_date || b.entry_date).getTime()
      return aDate - bDate
    })
    let cumulative = 0
    let peak = 0
    for (const trade of sorted) {
      cumulative += trade.net_pnl ?? 0
      peak = Math.max(peak, cumulative)
      const drawdown = peak - cumulative
      max_drawdown = Math.max(max_drawdown, drawdown)
    }
  }

  // Recovery Factor: total_pnl / max_drawdown
  let recovery_factor: number | null = null
  if (max_drawdown > 0) {
    recovery_factor = totalPnl / max_drawdown
  }

  // Consecutive Wins/Losses
  let max_consecutive_wins = 0
  let max_consecutive_losses = 0
  if (closed.length > 0) {
    const sorted = closed.sort((a, b) => {
      const aDate = new Date(a.exit_date || a.entry_date).getTime()
      const bDate = new Date(b.exit_date || b.entry_date).getTime()
      return aDate - bDate
    })
    let currentWins = 0
    let currentLosses = 0
    for (const trade of sorted) {
      const pnl = trade.net_pnl ?? 0
      if (pnl > 0) {
        currentWins++
        max_consecutive_wins = Math.max(max_consecutive_wins, currentWins)
        currentLosses = 0
      } else if (pnl < 0) {
        currentLosses++
        max_consecutive_losses = Math.max(max_consecutive_losses, currentLosses)
        currentWins = 0
      } else {
        // Break on zero (no P&L)
        currentWins = 0
        currentLosses = 0
      }
    }
  }

  return {
    total_trades: closed.length,
    winning_trades: winners.length,
    losing_trades: losers.length,
    win_rate: closed.length > 0 ? winners.length / closed.length : 0,
    total_pnl: totalPnl,
    avg_win: winners.length > 0 ? totalWin / winners.length : 0,
    avg_loss: losers.length > 0 ? -totalLoss / losers.length : 0,
    profit_factor: totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0,
    avg_r_multiple: rMultiples.length > 0 ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length : 0,
    best_trade: closed.length > 0 ? Math.max(...closed.map((t) => t.net_pnl ?? 0)) : 0,
    worst_trade: closed.length > 0 ? Math.min(...closed.map((t) => t.net_pnl ?? 0)) : 0,
    avg_holding_period:
      closed.length > 0
        ? closed.reduce((s, t) => s + (t.holding_period_days ?? 0), 0) / closed.length
        : 0,
    by_asset_type,
    by_strategy,
    by_sector,
    by_timeframe,
    by_duration,
    by_market_condition,
    by_duration_impact,
    by_time_of_day,
    by_emotional_state,
    by_execution_quality,
    sharpe_ratio,
    sortino_ratio,
    max_drawdown,
    recovery_factor,
    max_consecutive_wins,
    max_consecutive_losses,
  }
}

// ─── Color helpers ────────────────────────────────────────────────────────────

export function pnlColor(value?: number | null): string {
  if (value == null) return 'text-muted-foreground'
  if (value > 0) return 'text-[#00d4a1]'
  if (value < 0) return 'text-[#ff4d6d]'
  return 'text-muted-foreground'
}

export function pnlBg(value?: number | null): string {
  if (value == null) return ''
  if (value > 0) return 'bg-profit-muted'
  if (value < 0) return 'bg-loss-muted'
  return ''
}

// ─── Execution-based P&L (FIFO cost basis) ────────────────────────────────────
//
// Supports all 4 scenarios:
//   1. Buy → Sell (full close)
//   2. Buy → partial Sell → Sell remainder
//   3. Buy → Buy more → Sell all
//   4. Buy → Buy more → partial Sell → Sell remainder
//
// Returns running snapshot after processing all executions in datetime order.

export interface ExecutionSummary {
  netQty: number          // remaining open qty (buy=+, sell=-)
  avgCostBasis: number    // weighted avg entry price of open position
  realizedPnl: number     // total booked P&L from all closed lots
  totalFees: number
  status: 'open' | 'closed' | 'partial'
  entryDate: string | null
  exitDate: string | null
}

export function calcExecutionsSummary(
  executions: TradeExecution[],
  assetType: AssetType = 'stock'
): ExecutionSummary {
  const multiplier = assetType === 'option' ? 100 : 1
  const sorted = [...executions].sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  )

  // FIFO queues for open long lots (from buys) and open short lots (from sells)
  const longLots: { qty: number; price: number }[] = []
  const shortLots: { qty: number; price: number }[] = []
  let realizedPnl = 0
  let totalFees = 0
  let entryDate: string | null = null
  let exitDate: string | null = null

  for (const exec of sorted) {
    totalFees += exec.fee ?? 0

    if (exec.action === 'buy') {
      if (shortLots.length > 0) {
        // Covering a short position
        exitDate = exec.datetime
        let toClose = exec.quantity
        while (toClose > 0 && shortLots.length > 0) {
          const lot = shortLots[0]
          const filled = Math.min(lot.qty, toClose)
          realizedPnl += (lot.price - exec.price) * filled * multiplier
          lot.qty -= filled
          toClose -= filled
          if (lot.qty <= 0) shortLots.shift()
        }
        if (toClose > 0) {
          if (!entryDate) entryDate = exec.datetime
          longLots.push({ qty: toClose, price: exec.price })
        }
      } else {
        if (!entryDate) entryDate = exec.datetime
        longLots.push({ qty: exec.quantity, price: exec.price })
      }
    } else {
      // sell
      if (longLots.length > 0) {
        // Closing a long position
        exitDate = exec.datetime
        let toClose = exec.quantity
        while (toClose > 0 && longLots.length > 0) {
          const lot = longLots[0]
          const filled = Math.min(lot.qty, toClose)
          realizedPnl += (exec.price - lot.price) * filled * multiplier
          lot.qty -= filled
          toClose -= filled
          if (lot.qty <= 0) longLots.shift()
        }
        if (toClose > 0) {
          if (!entryDate) entryDate = exec.datetime
          shortLots.push({ qty: toClose, price: exec.price })
        }
      } else {
        // Opening a short position
        if (!entryDate) entryDate = exec.datetime
        shortLots.push({ qty: exec.quantity, price: exec.price })
      }
    }
  }

  realizedPnl -= totalFees

  const netLongQty = longLots.reduce((s, l) => s + l.qty, 0)
  const netShortQty = shortLots.reduce((s, l) => s + l.qty, 0)
  const netQty = netLongQty + netShortQty

  const openLots = netLongQty > 0 ? longLots : shortLots
  const openQty = openLots.reduce((s, l) => s + l.qty, 0)
  const totalCost = openLots.reduce((s, l) => s + l.qty * l.price, 0)
  const avgCostBasis = openQty > 0 ? totalCost / openQty : 0

  // Status: treat any still-open position as "open"; fully exited as "closed".
  const status: ExecutionSummary['status'] =
    executions.length > 0 && netQty === 0 ? 'closed' : 'open'

  return { netQty, avgCostBasis, realizedPnl, totalFees, status, entryDate, exitDate }
}

export const STRATEGY_TAG_LABELS: Record<string, string> = {
  breakout: 'Breakout',
  breakdown: 'Breakdown',
  trend_follow: 'Trend Follow',
  mean_reversion: 'Mean Reversion',
  gap_fill: 'Gap Fill',
  earnings_play: 'Earnings Play',
  momentum: 'Momentum',
  swing: 'Swing',
  scalp: 'Scalp',
  news_catalyst: 'News Catalyst',
  support_bounce: 'Support Bounce',
  resistance_reject: 'Resistance Reject',
  vwap_reclaim: 'VWAP Reclaim',
  iron_condor: 'Iron Condor',
  vertical_spread: 'Vertical Spread',
  covered_call: 'Covered Call',
  cash_secured_put: 'Cash Secured Put',
  straddle: 'Straddle',
  strangle: 'Strangle',
  custom: 'Custom',
}

// ─── Trade Similarity (M3) ───────────────────────────────────────────────────

function scoreNumericCloseness(a: number | null | undefined, b: number | null | undefined, maxScore: number, scale: number): number {
  if (a == null || b == null) return 0
  const diff = Math.abs(a - b)
  const s = maxScore - diff * scale
  return s > 0 ? s : 0
}

export function computeTradeSimilarityScore(a: Trade, b: Trade): number {
  let score = 0

  // Exact / categorical matches
  if (a.ticker && b.ticker && a.ticker.toUpperCase() === b.ticker.toUpperCase()) score += 30
  if (a.asset_type === b.asset_type) score += 5
  if (a.direction === b.direction) score += 10
  if (a.status === b.status) score += 5
  if (a.timeframe && b.timeframe && a.timeframe === b.timeframe) score += 5
  if (a.duration && b.duration && a.duration === b.duration) score += 5
  if (a.market_conditions && b.market_conditions && a.market_conditions === b.market_conditions) score += 5
  if (a.emotional_state && b.emotional_state && a.emotional_state === b.emotional_state) score += 5

  // Strategy tag overlap (Jaccard-like, capped)
  if (Array.isArray(a.strategy_tags) && Array.isArray(b.strategy_tags)) {
    const setA = new Set(a.strategy_tags)
    const shared = b.strategy_tags.filter((t) => setA.has(t))
    const tagScore = Math.min(shared.length * 5, 20)
    score += tagScore
  }

  // Execution quality closeness (max 5)
  if (a.execution_quality != null && b.execution_quality != null) {
    const diff = Math.abs(a.execution_quality - b.execution_quality)
    const s = 5 - diff * 2.5
    if (s > 0) score += s
  }

  // R-multiple & P&L% closeness (numeric)
  score += scoreNumericCloseness(a.r_multiple ?? null, b.r_multiple ?? null, 15, 5)
  score += scoreNumericCloseness(a.pnl_percent ?? null, b.pnl_percent ?? null, 10, 0.5)

  // Clamp to 0–100 for interpretability
  if (score < 0) score = 0
  if (score > 100) score = 100
  return Math.round(score)
}

export function findSimilarTrades(reference: Trade, trades: Trade[], limit = 5): { trade: Trade; score: number }[] {
  const scored = trades
    .filter((t) => t.id !== reference.id)
    .map((t) => ({ trade: t, score: computeTradeSimilarityScore(reference, t) }))
    .filter((entry) => entry.score >= 20)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit)
}
