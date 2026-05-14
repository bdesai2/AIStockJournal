import { ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { Setup } from '@/types'
import { fmt, STRATEGY_TAG_LABELS } from '@/lib/tradeUtils'
import { cn } from '@/lib/utils'

interface Props {
  setup: Setup
  strategyName?: string
  onClick?: () => void
}

function probabilityTone(value: Setup['probability']) {
  if (value === 'high') return 'text-[#00d4a1]'
  if (value === 'low') return 'text-[#ff9f43]'
  return 'text-blue-400'
}

function outcomeTone(value: Setup['close_outcome']) {
  if (value === 'successful') return 'text-[#00d4a1]'
  if (value === 'failed') return 'text-[#ff4d6d]'
  if (value === 'cancelled') return 'text-[#f0b429]'
  return 'text-muted-foreground'
}

function OutcomeIcon({ value }: { value?: Setup['close_outcome'] }) {
  if (value === 'successful') return <CheckCircle2 className="w-3 h-3" />
  if (value === 'failed') return <XCircle className="w-3 h-3" />
  if (value === 'cancelled') return <AlertTriangle className="w-3 h-3" />
  return null
}

export function SetupRow({ setup, strategyName, onClick }: Props) {
  return (
    <div onClick={onClick} className="trade-row flex items-center gap-4 px-4 py-3 last:border-0 cursor-pointer">
      <div
        className={cn(
          'w-7 h-7 rounded flex items-center justify-center flex-shrink-0',
          setup.direction === 'long' ? 'bg-profit-muted' : 'bg-loss-muted'
        )}
      >
        {setup.direction === 'long' ? (
          <ArrowUpRight className="w-4 h-4 text-[#00d4a1]" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-[#ff4d6d]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="ticker-badge">{setup.ticker.toUpperCase()}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded uppercase bg-accent text-muted-foreground">
            {setup.direction}
          </span>
          {setup.status === 'open' ? (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f0b429]/10 text-[#f0b429] flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              OPEN
            </span>
          ) : (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent/50 flex items-center gap-1', outcomeTone(setup.close_outcome))}>
              <OutcomeIcon value={setup.close_outcome} />
              {(setup.close_outcome ?? 'closed').toUpperCase()}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {strategyName ?? 'No strategy'}
          {setup.tags && setup.tags.length > 0 && (
            <>
              {' · '}
              {setup.tags
                .slice(0, 2)
                .map((tag) => STRATEGY_TAG_LABELS[tag] ?? tag)
                .join(' · ')}
            </>
          )}
        </p>
      </div>

      <div className="hidden md:block w-56 text-right">
        <p className="text-xs font-mono text-foreground">
          {fmt.currency(setup.entry_price, 4)} → {fmt.currency(setup.take_profit, 4)} / {fmt.currency(setup.stop_loss, 4)}
        </p>
        <p className="text-xs text-muted-foreground">{fmt.date(setup.created_at)}</p>
      </div>

      <div className="w-20 text-right">
        <p className={cn('text-xs font-mono uppercase', probabilityTone(setup.probability))}>{setup.probability}</p>
        <p className="text-[10px] text-muted-foreground/60">prob</p>
      </div>
    </div>
  )
}
