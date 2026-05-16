import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'

function toList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

export function SetupGeneratorPage() {
  const [marketBias, setMarketBias] = useState<'bullish' | 'bearish' | 'neutral'>('neutral')
  const [timeframe, setTimeframe] = useState<'intraday' | 'swing' | 'position'>('swing')
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced')
  const [maxSetups, setMaxSetups] = useState(5)
  const [watchlistText, setWatchlistText] = useState('AAPL, MSFT, NVDA, TSLA, AMZN')
  const [sectorsText, setSectorsText] = useState('Technology, Semiconductors')
  const [notes, setNotes] = useState('Prefer liquid large caps and clean trend continuation setups.')

  const watchlistPreview = useMemo(() => toList(watchlistText), [watchlistText])

  return (
    <div className="p-6 space-y-6 animate-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display tracking-wider">A+ SETUP GENERATOR</h1>
            <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300">
              BETA
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Temporarily disabled while the setup workflow is reworked.</p>
          <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
            Beta notice: A+ Setups is temporarily unavailable. Use the manual Setup area for now.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-display tracking-wider">GENERATOR INPUTS</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Market Bias</span>
            <select
              value={marketBias}
              onChange={(e) => setMarketBias(e.target.value as 'bullish' | 'bearish' | 'neutral')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="neutral">Neutral</option>
              <option value="bullish">Bullish</option>
              <option value="bearish">Bearish</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Timeframe</span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as 'intraday' | 'swing' | 'position')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="intraday">Intraday</option>
              <option value="swing">Swing</option>
              <option value="position">Position</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Risk Profile</span>
            <select
              value={riskProfile}
              onChange={(e) => setRiskProfile(e.target.value as 'conservative' | 'balanced' | 'aggressive')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Max Setups</span>
            <input
              type="number"
              min={1}
              max={10}
              value={maxSetups}
              onChange={(e) => setMaxSetups(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Watchlist (comma-separated tickers)</span>
            <input
              type="text"
              value={watchlistText}
              onChange={(e) => setWatchlistText(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="AAPL, NVDA, MSFT"
            />
            <p className="text-xs text-muted-foreground">Detected: {watchlistPreview.join(', ') || 'none'}</p>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Focus Sectors (comma-separated)</span>
            <input
              type="text"
              value={sectorsText}
              onChange={(e) => setSectorsText(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Technology, Energy"
            />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-xs text-muted-foreground">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[84px]"
            placeholder="Add constraints such as avoid earnings this week, favor trend continuation, etc."
          />
        </label>
      </section>

      <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2">
          <Target className="h-4 w-4" />
          <span>Setups are informational and not financial advice.</span>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        This feature is currently disabled.
      </div>
    </div>
  )
}
