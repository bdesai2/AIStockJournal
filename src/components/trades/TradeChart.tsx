import type { Trade } from '@/types'
import { ArrowUpRight, ArrowDownRight, ExternalLink } from 'lucide-react'

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
 * Calculate chart range based on interval
 * 5-min (scalp): 1 day before entry
 * 1-hour: 2 days before entry
 */
function getChartLookback(interval: string): number {
  // 5-minute charts: show 1 day before
  if (interval === '5') {
    return 1
  }
  // 1-hour and others: show 2 days before
  return 2
}

export function TradeChart({ trade }: TradeChartProps) {
  const interval = getChartInterval(trade)
  const tradeTypeLabel = getTradeTypeLabel(trade)
  const isLong = trade.direction === 'long'
  const userTimezone = getUserTimezone()
  const lookbackDays = getChartLookback(interval)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/60">
        <div className="flex flex-wrap items-center gap-2">
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
          <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
            {userTimezone}
          </span>
        </div>

        {/* Entry/Exit price indicator */}
        <div className="flex items-center gap-4 text-xs">
          <div>
            <p className="text-muted-foreground">Entry</p>
            <p className="font-mono font-semibold text-green-400">${trade.entry_price.toFixed(2)}</p>
          </div>
          {trade.exit_price && (
            <>
              <div className="w-px h-8 bg-border/50" />
              <div>
                <p className="text-muted-foreground">Exit</p>
                <p className={`font-mono font-semibold ${isLong ? 'text-red-400' : 'text-green-400'}`}>
                  ${trade.exit_price.toFixed(2)}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative overflow-hidden h-[280px] sm:h-[400px] md:h-[500px]">
        <iframe
          src={`https://www.tradingview.com/widgetembed/?symbol=${trade.ticker}&interval=${interval}&timezone=${encodeURIComponent(userTimezone)}&theme=dark&style=1&locale=en&hide_side_toolbar=1&allow_symbol_change=0&container_id=tradingview_${trade.id}`}
          title={`${trade.ticker} Chart`}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="clipboard-read; clipboard-write"
        />

        {/* Trade annotation overlay */}
        <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 p-3 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isLong ? 'bg-green-400' : 'bg-red-400'}`}
            />
            <span className="text-muted-foreground">
              {isLong ? 'Long Position' : 'Short Position'}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground space-y-1 border-t border-white/10 pt-2">
            <div>Entry: {new Date(trade.entry_date).toLocaleDateString()} {new Date(trade.entry_date).toLocaleTimeString()}</div>
            {trade.exit_date && (
              <div>Exit: {new Date(trade.exit_date).toLocaleDateString()} {new Date(trade.exit_date).toLocaleTimeString()}</div>
            )}
          </div>
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
