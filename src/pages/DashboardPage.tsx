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
import { aggregateStats, fmt, pnlColor } from '@/lib/tradeUtils'
import { TradeRow } from '@/components/trades/TradeRow'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { trades, loading, fetchTrades } = useTradeStore()

  useEffect(() => {
    if (user?.id) fetchTrades(user.id)
  }, [user?.id, fetchTrades])

  const stats = useMemo(() => aggregateStats(trades), [trades])

  // Build cumulative P&L curve
  const pnlCurve = useMemo(() => {
    const closed = trades
      .filter((t) => t.status === 'closed' && t.exit_date)
      .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime())

    let cumulative = 0
    return closed.map((t) => {
      cumulative += t.net_pnl ?? 0
      return {
        date: fmt.date(t.exit_date),
        pnl: cumulative,
        trade_pnl: t.net_pnl ?? 0,
        ticker: t.ticker,
      }
    })
  }, [trades])

  // Daily P&L bar data (last 30 days)
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
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
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
          <p className="text-muted-foreground text-sm mb-4">Start logging your trades to see your performance analytics.</p>
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
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215 20% 50%)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(215 20% 50%)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(222 47% 8%)', border: '1px solid hsl(222 47% 14%)', borderRadius: '6px', fontSize: '12px' }}
                      labelStyle={{ color: 'hsl(210 40% 96%)' }}
                      formatter={(v: number) => [fmt.currency(v), 'Cumulative P&L']}
                    />
                    <Area type="monotone" dataKey="pnl" stroke="#00d4a1" strokeWidth={2} fill="url(#pnlGrad)" />
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
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'hsl(215 20% 50%)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: 'hsl(222 47% 8%)', border: '1px solid hsl(222 47% 14%)', borderRadius: '6px', fontSize: '12px' }}
                      formatter={(v: number) => [fmt.currency(v), 'P&L']}
                    />
                    <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                      {dailyPnl.map((entry, i) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? '#00d4a1' : '#ff4d6d'} fillOpacity={0.85} />
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
                <TradeRow key={trade.id} trade={trade} onClick={() => navigate(`/trades/${trade.id}`)} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
