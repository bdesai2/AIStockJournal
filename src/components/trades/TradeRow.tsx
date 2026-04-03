import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react'
import type { Trade } from '@/types'
import { fmt, pnlColor, calcBuyAmount, calcSellAmount, calcPnlPercent, STRATEGY_TAG_LABELS } from '@/lib/tradeUtils'
import { cn } from '@/lib/utils'

interface Props {
  trade: Trade
  onClick?: () => void
}

const ASSET_COLORS: Record<string, string> = {
  stock: 'text-blue-400 bg-blue-400/10',
  option: 'text-purple-400 bg-purple-400/10',
  etf: 'text-cyan-400 bg-cyan-400/10',
  crypto: 'text-orange-400 bg-orange-400/10',
}

export function TradeRow({ trade, onClick }: Props) {
  const buyAmount = calcBuyAmount(trade)
  const sellAmount = calcSellAmount(trade)
  const pnlPercent = calcPnlPercent(trade)

  return (
    <div
      onClick={onClick}
      className="trade-row flex items-center gap-4 px-4 py-3 last:border-0"
    >
      {/* Direction icon */}
      <div
        className={cn(
          'w-7 h-7 rounded flex items-center justify-center flex-shrink-0',
          trade.direction === 'long' ? 'bg-profit-muted' : 'bg-loss-muted'
        )}
      >
        {trade.direction === 'long' ? (
          <ArrowUpRight className="w-4 h-4 text-[#00d4a1]" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-[#ff4d6d]" />
        )}
      </div>

      {/* Ticker + asset type */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="ticker-badge">{trade.ticker.toUpperCase()}</span>
          <span
            className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded uppercase',
              ASSET_COLORS[trade.asset_type] ?? 'text-muted-foreground'
            )}
          >
            {trade.asset_type}
          </span>
          {trade.status === 'open' && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f0b429]/10 text-[#f0b429] flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              OPEN
            </span>
          )}
        </div>
        {trade.strategy_tags?.length > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {trade.strategy_tags
              .slice(0, 2)
              .map((tag) => STRATEGY_TAG_LABELS[tag] ?? tag)
              .join(' · ')}
          </p>
        )}
      </div>

      {/* Entry / Exit */}
      <div className="hidden md:block text-right">
        <p className="text-xs font-mono text-foreground">
          {fmt.currency(trade.entry_price, 4)}
          {trade.exit_price ? ` → ${fmt.currency(trade.exit_price, 4)}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">{fmt.date(trade.entry_date)}</p>
      </div>

      {/* Qty */}
      <div className="hidden lg:block w-16 text-right">
        <p className="text-xs font-mono text-muted-foreground">{fmt.number(trade.quantity, 0)}</p>
        <p className="text-[10px] text-muted-foreground/60">qty</p>
      </div>

      {/* Buy amount */}
      <div className="hidden lg:block w-28 text-right">
        <p className="text-xs font-mono text-muted-foreground">
          {buyAmount != null ? fmt.currency(buyAmount) : '—'}
        </p>
        <p className="text-[10px] text-muted-foreground/60">buy</p>
      </div>

      {/* Sell amount */}
      <div className="hidden lg:block w-28 text-right">
        <p className="text-xs font-mono text-muted-foreground">
          {sellAmount != null ? fmt.currency(sellAmount) : '—'}
        </p>
        <p className="text-[10px] text-muted-foreground/60">sell</p>
      </div>

      {/* P&L */}
      <div className="w-24 text-right">
        <p className={cn('text-sm font-mono font-medium', pnlColor(trade.net_pnl))}>
          {trade.net_pnl != null ? fmt.currency(trade.net_pnl) : '—'}
        </p>
        {pnlPercent != null && (
          <p className={cn('text-xs font-mono', pnlColor(trade.net_pnl))}>
            {fmt.percent(pnlPercent)}
          </p>
        )}
      </div>

      {/* P&L % */}
      <div className="hidden lg:block w-20 text-right">
        <p className={cn('text-xs font-mono', pnlColor(trade.net_pnl))}>
          {pnlPercent != null ? fmt.percent(pnlPercent) : '—'}
        </p>
        <p className="text-[10px] text-muted-foreground/60">P/L %</p>
      </div>

      {/* R-multiple */}
      <div className="hidden lg:block w-16 text-right">
        <p className={cn('text-xs font-mono', pnlColor(trade.r_multiple))}>
          {fmt.rMultiple(trade.r_multiple)}
        </p>
      </div>

      {/* Grade */}
      {trade.ai_grade && (
        <div
          className={cn(
            'grade-badge text-xs',
            trade.ai_grade.startsWith('A') ? 'bg-profit-muted text-[#00d4a1]' : 
            trade.ai_grade.startsWith('B') ? 'bg-blue-400/10 text-blue-400' :
            trade.ai_grade.startsWith('C') ? 'bg-[#f0b429]/10 text-[#f0b429]' :
            'bg-loss-muted text-[#ff4d6d]'
          )}
        >
          {trade.ai_grade}
        </div>
      )}
    </div>
  )
}
