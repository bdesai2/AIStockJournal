import type { Trade, TradeStats, AssetType } from '@/types'

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
  const net = calcNetPnl(trade)
  if (net == null || !trade.entry_price || !trade.quantity) return null
  const cost = trade.entry_price * trade.quantity
  return (net / cost) * 100
}

export function calcRMultiple(trade: Partial<Trade>): number | null {
  const net = calcNetPnl(trade)
  if (net == null || !trade.initial_risk || trade.initial_risk === 0) return null
  return net / trade.initial_risk
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

  const rMultiples = closed.filter((t) => t.r_multiple != null).map((t) => t.r_multiple as number)

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
