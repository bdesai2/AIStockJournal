import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Target,
  Activity,
  Award,
  AlertTriangle,
  PlusCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { aggregateStats, fmt, STRATEGY_TAG_LABELS } from '@/lib/tradeUtils'
import { TradeRow } from '@/components/trades/TradeRow'
import type { CSSProperties } from 'react'

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

// ── Component ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { trades, loading, fetchTrades } = useTradeStore()

  useEffect(() => {
    if (user?.id) fetchTrades(user.id)
  }, [user?.id, fetchTrades])

  const stats = useMemo(() => aggregateStats(trades), [trades])

  // Cumulative P&L curve
  const pnlCurve = useMemo(() => {
    const closed = trades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime())

    let cumulative = 0
    return closed.map((t) => {
      cumulative += t.net_pnl ?? 0
      return { date: fmt.date(t.exit_date), pnl: cumulative, ticker: t.ticker }
    })
  }, [trades])

  // Daily P&L bars (last 30 days)
  const dailyPnl = useMemo(() => {
    const map = new Map<string, number>()
    trades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .forEach((t) => {
        const day = t.exit_date!.slice(0, 10)
        map.set(day, (map.get(day) ?? 0) + (t.net_pnl ?? 0))
      })
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, pnl]) => ({ date: date.slice(5), pnl }))
  }, [trades])

  // 52-week P&L activity heatmap
  const heatmapData = useMemo(() => {
    const map = new Map<string, number>()
    trades
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
  }, [trades])

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

  return (
    <div className="p-6 space-y-6 animate-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
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
            {statCards.map(({ label, value, sub, icon: Icon, color, glow }) => (
              <div key={label} className={`stat-card ${glow}`}>
                <div className="flex items-center justify-between">
                  <span className="stat-label">{label}</span>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <span className={`stat-value ${color}`}>{value}</span>
                <span className="text-xs text-muted-foreground font-mono">{sub}</span>
              </div>
            ))}
          </div>

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
                      }}
                      labelStyle={{ color: 'hsl(210 40% 96%)' }}
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
                      }}
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
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              P&L Activity — Past 52 Weeks
            </p>
            <div className="overflow-x-auto">
              <div className="flex gap-[3px] min-w-max pb-1">
                {heatmapData.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((day) => (
                      <div
                        key={day.date}
                        title={
                          day.pnl != null && day.pnl !== 0
                            ? `${day.date}: ${day.pnl >= 0 ? '+' : ''}${fmt.currency(day.pnl)}`
                            : day.date
                        }
                        className="w-3 h-3 rounded-sm cursor-default"
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
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: `rgba(0, 212, 161, ${a})` }}
                />
              ))}
              <span className="text-xs text-muted-foreground mr-2">Profit</span>
              {[0.15, 0.38, 0.62, 1.0].map((a, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: `rgba(255, 77, 109, ${a})` }}
                />
              ))}
              <span className="text-xs text-muted-foreground">Loss</span>
            </div>
          </div>

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
                        }}
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
  )
}
