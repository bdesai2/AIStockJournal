import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit2, Trash2, ArrowUpRight, ArrowDownRight,
  TrendingUp, TrendingDown, Calendar, Tag, Brain, Image, Sparkles, Loader2,
} from 'lucide-react'
import { ExecutionsCard } from '@/components/trades/ExecutionsCard'
import { useAuthStore } from '@/store/authStore'
import { useTradeStore } from '@/store/tradeStore'
import { useAiStore } from '@/store/aiStore'
import { fmt, pnlColor, STRATEGY_TAG_LABELS, calcBuyAmount, calcSellAmount, calcPnlPercent, calcUnrealizedPnl, calcUnrealizedPercent } from '@/lib/tradeUtils'
import { cn } from '@/lib/utils'

function DetailRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-border/50 last:border-0 gap-4">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className={cn('text-sm font-mono text-right', valueClass)}>{value}</span>
    </div>
  )
}

function Card({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export function TradeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { trades, fetchTrades, deleteTrade, setSelectedTrade } = useTradeStore()
  const { gradeTrade, gradeLoading, gradeError, clearGradeError } = useAiStore()
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)

  useEffect(() => {
    if (user?.id && trades.length === 0) fetchTrades(user.id)
  }, [user?.id])

  const trade = trades.find((t) => t.id === id)

  useEffect(() => {
    if (trade) setSelectedTrade(trade)
    return () => setSelectedTrade(null)
  }, [trade])

  // Fetch current price for unrealized P&L (non-crypto only)
  useEffect(() => {
    if (!trade || trade.asset_type === 'crypto') return

    const controller = new AbortController()

    ;(async () => {
      try {
        const res = await fetch(`/api/yahoo/quote/${encodeURIComponent(trade.ticker)}`, {
          signal: controller.signal,
        })
        if (!res.ok) return
        const json: { price?: number | null } = await res.json()
        if (typeof json.price === 'number') {
          setCurrentPrice(json.price)
        }
      } catch {
        // Silent failure; unrealized metrics just won't show
      }
    })()

    return () => controller.abort()
  }, [trade?.ticker, trade?.asset_type])

  if (!trade) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Trade not found.</p>
        <button onClick={() => navigate('/trades')} className="text-primary text-sm mt-2 hover:underline">
          ← Back to trades
        </button>
      </div>
    )
  }

  const handleDelete = async () => {
    if (!window.confirm(`Delete trade ${trade.ticker}? This cannot be undone.`)) return
    const ok = await deleteTrade(trade.id)
    if (ok) navigate('/trades')
  }

  const isProfit = (trade.net_pnl ?? 0) >= 0
  const buyAmount = calcBuyAmount(trade)
  const sellAmount = calcSellAmount(trade)
  const pnlPercent = calcPnlPercent(trade)
  const hasOpenPosition = trade.status !== 'closed' && (trade.quantity ?? 0) > 0
  const unrealizedPnl = hasOpenPosition ? calcUnrealizedPnl(trade, currentPrice) : null
  const unrealizedPercent = hasOpenPosition ? calcUnrealizedPercent(trade, currentPrice) : null

  let tradeLengthLabel: string | null = null
  if (trade.status === 'closed' && trade.entry_date && trade.exit_date) {
    const start = new Date(trade.entry_date).getTime()
    const end = new Date(trade.exit_date).getTime()
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const diffMs = end - start
      const totalMinutes = diffMs / (1000 * 60)
      const totalHours = diffMs / (1000 * 60 * 60)
      const totalDays = diffMs / (1000 * 60 * 60 * 24)

      if (totalMinutes < 60) {
        const mins = Math.max(1, Math.round(totalMinutes))
        tradeLengthLabel = `${mins} minute${mins === 1 ? '' : 's'}`
      } else if (totalHours < 48) {
        const hours = Math.max(1, Math.round(totalHours))
        tradeLengthLabel = `${hours} hour${hours === 1 ? '' : 's'}`
      } else {
        const days = Math.max(1, Math.round(totalDays))
        tradeLengthLabel = `${days} day${days === 1 ? '' : 's'}`
      }
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 animate-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/trades')}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-display text-3xl tracking-widest">{trade.ticker}</span>
              <div
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                  trade.direction === 'long' ? 'bg-profit-muted text-[#00d4a1]' : 'bg-loss-muted text-[#ff4d6d]'
                )}
              >
                {trade.direction === 'long' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {trade.direction.toUpperCase()}
              </div>
              <span className="text-xs font-mono px-2 py-1 bg-accent rounded uppercase text-muted-foreground">
                {trade.asset_type}
              </span>
              <span className={cn(
                'text-xs font-mono px-2 py-1 rounded',
                trade.status === 'open' ? 'bg-[#f0b429]/10 text-[#f0b429]' :
                trade.status === 'closed' ? 'bg-accent text-muted-foreground' :
                'bg-blue-400/10 text-blue-400'
              )}>
                {trade.status.toUpperCase()}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">{fmt.dateTime(trade.entry_date)}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {trade.status === 'closed' && (
            <button
              onClick={() => gradeTrade(trade)}
              disabled={gradeLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-primary/40 text-sm text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {gradeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {trade.ai_grade ? 'Re-Grade' : 'Grade Trade'}
            </button>
          )}
          <button
            onClick={() => navigate(`/trades/${id}/edit`)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-destructive/30 text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* P&L hero */}
      {trade.net_pnl != null && (
        <div className={cn(
          'rounded-lg border p-5 flex items-center gap-6',
          isProfit ? 'border-[#00d4a1]/20 bg-profit-muted' : 'border-[#ff4d6d]/20 bg-loss-muted'
        )}>
          {isProfit ? <TrendingUp className="w-8 h-8 text-[#00d4a1]" /> : <TrendingDown className="w-8 h-8 text-[#ff4d6d]" />}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Net P&L</p>
            <p className={cn('text-4xl font-mono font-bold', pnlColor(trade.net_pnl))}>
              {fmt.currency(trade.net_pnl)}
            </p>
          </div>
          <div className="ml-6 pl-6 border-l border-border">
            <p className="text-xs text-muted-foreground mb-1">Return</p>
            <p className={cn('text-2xl font-mono font-semibold', pnlColor(trade.net_pnl))}>
              {fmt.percent(pnlPercent ?? null)}
            </p>
          </div>
          {trade.r_multiple != null && (
            <div className="ml-6 pl-6 border-l border-border">
              <p className="text-xs text-muted-foreground mb-1">R-Multiple</p>
              <p className={cn('text-2xl font-mono font-semibold', pnlColor(trade.r_multiple))}>
                {fmt.rMultiple(trade.r_multiple)}
              </p>
            </div>
          )}
          {trade.ai_grade && (
            <div className="ml-auto">
              <p className="text-xs text-muted-foreground mb-1 text-right">AI Grade</p>
              <div className={cn('grade-badge w-12 h-12 text-lg',
                trade.ai_grade.startsWith('A') ? 'bg-profit-muted text-[#00d4a1] border border-[#00d4a1]/30' :
                trade.ai_grade.startsWith('B') ? 'bg-blue-400/10 text-blue-400 border border-blue-400/30' :
                'bg-[#f0b429]/10 text-[#f0b429] border border-[#f0b429]/30'
              )}>
                {trade.ai_grade}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grade error */}
      {gradeError && (
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <span>{gradeError}</span>
          <button onClick={clearGradeError} className="ml-2 text-xs hover:underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Trade details */}
        <Card title="Trade Details" icon={TrendingUp}>
          <DetailRow label="Entry Price" value={fmt.currency(trade.entry_price, 4)} />
          {trade.exit_price != null && <DetailRow label="Exit Price" value={fmt.currency(trade.exit_price, 4)} />}
          <DetailRow label="Quantity" value={fmt.number(trade.quantity, 0)} />
          {buyAmount != null && (
            <DetailRow label="Buy Amount" value={fmt.currency(buyAmount)} />
          )}
          {sellAmount != null && (
            <DetailRow label="Sell Amount" value={fmt.currency(sellAmount)} />
          )}
          {hasOpenPosition && currentPrice != null && (
            <DetailRow label="Current Price" value={fmt.currency(currentPrice, 4)} />
          )}
          {hasOpenPosition && unrealizedPnl != null && (
            <DetailRow
              label="Unrealized P&L"
              value={fmt.currency(unrealizedPnl)}
              valueClass={pnlColor(unrealizedPnl)}
            />
          )}
          {hasOpenPosition && unrealizedPercent != null && (
            <DetailRow
              label="Unrealized %"
              value={fmt.percent(unrealizedPercent)}
              valueClass={pnlColor(unrealizedPnl ?? 0)}
            />
          )}
          {trade.fees != null && <DetailRow label="Fees" value={fmt.currency(trade.fees)} />}
          {trade.gross_pnl != null && <DetailRow label="Gross P&L" value={fmt.currency(trade.gross_pnl)} valueClass={pnlColor(trade.gross_pnl)} />}
          {trade.stop_loss != null && <DetailRow label="Stop Loss" value={fmt.currency(trade.stop_loss, 4)} valueClass="text-[#ff4d6d]" />}
          {trade.take_profit != null && <DetailRow label="Take Profit" value={fmt.currency(trade.take_profit, 4)} valueClass="text-[#00d4a1]" />}
          {trade.initial_risk != null && <DetailRow label="Initial Risk" value={fmt.currency(trade.initial_risk)} />}
          {trade.risk_percent != null && <DetailRow label="Risk %" value={`${trade.risk_percent.toFixed(2)}%`} />}
          {tradeLengthLabel && <DetailRow label="Trade Length" value={tradeLengthLabel} />}
          {trade.holding_period_days != null && <DetailRow label="Holding Period" value={`${trade.holding_period_days.toFixed(1)} days`} />}
        </Card>

        {/* Categorization */}
        <Card title="Categorization" icon={Tag}>
          {trade.timeframe && <DetailRow label="Timeframe" value={trade.timeframe} />}
          {trade.market_conditions && <DetailRow label="Market Conditions" value={trade.market_conditions.replace('_', ' ')} />}
          {trade.sector && <DetailRow label="Sector" value={trade.sector} />}
          {trade.emotional_state && <DetailRow label="Emotional State" value={trade.emotional_state} />}
          {trade.execution_quality != null && (
            <DetailRow
              label="Execution Quality"
              value={
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className={cn(
                        'w-4 h-4 rounded-sm',
                        n <= (trade.execution_quality ?? 0) ? 'bg-primary' : 'bg-border'
                      )}
                    />
                  ))}
                </div>
              }
            />
          )}
          {trade.strategy_tags?.length > 0 && (
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-2">Strategy Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {trade.strategy_tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded font-medium"
                  >
                    {STRATEGY_TAG_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Option Legs */}
        {trade.asset_type === 'option' && trade.option_legs && trade.option_legs.length > 0 && (
          <Card title="Option Legs" icon={TrendingUp}>
            {trade.option_strategy && (
              <p className="text-sm font-medium mb-3">{trade.option_strategy}</p>
            )}
            {trade.option_legs.map((leg, i) => (
              <div key={i} className="rounded border border-border/50 p-3 mb-2 last:mb-0 bg-accent/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded',
                    leg.action === 'buy' ? 'bg-profit-muted text-[#00d4a1]' : 'bg-loss-muted text-[#ff4d6d]'
                  )}>
                    {leg.action.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono">
                    {leg.contracts}× {leg.option_type.toUpperCase()} ${leg.strike} exp {leg.expiration}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground font-mono">
                  <span>Premium: ${leg.premium}</span>
                  {leg.delta != null && <span>Δ {leg.delta}</span>}
                  {leg.iv != null && <span>IV {leg.iv}%</span>}
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* Journal */}
        {(trade.setup_notes || trade.entry_notes || trade.exit_notes || trade.mistakes || trade.lessons) && (
          <Card title="Journal Notes" icon={Calendar}>
            {[
              { label: 'Setup / Thesis', val: trade.setup_notes },
              { label: 'Entry Notes', val: trade.entry_notes },
              { label: 'Exit Notes', val: trade.exit_notes },
              { label: 'Mistakes', val: trade.mistakes },
              { label: 'Lessons Learned', val: trade.lessons },
            ].map(({ label, val }) =>
              val ? (
                <div key={label} className="mb-4 last:mb-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{val}</p>
                </div>
              ) : null
            )}
          </Card>
        )}

        {/* AI Analysis */}
        {(trade.ai_grade || trade.ai_grade_rationale) && (
          <Card title="AI Analysis" icon={Brain}>
            {trade.ai_setup_score != null && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-muted-foreground">Setup Score</span>
                <div className={cn('px-2 py-0.5 rounded text-xs font-mono font-bold',
                  trade.ai_setup_score >= 75 ? 'bg-profit-muted text-[#00d4a1]' :
                  trade.ai_setup_score >= 50 ? 'bg-blue-400/10 text-blue-400' :
                  'bg-[#f0b429]/10 text-[#f0b429]'
                )}>
                  {trade.ai_setup_score}/100
                </div>
                {trade.ai_analyzed_at && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {fmt.date(trade.ai_analyzed_at)}
                  </span>
                )}
              </div>
            )}
            {trade.ai_grade_rationale && (
              <p className="text-sm text-foreground/80 leading-relaxed mb-3">{trade.ai_grade_rationale}</p>
            )}
            {trade.ai_suggestions && trade.ai_suggestions.length > 0 && (
              <ul className="space-y-1.5">
                {trade.ai_suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-primary mt-0.5">→</span>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      {/* Executions */}
      <ExecutionsCard trade={trade} />

      {/* Screenshots */}
      {trade.screenshots && trade.screenshots.length > 0 && (
        <Card title="Charts & Screenshots" icon={Image}>
          <div className="flex flex-wrap gap-3">
            {trade.screenshots.map((s) => (
              <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer">
                <img
                  src={s.url}
                  alt={s.label ?? 'screenshot'}
                  className="w-40 h-28 object-cover rounded-md border border-border hover:border-primary/50 transition-colors"
                />
                {s.label && <p className="text-xs text-muted-foreground mt-1">{s.label}</p>}
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
