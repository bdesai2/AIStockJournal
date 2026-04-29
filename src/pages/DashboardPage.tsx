import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp,TrendingDown,Target,Activity,Award,AlertTriangle,PlusCircle,Brain,Sparkles,Loader2,ChevronDown,ChevronUp,Zap,Flame,Trophy,Lock } from 'lucide-react'
import { AreaChart,Area,XAxis,YAxis,Tooltip,ResponsiveContainer,BarChart,Bar,Cell } from 'recharts'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { useAiStore } from '@/store/aiStore'
import { aggregateStats, fmt, STRATEGY_TAG_LABELS } from '@/lib/tradeUtils'
import { useCanAccess } from '@/lib/featureGates'
import { TradeRow } from '@/components/trades/TradeRow'
import { Tooltip as UITooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { db } from '@/lib/supabase'
import type { CSSProperties } from 'react'
import type { Trade, StrategyTag } from '@/types'

// ── Heatmap helpers ────────────────────────────────────────────────────────────
function heatmapCellStyle(pnl: number | null, maxPnl: number): CSSProperties {
  if (pnl === null) return { backgroundColor: 'hsl(222 47% 9%)' }
  if (pnl === 0) return { backgroundColor: 'hsl(222 47% 12%)' }
  const ratio = Math.min(Math.abs(pnl) / maxPnl, 1)
  const alpha = 0.15 + ratio * 0.85
  return {
    backgroundColor:
      pnl > 0
        ? `rgba(0, 212, 161, ${alpha.toFixed(2)})`
        : `rgba(255, 77, 109, ${alpha.toFixed(2)})`,
  }
}

function compactCurrency(v: number): string {
  const abs = Math.abs(v)
  const sign = v >= 0 ? '' : '-'
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${abs.toFixed(0)}`
}

// ── Dimension Card ─────────────────────────────────────────────────────────────

function DimensionCard({ title, data, labelMap }: {
  title: string
  data: Record<string, { count: number; pnl: number; win_rate: number }>
  labelMap?: Record<string, string>
}) {
  const rows = Object.entries(data)
    .filter(([, d]) => d.count > 0)
    .sort(([, a], [, b]) => b.win_rate - a.win_rate)

  if (rows.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">{title}</p>
      <div className="space-y-3">
        {rows.map(([key, { count, pnl, win_rate }]) => {
          const label = labelMap?.[key] ?? key
          const pct = Math.round(win_rate * 100)
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{label}</span>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className={pct >= 50 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]'}>{pct}% WR</span>
                  <span className="text-muted-foreground">{count}t</span>
                  <span className={pnl >= 0 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]'}>{pnl >= 0 ? '+' : ''}{fmt.currency(pnl)}</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: pct >= 50 ? '#00d4a1' : '#ff4d6d', opacity: 0.75 }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, selectedAccountId, subscription, fetchSubscription } = useAuthStore()
  const { trades, loading, fetchTrades } = useTradeStore()
  const { runWeeklyDigest, digestLoading, digestResult, digestError, clearDigestError } = useAiStore()
  const [digestOpen, setDigestOpen] = useState(true) // Auto-expand if digest exists
  const [lastDigest, setLastDigest] = useState<any>(null)
  const [dateRangeFrom, setDateRangeFrom] = useState<string>('')
  const [dateRangeTo, setDateRangeTo] = useState<string>('')
  // Advanced filters
  const [filterStrategy, setFilterStrategy] = useState<string>('')
  const [filterAssetType, setFilterAssetType] = useState<string>('')
  const [filterSector, setFilterSector] = useState<string>('')
  // Collapsible sections
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [advancedMetricsOpen, setAdvancedMetricsOpen] = useState(false)
  const [dimensionalOpen, setDimensionalOpen] = useState(false)
  const [timeBasedOpen, setTimeBasedOpen] = useState(false)
  const [advancedAnalysisOpen, setAdvancedAnalysisOpen] = useState(false)
  const [proBannerOpen, setProBannerOpen] = useState(true)

  // Feature access checks
  const canAccessAdvancedMetrics = useCanAccess('ADVANCED_METRICS', subscription?.tier)
  const canAccessDimensionalAnalysis = useCanAccess('DIMENSIONAL_ANALYSIS', subscription?.tier)
  const canAccessTimeAnalysis = useCanAccess('TIME_OF_DAY_ANALYSIS', subscription?.tier)
  const canAccessHeatmap = useCanAccess('HEATMAP', subscription?.tier)

  useEffect(() => {
    if (user?.id && selectedAccountId) fetchTrades(user.id, selectedAccountId)
    if (user?.id) fetchSubscription(user.id) // Refresh subscription (catches admin tier changes)
  }, [user?.id, selectedAccountId, fetchTrades, fetchSubscription])

  // Fetch latest digest from database on mount
  useEffect(() => {
    const fetchLatestDigest = async () => {
      if (!user?.id) return
      try {
        const { data } = await db.digests()
          .select()
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .single()
        if (data) setLastDigest(data)
      } catch (err) {
        // Silently fail if no digest exists
      }
    }
    fetchLatestDigest()
  }, [user?.id])

  // Filter trades by date range and other dimensions
  const filteredTrades = useMemo(() => {
    let result = trades
    if (dateRangeFrom) {
      const fromDate = new Date(dateRangeFrom)
      result = result.filter(t => new Date(t.entry_date) >= fromDate)
    }
    if (dateRangeTo) {
      const toDate = new Date(dateRangeTo)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter(t => new Date(t.entry_date) <= toDate)
    }
    if (filterStrategy) {
      result = result.filter(t => t.strategy_tags.includes(filterStrategy as StrategyTag))
    }
    if (filterAssetType) {
      result = result.filter(t => t.asset_type === filterAssetType)
    }
    if (filterSector) {
      result = result.filter(t => t.sector === filterSector)
    }
    return result
  }, [trades, dateRangeFrom, dateRangeTo, filterStrategy, filterAssetType, filterSector])

  const closedTrades = useMemo(
    () => filteredTrades.filter(t => t.status === 'closed').slice(0, 30),
    [filteredTrades]
  )

  const handleRunDigest = () => {
    runWeeklyDigest(closedTrades)
    setDigestOpen(true)
  }

  const stats = useMemo(() => aggregateStats(filteredTrades), [filteredTrades])

  // Display labels for dimensions
  const TIMEFRAME_LABELS: Record<string, string> = {
    '1m': '1 Min', '5m': '5 Min', '15m': '15 Min',
    '1h': '1 Hour', '4h': '4 Hour', 'D': 'Daily', 'W': 'Weekly',
  }
  const DURATION_LABELS: Record<string, string> = {
    scalp: 'Scalp', swing: 'Swing', long_term: 'Long-Term',
  }
  const MARKET_CONDITION_LABELS: Record<string, string> = {
    trending_up: 'Trending Up', trending_down: 'Trending Down',
    ranging: 'Ranging', volatile: 'Volatile',
  }
  const DURATION_IMPACT_LABELS: Record<string, string> = {
    'intraday': 'Intraday (<1d)',
    '1-5d':     '1–5 Days',
    '6-20d':    '6–20 Days',
    '21-60d':   '21–60 Days',
    '60d+':     '60+ Days',
  }
  const TIME_OF_DAY_LABELS: Record<string, string> = {
    'overnight':   'Overnight (0–4h)',
    'pre-market':  'Pre-Market (4–9h)',
    'open':        'Market Open (9–11h)',
    'midday':      'Midday (11–14h)',
    'afternoon':   'Afternoon (14–16h)',
    'after-hours': 'After Hours (16h+)',
  }
  const EMOTIONAL_STATE_LABELS: Record<string, string> = {
    'calm': 'Calm', 'fomo': 'FOMO', 'fearful': 'Fearful',
    'confident': 'Confident', 'impulsive': 'Impulsive', 'disciplined': 'Disciplined',
    'impatient': 'Impatient', 'anxious': 'Anxious',
  }
  const EXECUTION_QUALITY_LABELS: Record<string, string> = {
    '1': 'Poor (1)', '2': 'Fair (2)', '3': 'Good (3)',
    '4': 'Very Good (4)', '5': 'Excellent (5)',
  }

  // Cumulative P&L curve
  const pnlCurve = useMemo(() => {
    const closed = filteredTrades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime())

    let cumulative = 0
    return closed.map((t) => {
      cumulative += t.net_pnl ?? 0
      return { date: fmt.date(t.exit_date), pnl: cumulative, ticker: t.ticker }
    })
  }, [filteredTrades])

  // Daily P&L bars (last 30 days)
  const dailyPnl = useMemo(() => {
    const map = new Map<string, number>()
    filteredTrades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .forEach((t) => {
        const day = t.exit_date!.slice(0, 10)
        map.set(day, (map.get(day) ?? 0) + (t.net_pnl ?? 0))
      })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, pnl]) => ({ date: date.slice(5), pnl }))
  }, [filteredTrades])

  // 52-week P&L activity heatmap
  const heatmapData = useMemo(() => {
    const map = new Map<string, number>()
    filteredTrades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .forEach((t) => {
        const day = t.exit_date!.slice(0, 10)
        map.set(day, (map.get(day) ?? 0) + (t.net_pnl ?? 0))
      })

    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - 364)
    start.setDate(start.getDate() - start.getDay()) // back to Sunday

    const allDays: { date: string; pnl: number | null }[] = []
    const cur = new Date(start)

    while (cur <= today || allDays.length % 7 !== 0) {
      const d = cur.toISOString().slice(0, 10)
      allDays.push({
        date: d,
        pnl: cur > today ? null : (map.get(d) ?? null),
      })
      cur.setDate(cur.getDate() + 1)
    }

    const weeks: typeof allDays[] = []
    for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7))

    const vals = allDays
      .filter((d) => d.pnl != null && d.pnl !== 0)
      .map((d) => Math.abs(d.pnl!))
    const maxPnl = vals.length > 0 ? Math.max(...vals) : 1

    return { weeks, maxPnl }
  }, [filteredTrades])

  // Strategy breakdown — sorted by |pnl|, top 8
  const strategyChartData = useMemo(
    () =>
      Object.entries(stats.by_strategy)
        .map(([tag, { count, pnl, win_rate }]) => ({
          name: STRATEGY_TAG_LABELS[tag] ?? tag,
          pnl,
          count,
          winRate: Math.round(win_rate * 100),
        }))
        .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
        .slice(0, 8),
    [stats]
  )

  // Asset type breakdown with relative bar widths
  const assetTypeData = useMemo(() => {
    const items = (['stock', 'option', 'etf', 'crypto'] as const)
      .map((type) => ({
        type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        count: stats.by_asset_type[type].count,
        pnl: stats.by_asset_type[type].pnl,
      }))
      .filter((d) => d.count > 0)
    const maxAbsPnl = items.length > 0 ? Math.max(...items.map((d) => Math.abs(d.pnl))) : 1
    return items.map((d) => ({
      ...d,
      barWidth: maxAbsPnl > 0 ? (Math.abs(d.pnl) / maxAbsPnl) * 100 : 0,
    }))
  }, [stats])

  // Monthly P&L data (last 12 months)
  const monthlyData = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; wins: number }>()
    filteredTrades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .forEach((t) => {
        const d = new Date(t.exit_date!)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const row = map.get(key) ?? { pnl: 0, count: 0, wins: 0 }
        row.pnl += t.net_pnl ?? 0
        row.count += 1
        if ((t.net_pnl ?? 0) > 0) row.wins += 1
        map.set(key, row)
      })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, { pnl, count, wins }]) => {
        const [year, month] = key.split('-')
        const label = new Date(Number(year), Number(month) - 1, 1)
          .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        return { key, label, pnl, count, winRate: count > 0 ? Math.round((wins / count) * 100) : 0 }
      })
  }, [filteredTrades])

  // Weekly P&L data (last 16 weeks)
  const weeklyData = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; wins: number }>()
    filteredTrades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .forEach((t) => {
        const d = new Date(t.exit_date!)
        // ISO week: Monday-based
        const day = d.getDay() === 0 ? 6 : d.getDay() - 1 // 0=Mon … 6=Sun
        const monday = new Date(d)
        monday.setDate(d.getDate() - day)
        const key = monday.toISOString().slice(0, 10)
        const row = map.get(key) ?? { pnl: 0, count: 0, wins: 0 }
        row.pnl += t.net_pnl ?? 0
        row.count += 1
        if ((t.net_pnl ?? 0) > 0) row.wins += 1
        map.set(key, row)
      })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-16)
      .map(([key, { pnl, count, wins }]) => {
        const d = new Date(key)
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        return { key, label, pnl, count, winRate: count > 0 ? Math.round((wins / count) * 100) : 0 }
      })
  }, [filteredTrades])

  // Quarterly P&L data (last 8 quarters)
  const quarterlyData = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; wins: number }>()
    filteredTrades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .forEach((t) => {
        const d = new Date(t.exit_date!)
        const q = Math.floor(d.getMonth() / 3) + 1
        const key = `${d.getFullYear()}-Q${q}`
        const row = map.get(key) ?? { pnl: 0, count: 0, wins: 0 }
        row.pnl += t.net_pnl ?? 0
        row.count += 1
        if ((t.net_pnl ?? 0) > 0) row.wins += 1
        map.set(key, row)
      })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([key, { pnl, count, wins }]) => ({
        label: key,
        pnl,
        count,
        winRate: count > 0 ? Math.round((wins / count) * 100) : 0,
      }))
  }, [filteredTrades])

  // Month vs Month Comparison (current vs previous)
  const monthComparison = useMemo(() => {
    const today = new Date()
    const currentMonth = today.getFullYear() * 100 + (today.getMonth() + 1)
    const prevMonth = today.getMonth() === 0 ? (today.getFullYear() - 1) * 100 + 12 : today.getFullYear() * 100 + today.getMonth()

    const extractMonth = (dateStr: string) => {
      const d = new Date(dateStr)
      return d.getFullYear() * 100 + (d.getMonth() + 1)
    }

    const current = filteredTrades.filter(t => t.status === 'closed' && t.exit_date && extractMonth(t.exit_date!) === currentMonth)
    const previous = filteredTrades.filter(t => t.status === 'closed' && t.exit_date && extractMonth(t.exit_date!) === prevMonth)

    return {
      current: {
        pnl: current.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
        count: current.length,
        wins: current.filter(t => (t.net_pnl ?? 0) > 0).length,
      },
      previous: {
        pnl: previous.reduce((s, t) => s + (t.net_pnl ?? 0), 0),
        count: previous.length,
        wins: previous.filter(t => (t.net_pnl ?? 0) > 0).length,
      },
    }
  }, [filteredTrades])

  // Drawdown Analysis - track periods and severity
  const drawdownAnalysis = useMemo(() => {
    const closed = filteredTrades
      .filter(t => t.status === 'closed')
      .sort((a, b) => new Date(a.exit_date || a.entry_date).getTime() - new Date(b.exit_date || b.entry_date).getTime())

    let cumulative = 0
    let peak = 0
    const periods: { date: string; severity: number; depth: number }[] = []
    let inDrawdown = false
    let drawdownStart = 0
    let maxDrawdownInPeriod = 0

    for (const trade of closed) {
      cumulative += trade.net_pnl ?? 0
      peak = Math.max(peak, cumulative)
      const drawdown = peak - cumulative

      if (drawdown > 0 && !inDrawdown) {
        inDrawdown = true
        drawdownStart = cumulative
        maxDrawdownInPeriod = drawdown
      } else if (drawdown > 0 && inDrawdown) {
        maxDrawdownInPeriod = Math.max(maxDrawdownInPeriod, drawdown)
      } else if (drawdown === 0 && inDrawdown) {
        inDrawdown = false
        periods.push({
          date: fmt.date(trade.exit_date || trade.entry_date),
          severity: maxDrawdownInPeriod > 0 ? Math.min(100, (maxDrawdownInPeriod / Math.abs(drawdownStart || 1)) * 100) : 0,
          depth: maxDrawdownInPeriod,
        })
      }
    }

    return periods.slice(-12) // Last 12 drawdown periods
  }, [filteredTrades])

  // Correlation Analysis - compute correlations
  const correlationAnalysis = useMemo(() => {
    const strategies = [...new Set(filteredTrades.flatMap(t => t.strategy_tags))]
    const assets = ['stock', 'option', 'etf', 'crypto'] as const

    // Strategy correlations with returns
    const strategyCorrelations = strategies.map(strategy => {
      const trades = filteredTrades.filter(t => t.strategy_tags.includes(strategy) && t.status === 'closed')
      const returns = trades.map(t => (t.net_pnl ?? 0) / (Math.abs(t.entry_price * t.quantity) || 1))
      const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
      return { label: strategy, correlation: avgReturn, count: trades.length }
    })

    // Asset type correlations
    const assetCorrelations = assets.map(asset => {
      const trades = filteredTrades.filter(t => t.asset_type === asset && t.status === 'closed')
      const returns = trades.map(t => (t.net_pnl ?? 0) / (Math.abs(t.entry_price * t.quantity) || 1))
      const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
      return { label: asset, correlation: avgReturn, count: trades.length }
    })

    return { strategyCorrelations: strategyCorrelations.filter(s => s.count > 0), assetCorrelations: assetCorrelations.filter(a => a.count > 0) }
  }, [filteredTrades])

  // Trade Similarity Matching - find similar trades
  const tradeSimilarityMatches = useMemo(() => {
    if (filteredTrades.length < 2) return []

    // Calculate similarity score between two trades
    const calculateSimilarity = (t1: Trade, t2: Trade): number => {
      let score = 0
      let maxScore = 0

      // Same ticker (high weight)
      if (t1.ticker === t2.ticker) score += 30
      maxScore += 30

      // Same asset type
      if (t1.asset_type === t2.asset_type) score += 20
      maxScore += 20

      // Same direction
      if (t1.direction === t2.direction) score += 15
      maxScore += 15

      // Overlapping strategy tags
      const overlap = t1.strategy_tags.filter(tag => t2.strategy_tags.includes(tag)).length
      const totalUnique = new Set([...t1.strategy_tags, ...t2.strategy_tags]).size
      if (totalUnique > 0) score += (overlap / totalUnique) * 20
      maxScore += 20

      // Similar entry price range (within 10%)
      const priceDiff = Math.abs(t1.entry_price - t2.entry_price) / Math.min(t1.entry_price, t2.entry_price)
      if (priceDiff < 0.1) score += 15
      maxScore += 15

      return (score / maxScore) * 100
    }

    const closed = filteredTrades.filter(t => t.status === 'closed')
    if (closed.length < 2) return []

    // Find most similar trade pairs
    const pairs: { trade1: Trade; trade2: Trade; similarity: number }[] = []
    for (let i = 0; i < closed.length; i++) {
      for (let j = i + 1; j < closed.length; j++) {
        const similarity = calculateSimilarity(closed[i], closed[j])
        if (similarity > 60) {
          pairs.push({ trade1: closed[i], trade2: closed[j], similarity })
        }
      }
    }

    return pairs.sort((a, b) => b.similarity - a.similarity).slice(0, 5)
  }, [filteredTrades])

  const recentTrades = trades.slice(0, 8)

  const statCards = [
    {
      label: 'Total P&L',
      value: fmt.currency(stats.total_pnl),
      sub: `${stats.total_trades} closed trades`,
      icon: stats.total_pnl >= 0 ? TrendingUp : TrendingDown,
      color: stats.total_pnl >= 0 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]',
      glow: stats.total_pnl >= 0 ? 'card-glow-profit' : 'card-glow-loss',
    },
    {
      label: 'Win Rate',
      value: `${(stats.win_rate * 100).toFixed(1)}%`,
      sub: `${stats.winning_trades}W / ${stats.losing_trades}L`,
      icon: Target,
      color: stats.win_rate >= 0.5 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]',
      glow: '',
    },
    {
      label: 'Profit Factor',
      value: isFinite(stats.profit_factor) ? stats.profit_factor.toFixed(2) : '∞',
      sub: `Avg win ${fmt.currency(stats.avg_win)}`,
      icon: Activity,
      color: stats.profit_factor >= 1.5 ? 'text-[#00d4a1]' : 'text-[#f0b429]',
      glow: '',
    },
    {
      label: 'Avg R-Multiple',
      value: fmt.rMultiple(stats.avg_r_multiple),
      sub: `Best: ${fmt.currency(stats.best_trade)}`,
      icon: Award,
      color: stats.avg_r_multiple >= 0 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]',
      glow: '',
    },
  ]

  // Advanced Metrics (M4/M6.5)
  const advancedCards = [
    {
      label: 'Expectancy',
      value: fmt.currency(stats.expectancy),
      sub: 'Average profit per trade',
      icon: Target,
      color: stats.expectancy > 0 ? 'text-[#00d4a1]' : stats.expectancy < 0 ? 'text-[#ff4d6d]' : 'text-muted-foreground',
    },
    {
      label: 'Avg Loss',
      value: fmt.currency(stats.avg_loss),
      sub: `${Math.abs(stats.avg_loss_percent).toFixed(1)}% avg`,
      icon: TrendingDown,
      color: 'text-[#ff4d6d]',
    },
    {
      label: 'Win Hold Time',
      value: fmt.holdTime(stats.avg_win_hold_time),
      sub: 'Avg hold for wins',
      icon: Trophy,
      color: 'text-[#00d4a1]',
    },
    {
      label: 'Loss Hold Time',
      value: fmt.holdTime(stats.avg_loss_hold_time),
      sub: 'Avg hold for losses',
      icon: Activity,
      color: 'text-[#ff4d6d]',
    },
    {
      label: 'Daily Volume',
      value: `${stats.avg_daily_trades.toFixed(1)}`,
      sub: 'Avg trades/day',
      icon: Zap,
      color: 'text-[#f0b429]',
    },
    {
      label: 'Avg Size',
      value: `${stats.avg_size.toFixed(0)}`,
      sub: 'Avg qty/trade',
      icon: Award,
      color: 'text-muted-foreground',
    },
    {
      label: 'Sharpe Ratio',
      value: stats.sharpe_ratio != null ? fmt.number(stats.sharpe_ratio, 2) : '—',
      sub: 'Risk-adj return (R)',
      icon: Zap,
      color: stats.sharpe_ratio == null ? 'text-muted-foreground' : stats.sharpe_ratio >= 1 ? 'text-[#00d4a1]' : stats.sharpe_ratio >= 0 ? 'text-[#f0b429]' : 'text-[#ff4d6d]',
    },
    {
      label: 'Sortino Ratio',
      value: stats.sortino_ratio != null ? fmt.number(stats.sortino_ratio, 2) : '—',
      sub: 'Downside-adj return',
      icon: Activity,
      color: stats.sortino_ratio == null ? 'text-muted-foreground' : stats.sortino_ratio >= 1.5 ? 'text-[#00d4a1]' : stats.sortino_ratio >= 0 ? 'text-[#f0b429]' : 'text-[#ff4d6d]',
    },
    {
      label: 'Max Drawdown',
      value: fmt.currency(stats.max_drawdown),
      sub: 'Peak-to-trough loss',
      icon: TrendingDown,
      color: 'text-[#ff4d6d]',
    },
    {
      label: 'Recovery Factor',
      value: stats.recovery_factor != null ? fmt.number(stats.recovery_factor, 2) : '—',
      sub: 'P&L / Max Drawdown',
      icon: Flame,
      color: stats.recovery_factor == null ? 'text-muted-foreground' : stats.recovery_factor >= 2 ? 'text-[#00d4a1]' : stats.recovery_factor >= 1 ? 'text-[#f0b429]' : 'text-[#ff4d6d]',
    },
    {
      label: 'Max Consec. Wins',
      value: `${stats.max_consecutive_wins}`,
      sub: `${stats.max_consecutive_losses} max losses`,
      icon: TrendingUp,
      color: 'text-[#00d4a1]',
    },
    {
      label: 'Max Consec. Losses',
      value: `${stats.max_consecutive_losses}`,
      sub: `${stats.max_consecutive_wins} max wins`,
      icon: Flame,
      color: 'text-[#ff4d6d]',
    },
  ]

  if (loading && trades.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm font-mono">Loading trades...</p>
        </div>
      </div>
    )
  }

  // Tooltip explanations
  const tooltips = {
    expectancy: 'Average profit per trade. Positive expectancy is crucial for long-term profitability.',
    avgLoss: 'Average loss per losing trade. Combined with win rate, determines if strategy is profitable.',
    winHoldTime: 'Average number of days you hold winning trades. Longer hold times can mean bigger wins.',
    lossHoldTime: 'Average number of days you hold losing trades. Longer hold times can mean bigger losses.',
    dailyVolume: 'Average number of trades per day. Indicates your trading frequency/activity level.',
    avgSize: 'Average quantity (shares/contracts) per trade. Shows your typical position sizing.',
    totalPnL: 'Total profit or loss across all closed trades, after fees.',
    winRate: 'Percentage of trades that were profitable. Win rate ≥50% is generally profitable with positive expectancy.',
    profitFactor: 'Ratio of average winning trade to average losing trade. Higher is better; >1.5 is solid.',
    avgRMultiple: 'Average risk-reward ratio. Measures how much you made per unit of risk taken. Positive is profitable.',
    sharpeRatio: 'Risk-adjusted return metric. Higher is better; ≥1.0 means returns exceed volatility. Based on R-multiple series.',
    sortinoRatio: 'Downside risk-adjusted return. Ignores upside volatility, only penalizes losses. ≥1.5 is excellent.',
    maxDrawdown: 'Largest peak-to-trough loss in your equity curve. Represents maximum pain experienced in a losing streak.',
    recoveryFactor: 'Total profit divided by max drawdown. How efficiently you recovered from largest loss. ≥2.0 is very good.',
    maxConsecWins: 'Longest winning streak. Shows consistency and ability to maintain winning runs.',
    maxConsecLosses: 'Longest losing streak. Shows resilience and recovery ability. Track patterns during these periods.',
    monthComparison: 'Compare your current month performance against the previous month to track progress and identify trends.',
    drawdownAnalysis: 'Timeline of drawdown periods showing when equity losses occurred and their severity (0-100%). Higher bars indicate more severe drawdowns.',
    strategyCorrelation: 'Average return percentage for each strategy. Shows which strategies are most profitable. Positive % = profitable strategy.',
    assetCorrelation: 'Average return percentage by asset type. Identifies which asset classes perform best in your portfolio.',
    similarityMatching: 'Finds past trades similar to each other based on ticker, strategy, direction, and price. Use to analyze patterns in similar trades.',
  }

  return (
    <TooltipProvider>
    <div className="p-6 space-y-6 animate-in">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display tracking-wider">DASHBOARD</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <button
          onClick={() => navigate('/trades/new')}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Log Trade
        </button>
      </div>

      {/* Collapsible Filters Section */}
      <div className="border border-border rounded-lg">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
        >
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Filters</span>
          {filtersOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {filtersOpen && (
          <div className="px-4 py-3 space-y-3 border-t border-border bg-muted/20">
            {/* Date range */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Date Range</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateRangeFrom}
                  onChange={(e) => setDateRangeFrom(e.target.value)}
                  className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm"
                />
                <span className="text-muted-foreground text-sm">→</span>
                <input
                  type="date"
                  value={dateRangeTo}
                  onChange={(e) => setDateRangeTo(e.target.value)}
                  className="flex-1 px-3 py-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
            </div>

            {/* Asset Type, Strategy, Sector on single line */}
            <div className="grid grid-cols-3 gap-2">
              {/* Asset Type Filter */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Asset Type</p>
                <select
                  value={filterAssetType}
                  onChange={(e) => setFilterAssetType(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  <option value="">All asset types</option>
                  <option value="stock">Stock</option>
                  <option value="option">Option</option>
                  <option value="etf">ETF</option>
                  <option value="crypto">Crypto</option>
                </select>
              </div>

              {/* Strategy Filter */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Strategy</p>
                <select
                  value={filterStrategy}
                  onChange={(e) => setFilterStrategy(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  <option value="">All strategies</option>
                  {[...new Set(trades.flatMap(t => t.strategy_tags))].sort().map((tag: StrategyTag) => (
                    <option key={tag} value={tag}>{STRATEGY_TAG_LABELS[tag] ?? tag}</option>
                  ))}
                </select>
              </div>

              {/* Sector Filter */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Sector</p>
                <select
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  <option value="">All sectors</option>
                  {[...new Set(trades.map(t => t.sector).filter(Boolean))].sort().map(sector => (
                    <option key={sector} value={sector}>{sector}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clear button */}
            {(dateRangeFrom || dateRangeTo || filterAssetType || filterStrategy || filterSector) && (
              <button
                onClick={() => {
                  setDateRangeFrom('')
                  setDateRangeTo('')
                  setFilterAssetType('')
                  setFilterStrategy('')
                  setFilterSector('')
                }}
                className="w-full px-3 py-2 rounded text-xs bg-muted hover:bg-muted/80 transition-colors font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {trades.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">No trades yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Start logging your trades to see your performance analytics.
          </p>
          <button
            onClick={() => navigate('/trades/new')}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            Log Your First Trade
          </button>
        </div>
      )}

      {trades.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {statCards.map(({ label, value, sub, icon: Icon, color, glow }, idx) => (
              <UITooltip key={label}>
                <TooltipTrigger asChild>
                  <div className={`stat-card ${glow} cursor-help`}>
                    <div className="flex items-center justify-between">
                      <span className="stat-label">{label}</span>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <span className={`stat-value ${color}`}>{value}</span>
                    <span className="text-xs text-muted-foreground font-mono">{sub}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  {idx === 0 && tooltips.totalPnL}
                  {idx === 1 && tooltips.winRate}
                  {idx === 2 && tooltips.profitFactor}
                  {idx === 3 && tooltips.avgRMultiple}
                </TooltipContent>
              </UITooltip>
            ))}
          </div>

          {/* Month vs Month Comparison — moved to top */}
          {(monthComparison.current.count > 0 || monthComparison.previous.count > 0) && (
            <UITooltip>
              <TooltipTrigger asChild>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 cursor-help">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Current Month</p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-2xl font-bold" style={{ color: monthComparison.current.pnl >= 0 ? '#00d4a1' : '#ff4d6d' }}>
                          {fmt.currency(monthComparison.current.pnl)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{monthComparison.current.count} trades · {monthComparison.current.count > 0 ? Math.round((monthComparison.current.wins / monthComparison.current.count) * 100) : 0}% WR</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Previous Month</p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-2xl font-bold" style={{ color: monthComparison.previous.pnl >= 0 ? '#00d4a1' : '#ff4d6d' }}>
                          {fmt.currency(monthComparison.previous.pnl)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{monthComparison.previous.count} trades · {monthComparison.previous.count > 0 ? Math.round((monthComparison.previous.wins / monthComparison.previous.count) * 100) : 0}% WR</p>
                      </div>
                      {monthComparison.previous.count > 0 && monthComparison.current.count > 0 && (
                        <div className="text-xs pt-2 border-t border-border">
                          <p className="text-muted-foreground">Change: <span style={{ color: monthComparison.current.pnl - monthComparison.previous.pnl >= 0 ? '#00d4a1' : '#ff4d6d' }}>{monthComparison.current.pnl - monthComparison.previous.pnl >= 0 ? '+' : ''}{fmt.currency(monthComparison.current.pnl - monthComparison.previous.pnl)}</span></p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {tooltips.monthComparison}
              </TooltipContent>
            </UITooltip>
          )}

          {/* Unified Pro Features Banner (if not Pro) */}
          {!canAccessAdvancedMetrics && proBannerOpen && (
            <div className="relative overflow-hidden rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-amber-900/20 p-6">
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="text-sm font-semibold text-amber-100">Unlock Pro Features</h3>
                      <p className="text-xs text-amber-200/70 mt-1">Premium analytics and AI-powered insights</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setProBannerOpen(false)}
                    className="text-amber-200/60 hover:text-amber-100 transition-colors p-1"
                    aria-label="Minimize banner"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-medium text-amber-100 mb-2 uppercase tracking-wider">Advanced Analytics</p>
                    <ul className="text-xs text-amber-100/80 space-y-1">
                      <li>✓ Advanced performance metrics (Sharpe, Sortino, Drawdown)</li>
                      <li>✓ 52-week P&amp;L heatmap</li>
                      <li>✓ Dimensional analysis by strategy, sector, timeframe</li>
                      <li>✓ Time-based analysis &amp; monthly/quarterly reports</li>
                      <li>✓ Trade similarity matching</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-100 mb-2 uppercase tracking-wider">AI-Powered Tools</p>
                    <ul className="text-xs text-amber-100/80 space-y-1">
                      <li>✓ AI trade grading (A-F with setup scores)</li>
                      <li>✓ AI setup validation before entering</li>
                      <li>✓ Weekly AI digest &amp; pattern analysis</li>
                      <li>✓ Open trade analysis &amp; recommendations</li>
                      <li>✓ Custom strategy library</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/pricing')}
                  className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-semibold text-sm px-4 py-2 rounded transition-colors"
                >
                  View Pricing & Upgrade
                </button>
              </div>
            </div>
          )}

          {/* Minimized Pro Features Button */}
          {!canAccessAdvancedMetrics && !proBannerOpen && (
            <button
              onClick={() => setProBannerOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 hover:bg-amber-950/40 px-4 py-3 transition-colors"
            >
              <Lock className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-100">Pro Features</span>
              <ChevronDown className="w-4 h-4 text-amber-200/60" />
            </button>
          )}

          {/* Collapsible Advanced Metrics */}
          {canAccessAdvancedMetrics && (
            <div className="border border-border rounded-lg">
              <button
                onClick={() => setAdvancedMetricsOpen(!advancedMetricsOpen)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Advanced Metrics</span>
                {advancedMetricsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {advancedMetricsOpen && (
                <div className="px-4 py-4 grid grid-cols-2 xl:grid-cols-3 gap-4 border-t border-border bg-muted/20">
                {advancedCards.map(({ label, value, sub, icon: Icon, color }) => (
                  <UITooltip key={label}>
                    <TooltipTrigger asChild>
                      <div className="stat-card cursor-help">
                        <div className="flex items-center justify-between">
                          <span className="stat-label">{label}</span>
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <span className={`stat-value ${color}`}>{value}</span>
                        <span className="text-xs text-muted-foreground font-mono">{sub}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      {label === 'Expectancy' && tooltips.expectancy}
                      {label === 'Avg Loss' && tooltips.avgLoss}
                      {label === 'Win Hold Time' && tooltips.winHoldTime}
                      {label === 'Loss Hold Time' && tooltips.lossHoldTime}
                      {label === 'Daily Volume' && tooltips.dailyVolume}
                      {label === 'Avg Size' && tooltips.avgSize}
                      {label === 'Sharpe Ratio' && tooltips.sharpeRatio}
                      {label === 'Sortino Ratio' && tooltips.sortinoRatio}
                      {label === 'Max Drawdown' && tooltips.maxDrawdown}
                      {label === 'Recovery Factor' && tooltips.recoveryFactor}
                      {label === 'Max Consec. Wins' && tooltips.maxConsecWins}
                      {label === 'Max Consec. Losses' && tooltips.maxConsecLosses}
                    </TooltipContent>
                  </UITooltip>
                ))}
              </div>
            )}
            </div>
          )}

          {/* AI Insights card */}
          {closedTrades.length >= 5 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    AI Insights
                  </span>
                  {(digestResult || lastDigest) && (
                    <span className="text-xs text-muted-foreground font-mono">(last {closedTrades.length} trades)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunDigest}
                    disabled={digestLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 text-xs text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {digestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {digestResult || lastDigest ? 'Refresh' : 'Run Digest'}
                  </button>
                  {(digestResult || lastDigest) && (
                    <button onClick={() => setDigestOpen(v => !v)} className="p-1 text-muted-foreground hover:text-foreground">
                      {digestOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {digestError && (
                <div className="px-4 py-3 text-sm text-destructive bg-destructive/5">
                  {digestError} — <button onClick={clearDigestError} className="underline">dismiss</button>
                </div>
              )}

              {(digestResult || lastDigest) && digestOpen && (
                <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-[#00d4a1] uppercase tracking-wider mb-2">
                      What's Working
                    </p>
                    {(digestResult?.positive_patterns || lastDigest?.positive_patterns || []).map((p: any, i: number) => (
                      <div key={i} className="mb-2">
                        <p className="text-sm font-medium">{p.pattern}</p>
                        <p className="text-xs text-muted-foreground">{p.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#ff4d6d] uppercase tracking-wider mb-2">
                      Areas to Fix
                    </p>
                    {(digestResult?.negative_patterns || lastDigest?.negative_patterns || []).map((p: any, i: number) => (
                      <div key={i} className="mb-2">
                        <p className="text-sm font-medium">{p.pattern}</p>
                        <p className="text-xs text-muted-foreground">{p.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="xl:col-span-2 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      This Week's Lesson
                    </p>
                    <p className="text-sm text-foreground/90 leading-relaxed">
                      {digestResult?.actionable_lesson || lastDigest?.actionable_lesson}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Cumulative P&L */}
            <div className="xl:col-span-2 rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                Cumulative P&L
              </p>
              {pnlCurve.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={pnlCurve}>
                    <defs>
                      <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00d4a1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00d4a1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'hsl(215 20% 50%)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(215 20% 50%)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(222 47% 8%)',
                        border: '1px solid hsl(222 47% 14%)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: 'hsl(210 40% 96%)',
                      }}
                      labelStyle={{ color: 'hsl(210 40% 96%)' }}
                      itemStyle={{ color: 'hsl(210 40% 96%)' }}
                      formatter={(v: number) => [fmt.currency(v), 'Cumulative P&L']}
                    />
                    <Area
                      type="monotone"
                      dataKey="pnl"
                      stroke="#00d4a1"
                      strokeWidth={2}
                      fill="url(#pnlGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  Need 2+ closed trades to render chart
                </div>
              )}
            </div>

            {/* Daily P&L bars */}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                Daily P&L (30d)
              </p>
              {dailyPnl.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={dailyPnl} barSize={6}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: 'hsl(215 20% 50%)' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(222 47% 8%)',
                        border: '1px solid hsl(222 47% 14%)',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: 'hsl(210 40% 96%)',
                      }}
                      labelStyle={{ color: 'hsl(210 40% 96%)' }}
                      itemStyle={{ color: 'hsl(210 40% 96%)' }}
                      formatter={(v: number) => [fmt.currency(v), 'P&L']}
                    />
                    <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                      {dailyPnl.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.pnl >= 0 ? '#00d4a1' : '#ff4d6d'}
                          fillOpacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                  No closed trades
                </div>
              )}
            </div>
          </div>

          {/* P&L Activity Heatmap */}
          {canAccessHeatmap && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                P&L Activity — Past 52 Weeks
              </p>
              <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex gap-[2px] sm:gap-[3px] min-w-max pb-1">
                  {heatmapData.weeks.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[2px] sm:gap-[3px]">
                      {week.map((day) => (
                        <div
                          key={day.date}
                          title={
                            day.pnl != null && day.pnl !== 0
                              ? `${day.date}: ${day.pnl >= 0 ? '+' : ''}${fmt.currency(day.pnl)}`
                              : day.date
                          }
                          className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm cursor-default"
                          style={heatmapCellStyle(day.pnl, heatmapData.maxPnl)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Less</span>
                {[0.15, 0.38, 0.62, 1.0].map((a, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm"
                    style={{ backgroundColor: `rgba(0, 212, 161, ${a})` }}
                  />
                ))}
                <span className="text-xs text-muted-foreground mr-2">Profit</span>
                {[0.15, 0.38, 0.62, 1.0].map((a, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm"
                    style={{ backgroundColor: `rgba(255, 77, 109, ${a})` }}
                  />
                ))}
                <span className="text-xs text-muted-foreground">Loss</span>
              </div>
            </div>
          )}

          {/* Performance breakdown */}
          {(strategyChartData.length > 0 || assetTypeData.length > 0) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* By Strategy */}
              {strategyChartData.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                    P&L by Strategy
                  </p>
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(160, strategyChartData.length * 34)}
                  >
                    <BarChart
                      data={strategyChartData}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: 'hsl(215 20% 50%)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={compactCurrency}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'hsl(210 40% 80%)' }}
                        tickLine={false}
                        axisLine={false}
                        width={112}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(222 47% 8%)',
                          border: '1px solid hsl(222 47% 14%)',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: 'hsl(210 40% 96%)',
                        }}
                        labelStyle={{ color: 'hsl(210 40% 96%)' }}
                        itemStyle={{ color: 'hsl(210 40% 96%)' }}
                        formatter={(v: number, _name, props) => [
                          `${fmt.currency(v)} · ${props.payload.count} trades · ${props.payload.winRate}% WR`,
                          'P&L',
                        ]}
                      />
                      <Bar dataKey="pnl" radius={[0, 3, 3, 0]}>
                        {strategyChartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.pnl >= 0 ? '#00d4a1' : '#ff4d6d'}
                            fillOpacity={0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* By Asset Type */}
              {assetTypeData.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                    P&L by Asset Type
                  </p>
                  <div className="space-y-4">
                    {assetTypeData.map(({ type, label, count, pnl, barWidth }) => (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium">{label}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground font-mono">
                              {count} trade{count !== 1 ? 's' : ''}
                            </span>
                            <span
                              className={`text-sm font-mono font-medium ${
                                pnl >= 0 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]'
                              }`}
                            >
                              {pnl >= 0 ? '+' : ''}
                              {fmt.currency(pnl)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: pnl >= 0 ? '#00d4a1' : '#ff4d6d',
                              opacity: 0.75,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Dimensional Analysis */}
          {canAccessDimensionalAnalysis && (
            <div className="border border-border rounded-lg">
              <button
                onClick={() => setDimensionalOpen(!dimensionalOpen)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dimensional Analysis</span>
                {dimensionalOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {dimensionalOpen && (
                <div className="px-4 py-4 grid grid-cols-1 xl:grid-cols-2 gap-4 border-t border-border bg-muted/20">
                  <DimensionCard title="Win Rate by Strategy" data={stats.by_strategy} labelMap={STRATEGY_TAG_LABELS} />
                  <DimensionCard title="Win Rate by Sector" data={stats.by_sector} />
                  <DimensionCard title="Win Rate by Timeframe" data={stats.by_timeframe} labelMap={TIMEFRAME_LABELS} />
                  <DimensionCard title="Win Rate by Duration" data={stats.by_duration} labelMap={DURATION_LABELS} />
                  <DimensionCard title="Win Rate by Market Condition" data={stats.by_market_condition} labelMap={MARKET_CONDITION_LABELS} />
                </div>
              )}
            </div>
          )}

          {/* Collapsible Time-Based Analysis */}
          {canAccessTimeAnalysis && (
            <div className="border border-border rounded-lg">
              <button
                onClick={() => setTimeBasedOpen(!timeBasedOpen)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Time-Based Analysis</span>
                {timeBasedOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {timeBasedOpen && (
                <div className="px-4 py-4 grid grid-cols-1 xl:grid-cols-2 gap-4 border-t border-border bg-muted/20">

                  {/* Monthly P&L — full-width BarChart */}
                  {monthlyData.length > 0 && (
                    <div className="xl:col-span-2 rounded-lg border border-border bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Monthly P&L</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={monthlyData} barSize={24}>
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(215 20% 50%)' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(215 20% 50%)' }} tickLine={false} axisLine={false} tickFormatter={compactCurrency} />
                          <Tooltip
                            contentStyle={{ background: 'hsl(222 47% 8%)', border: '1px solid hsl(222 47% 14%)', borderRadius: '6px', fontSize: '12px', color: 'hsl(210 40% 96%)' }}
                            labelStyle={{ color: 'hsl(210 40% 96%)' }}
                            itemStyle={{ color: 'hsl(210 40% 96%)' }}
                            formatter={(v: number, _n, props) => [
                              `${fmt.currency(v)} · ${props.payload.count} trades · ${props.payload.winRate}% WR`, 'P&L'
                            ]}
                          />
                          <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                            {monthlyData.map((entry, i) => (
                              <Cell key={i} fill={entry.pnl >= 0 ? '#00d4a1' : '#ff4d6d'} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Weekly P&L — full-width BarChart */}
                  {weeklyData.length > 0 && (
                    <div className="xl:col-span-2 rounded-lg border border-border bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Weekly P&L</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={weeklyData} barSize={16}>
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(215 20% 50%)' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: 'hsl(215 20% 50%)' }} tickLine={false} axisLine={false} tickFormatter={compactCurrency} />
                          <Tooltip
                            contentStyle={{ background: 'hsl(222 47% 8%)', border: '1px solid hsl(222 47% 14%)', borderRadius: '6px', fontSize: '12px', color: 'hsl(210 40% 96%)' }}
                            labelStyle={{ color: 'hsl(210 40% 96%)' }}
                            itemStyle={{ color: 'hsl(210 40% 96%)' }}
                            formatter={(v: number, _n, props) => [
                              `${fmt.currency(v)} · ${props.payload.count} trades · ${props.payload.winRate}% WR`, 'P&L'
                            ]}
                          />
                          <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                            {weeklyData.map((entry, i) => (
                              <Cell key={i} fill={entry.pnl >= 0 ? '#00d4a1' : '#ff4d6d'} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Quarterly Summary */}
                  {quarterlyData.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Quarterly Summary</p>
                      <div className="space-y-3">
                        {quarterlyData.slice().reverse().map(({ label, pnl, count, winRate }) => (
                          <div key={label}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{label}</span>
                              <div className="flex items-center gap-3 text-xs font-mono">
                                <span className={winRate >= 50 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]'}>{winRate}% WR</span>
                                <span className="text-muted-foreground">{count}t</span>
                                <span className={pnl >= 0 ? 'text-[#00d4a1]' : 'text-[#ff4d6d]'}>{pnl >= 0 ? '+' : ''}{fmt.currency(pnl)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${winRate}%`, backgroundColor: winRate >= 50 ? '#00d4a1' : '#ff4d6d', opacity: 0.75 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <DimensionCard title="Trade Duration Impact" data={stats.by_duration_impact} labelMap={DURATION_IMPACT_LABELS} />
                  <DimensionCard title="Time of Day" data={stats.by_time_of_day} labelMap={TIME_OF_DAY_LABELS} />

                </div>
              )}
            </div>
          )}

          {/* Collapsible Advanced Analysis */}
          <div className="border border-border rounded-lg">
            <button
              onClick={() => setAdvancedAnalysisOpen(!advancedAnalysisOpen)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/40 transition-colors"
            >
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Advanced Analysis</span>
              {advancedAnalysisOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {advancedAnalysisOpen && (
              <div className="px-4 py-4 space-y-4 border-t border-border bg-muted/20">
                {/* Emotional State & Execution Quality */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <DimensionCard title="Win Rate by Emotional State" data={stats.by_emotional_state} labelMap={EMOTIONAL_STATE_LABELS} />
                  <DimensionCard title="Win Rate by Execution Quality" data={stats.by_execution_quality} labelMap={EXECUTION_QUALITY_LABELS} />
                </div>

                {/* Drawdown Analysis with Tooltip */}
                {drawdownAnalysis.length > 0 && (
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <div className="rounded-lg border border-border bg-card p-4 cursor-help">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Drawdown Analysis — Severity Timeline</p>
                        <div className="space-y-2">
                          {drawdownAnalysis.slice().reverse().map((period, i) => (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-mono">{period.date}</span>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground font-mono">{fmt.currency(period.depth)}</span>
                                  <span className="text-muted-foreground">{Math.round(period.severity)}%</span>
                                </div>
                              </div>
                              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(period.severity, 100)}%`, backgroundColor: '#ff4d6d', opacity: 0.7 }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      {tooltips.drawdownAnalysis}
                    </TooltipContent>
                  </UITooltip>
                )}

                {/* Correlation Analysis with Tooltips */}
                {(correlationAnalysis.strategyCorrelations.length > 0 || correlationAnalysis.assetCorrelations.length > 0) && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {correlationAnalysis.strategyCorrelations.length > 0 && (
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <div className="rounded-lg border border-border bg-card p-4 cursor-help">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Strategy Correlation with Returns</p>
                            <div className="space-y-2">
                              {correlationAnalysis.strategyCorrelations.sort((a, b) => b.correlation - a.correlation).slice(0, 6).map((item) => (
                                <div key={item.label}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs">{STRATEGY_TAG_LABELS[item.label] ?? item.label}</span>
                                    <span className="text-xs font-mono" style={{ color: item.correlation >= 0 ? '#00d4a1' : '#ff4d6d' }}>
                                      {(item.correlation * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(Math.abs(item.correlation) * 100, 100)}%`, backgroundColor: item.correlation >= 0 ? '#00d4a1' : '#ff4d6d', opacity: 0.75 }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {tooltips.strategyCorrelation}
                        </TooltipContent>
                      </UITooltip>
                    )}

                    {correlationAnalysis.assetCorrelations.length > 0 && (
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <div className="rounded-lg border border-border bg-card p-4 cursor-help">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Asset Type Correlation with Returns</p>
                            <div className="space-y-2">
                              {correlationAnalysis.assetCorrelations.sort((a, b) => b.correlation - a.correlation).map((item) => (
                                <div key={item.label}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs capitalize">{item.label}</span>
                                    <span className="text-xs font-mono" style={{ color: item.correlation >= 0 ? '#00d4a1' : '#ff4d6d' }}>
                                      {(item.correlation * 100).toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(Math.abs(item.correlation) * 100, 100)}%`, backgroundColor: item.correlation >= 0 ? '#00d4a1' : '#ff4d6d', opacity: 0.75 }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          {tooltips.assetCorrelation}
                        </TooltipContent>
                      </UITooltip>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Trade Similarity Matching */}
          {tradeSimilarityMatches.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Trade Similarity Matching — Similar Trades Found</p>
              <div className="space-y-3">
                {tradeSimilarityMatches.map((match, i) => (
                  <div key={i} className="pb-3 border-b border-border/40 last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{match.trade1.ticker}</span>
                        <span className="text-xs text-muted-foreground">↔</span>
                        <span className="font-mono text-sm font-medium">{match.trade2.ticker}</span>
                      </div>
                      <div className="text-xs font-mono font-medium" style={{ color: match.similarity >= 80 ? '#00d4a1' : match.similarity >= 70 ? '#f0b429' : '#ff4d6d' }}>
                        {match.similarity.toFixed(0)}% match
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {match.trade1.strategy_tags.join(', ')} • {fmt.date(match.trade1.entry_date)} — P&L: {fmt.currency(match.trade1.net_pnl)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {match.trade2.strategy_tags.join(', ')} • {fmt.date(match.trade2.entry_date)} — P&L: {fmt.currency(match.trade2.net_pnl)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent trades */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Recent Trades
              </p>
              <button
                onClick={() => navigate('/trades')}
                className="text-xs text-primary hover:underline"
              >
                View all →
              </button>
            </div>
            <div>
              {recentTrades.map((trade) => (
                <TradeRow
                  key={trade.id}
                  trade={trade}
                  onClick={() => navigate(`/trades/${trade.id}`)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
    </TooltipProvider>
  )
}
