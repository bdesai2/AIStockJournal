import type { Trade } from '@/types'
import { ArrowUpRight, ArrowDownRight, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import { pnlColor, calcPnlPercent } from '@/lib/tradeUtils'

interface TradeChartProps {
  trade: Trade
  apiKey: string
}

/**
 * Get user's local timezone in IANA format
 * Falls back to UTC if detection fails
 */
function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'Etc/UTC'
  }
}

/**
 * Determine trade type and appropriate timeframe
 * Scalp tag: 5 min
 * All other trades: 1 hour
 */
function getChartInterval(trade: Trade): string {
  // Check if trade has 'scalp' tag
  const hasScalpTag = trade.strategy_tags?.some(tag => tag.toLowerCase().includes('scalp'))

  if (hasScalpTag) {
    return '5'
  }

  return '60' // Default to 1 hour
}

/**
 * Determine trade type label
 * Scalp tag: 5 min
 * All other trades: 1 hour
 */
function getTradeTypeLabel(trade: Trade): string {
  const hasScalpTag = trade.strategy_tags?.some(tag => tag.toLowerCase().includes('scalp'))

  if (hasScalpTag) {
    return 'Scalp Trade (5-min)'
  }

  return 'Trade (1-hour)'
}

/**
 * Estimate context window shown around entry based on chart interval.
 */
function getChartLookback(interval: string): number {
  if (interval === '5') return 1
  if (interval === '15') return 2
  if (interval === '30') return 3
  return 5
}

/**
 * Calculate P&L display values
 */
function calculatePnL(trade: Trade) {
  const pnl = trade.net_pnl ?? 0
  const pnlPct = calcPnlPercent(trade)
  const isProfit = pnl >= 0

  return { pnl, pnlPct, isProfit }
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function TradeChart({ trade }: TradeChartProps) {
  const interval = getChartInterval(trade)
  const tradeTypeLabel = getTradeTypeLabel(trade)
  const isLong = trade.direction === 'long'
  const userTimezone = getUserTimezone()
  const lookbackDays = getChartLookback(interval)
  const { pnl, pnlPct, isProfit } = calculatePnL(trade)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="space-y-2 px-4 py-3 border-b border-border/60">
        {/* Header row 1: Title + Type + Timezone */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Price Action — {trade.ticker}
          </span>
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              isLong ? 'bg-profit-muted text-[#00d4a1]' : 'bg-loss-muted text-[#ff4d6d]'
            }`}
          >
            {isLong ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {isLong ? 'LONG' : 'SHORT'}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
            {tradeTypeLabel}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
            {userTimezone}
          </span>
        </div>

        {/* Header row 2: Entry/Exit/P&L */}
        <div className="flex items-center justify-between gap-4">
          {/* Entry Price */}
          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground font-mono uppercase">Entry</p>
              <p className="font-mono font-semibold text-green-400 text-sm">
                ${trade.entry_price.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {new Date(trade.entry_date).toLocaleString()}
              </p>
            </div>

            {/* Divider */}
            <div className="h-12 w-px bg-border/50" />

            {/* Exit Price (if closed) */}
            {trade.exit_price ? (
              <div>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Exit</p>
                <p className={`font-mono font-semibold text-sm ${isLong ? 'text-red-400' : 'text-green-400'}`}>
                  ${trade.exit_price.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(trade.exit_date!).toLocaleString()}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[10px] text-muted-foreground font-mono uppercase">Status</p>
                <p className="font-mono font-semibold text-yellow-400 text-sm">OPEN</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {Math.round((Date.now() - new Date(trade.entry_date).getTime()) / (1000 * 60))} min held
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="h-12 w-px bg-border/50" />

            {/* P&L Badge */}
            <div className={`px-3 py-2 rounded-md flex flex-col ${pnlColor(pnl)}`}>
              <p className="text-[10px] font-mono uppercase text-muted-foreground">P&L</p>
              <p className="font-mono font-bold text-base">
                {isProfit ? '+' : ''}{formatCurrency(pnl)}
              </p>
              <p className="text-[10px] font-mono mt-0.5">
                {isProfit ? '+' : ''}{pnlPct?.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* Position Indicator */}
          <div className="flex items-center gap-2">
            {isLong ? (
              <TrendingUp className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-400" />
            )}
            <span className="text-xs font-semibold">
              {isLong ? 'LONG POSITION' : 'SHORT POSITION'}
            </span>
          </div>
        </div>
      </div>

      <div style={{ height: '500px', overflow: 'hidden', position: 'relative', background: '#000' }}>
        <iframe
          src={`https://www.tradingview.com/widgetembed/?symbol=${trade.ticker}&interval=${interval}&timezone=${encodeURIComponent(userTimezone)}&theme=dark&style=1&locale=en&hide_side_toolbar=0&allow_symbol_change=0&container_id=tradingview_${trade.id}`}
          title={`${trade.ticker} Chart`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="clipboard-read; clipboard-write"
        />

        {/* Chart Overlay: Entry/Exit markers */}
        <div className="absolute top-4 left-4 z-10 space-y-2 pointer-events-none">
          {/* Entry Marker */}
          <div className="flex items-center gap-2 bg-green-500/20 backdrop-blur-sm border border-green-500/50 rounded px-2 py-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <div className="text-[10px] font-mono">
              <div className="text-green-400 font-semibold">ENTRY</div>
              <div className="text-green-300">${trade.entry_price.toFixed(2)}</div>
            </div>
          </div>

          {/* Exit Marker (if trade is closed) */}
          {trade.exit_price && (
            <div className={`flex items-center gap-2 backdrop-blur-sm border rounded px-2 py-1 ${
              isLong
                ? 'bg-red-500/20 border-red-500/50'
                : 'bg-green-500/20 border-green-500/50'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isLong ? 'bg-red-400' : 'bg-green-400'}`} />
              <div className="text-[10px] font-mono">
                <div className={isLong ? 'text-red-400 font-semibold' : 'text-green-400 font-semibold'}>EXIT</div>
                <div className={isLong ? 'text-red-300' : 'text-green-300'}>${trade.exit_price.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>

        {/* P&L Tag on Chart */}
        <div className={`absolute top-4 right-4 z-10 px-3 py-2 rounded-md backdrop-blur-sm border font-mono text-sm pointer-events-none ${
          isProfit
            ? 'bg-green-500/20 border-green-500/50 text-green-300'
            : 'bg-red-500/20 border-red-500/50 text-red-300'
        }`}>
          <div className="font-semibold">{isProfit ? '+' : ''}{formatCurrency(pnl)}</div>
          <div className="text-[10px]">{isProfit ? '+' : ''}{pnlPct?.toFixed(2)}%</div>
        </div>
      </div>

      <div className="px-4 py-2 text-[10px] text-muted-foreground bg-muted/20 border-t border-border/50 flex justify-between items-center">
        <span>
          Duration: <span className="font-mono text-foreground">
            {trade.exit_date
              ? Math.round((new Date(trade.exit_date).getTime() - new Date(trade.entry_date).getTime()) / (1000 * 60)) +
                ' min'
              : 'Open'}
          </span>
        </span>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${trade.ticker}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
        >
          Open in TradingView <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="px-4 py-2 text-[10px] text-muted-foreground bg-muted/10 border-t border-border/50">
        <p>💡 <strong>Tip:</strong> Chart shows {lookbackDays} day{lookbackDays > 1 ? 's' : ''} before entry to help visualize market context. Use "Open in TradingView" to zoom and analyze specific entry point.</p>
      </div>
    </div>
  )
}
