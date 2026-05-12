import { useMemo, useState } from 'react'
import { Loader2, Sparkles, Target } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ProOnlyBanner } from '@/components/premium/LockedFeature'
import { UpgradeModal } from '@/components/premium/UpgradeModal'
import { useCanAccess } from '@/lib/featureGates'
import { aiApi, type GenerateSetupsResult } from '@/lib/ai'
import { useAuthStore } from '@/store/authStore'

function toList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
}

export function SetupGeneratorPage() {
  const navigate = useNavigate()
  const { subscription } = useAuthStore()
  const canUseFeature = useCanAccess('POTENTIAL_TRADE_EVALUATION', subscription?.tier)

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GenerateSetupsResult | null>(null)

  const [marketBias, setMarketBias] = useState<'bullish' | 'bearish' | 'neutral'>('neutral')
  const [timeframe, setTimeframe] = useState<'intraday' | 'swing' | 'position'>('swing')
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced')
  const [maxSetups, setMaxSetups] = useState(5)
  const [watchlistText, setWatchlistText] = useState('AAPL, MSFT, NVDA, TSLA, AMZN')
  const [sectorsText, setSectorsText] = useState('Technology, Semiconductors')
  const [notes, setNotes] = useState('Prefer liquid large caps and clean trend continuation setups.')

  const watchlistPreview = useMemo(() => toList(watchlistText), [watchlistText])

  const handleGenerate = async () => {
    if (!canUseFeature) {
      setShowUpgradeModal(true)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await aiApi.generateSetups({
        market_bias: marketBias,
        timeframe,
        risk_profile: riskProfile,
        focus_sectors: toList(sectorsText),
        watchlist: toList(watchlistText),
        max_setups: maxSetups,
        notes,
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate setups')
    } finally {
      setLoading(false)
    }
  }

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
          <p className="text-sm text-muted-foreground">Generate high-conviction ideas with clear entry, stop, and target levels.</p>
          <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
            Beta notice: A+ Setups is currently in beta testing and generated results may not be accurate. Do not use these setups as financial advice.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {result ? 'Regenerate Setups' : 'Generate Setups'}
        </button>
      </div>

      {!canUseFeature && (
        <ProOnlyBanner
          featureName="A+ Setup Generator"
          onUpgradeClick={() => setShowUpgradeModal(true)}
        />
      )}

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

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <p>{error}</p>
        </div>
      )}

      {result && (
        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-display tracking-wider">MARKET CONTEXT</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-6">{result.market_context}</p>
            {result.risk_notes.length > 0 && (
              <ul className="mt-3 space-y-1">
                {result.risk_notes.map((note, idx) => (
                  <li key={idx} className="text-xs text-[#f0b429]">- {note}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Generated {new Date(result.generated_at).toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {result.setups.map((setup) => (
              <div key={`${setup.symbol}-${setup.entry}`} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold tracking-wide">{setup.symbol}</span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{setup.setup_grade}</span>
                  </div>
                  <span className="text-xs capitalize text-muted-foreground">{setup.direction} · {setup.timeframe}</span>
                </div>

                <p className="text-sm text-muted-foreground leading-6">{setup.thesis}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded border border-border/70 bg-background/40 p-3">
                    <p className="text-xs text-muted-foreground">Entry</p>
                    <p className="mt-1 font-mono text-sm">${setup.entry.toFixed(2)}</p>
                  </div>
                  <div className="rounded border border-border/70 bg-background/40 p-3">
                    <p className="text-xs text-muted-foreground">Stop</p>
                    <p className="mt-1 font-mono text-sm text-[#ff4d6d]">${setup.stop.toFixed(2)}</p>
                  </div>
                  <div className="rounded border border-border/70 bg-background/40 p-3">
                    <p className="text-xs text-muted-foreground">Target 1</p>
                    <p className="mt-1 font-mono text-sm text-[#00d4a1]">${setup.target_1.toFixed(2)}</p>
                  </div>
                  <div className="rounded border border-border/70 bg-background/40 p-3">
                    <p className="text-xs text-muted-foreground">Target 2</p>
                    <p className="mt-1 font-mono text-sm text-[#00d4a1]">{setup.target_2 != null ? `$${setup.target_2.toFixed(2)}` : 'N/A'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border border-border/70 bg-background/40 p-2">
                    <p className="text-[11px] text-muted-foreground">R/R</p>
                    <p className="text-sm font-semibold">{setup.risk_reward.toFixed(2)}</p>
                  </div>
                  <div className="rounded border border-border/70 bg-background/40 p-2">
                    <p className="text-[11px] text-muted-foreground">Confidence</p>
                    <p className="text-sm capitalize">{setup.confidence}</p>
                  </div>
                  <div className="rounded border border-border/70 bg-background/40 p-2">
                    <p className="text-[11px] text-muted-foreground">Catalyst</p>
                    <p className="text-sm truncate" title={setup.catalyst}>{setup.catalyst}</p>
                  </div>
                </div>

                <div className="rounded border border-border/70 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Invalidation</p>
                  <p className="mt-1 text-sm">{setup.invalidation}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2">
          <Target className="h-4 w-4" />
          <span>Setups are informational and not financial advice.</span>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={() => navigate('/pricing')}
        featureKey="POTENTIAL_TRADE_EVALUATION"
      />
    </div>
  )
}
