import { Fragment, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, Loader2, RefreshCw, Target, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useAiStore } from '@/store/aiStore'
import { useTradeStore } from '@/store/tradeStore'
import { supabase } from '@/lib/supabase'
import type { OpenTradeAnalysisSnapshot, Trade } from '@/types'

interface AnalysisResponse {
  portfolio_health: string
  health_summary: string
  per_trade_scorecard: Array<{
    idx: number
    ticker: string
    asset_type?: string
    entry: number
    current: number | null
    pnl_percent: number | null
    grade: string | null
    urgent_action: string | null
  }>
  major_risks: string[]
  best_performers: Array<{ ticker: string; pnl: number; reason: string }>
  worst_performers: Array<{ ticker: string; pnl: number; reason: string }>
  recommendations: string[]
}

interface PersistedOpenPositionAnalysis {
  signature: string
  generated_at: string
  analysis: AnalysisResponse
}

function buildOpenTradesSignature(openTrades: Trade[]): string {
  return [...openTrades]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((t) => [
      t.id,
      t.status,
      t.ticker,
      t.asset_type,
      t.direction,
      t.entry_date,
      String(t.entry_price),
      String(t.quantity),
      String(t.stop_loss ?? ''),
      String(t.take_profit ?? ''),
      String(t.option_type ?? ''),
      JSON.stringify(t.option_legs ?? []),
      String(t.option_strategy ?? ''),
    ].join('|'))
    .join('||')
}

function healthBadgeColor(health: string): string {
  switch (health.toLowerCase()) {
    case 'concerning':
      return 'text-red-500 bg-red-50 border-red-200'
    case 'weakening':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'stable':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'improving':
      return 'text-teal-600 bg-teal-50 border-teal-200'
    case 'strong':
      return 'text-green-600 bg-green-50 border-green-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

function healthIcon(health: string) {
  switch (health.toLowerCase()) {
    case 'concerning':
    case 'weakening':
      return <AlertCircle className="w-5 h-5" />
    case 'improving':
      return <TrendingUp className="w-5 h-5" />
    case 'strong':
      return <Zap className="w-5 h-5" />
    case 'stable':
    default:
      return <Target className="w-5 h-5" />
  }
}

function gradeClass(grade: string): string {
  if (grade.startsWith('A')) return 'text-[#00d4a1]'
  if (grade.startsWith('B')) return 'text-blue-400'
  if (grade.startsWith('C')) return 'text-[#f0b429]'
  return 'text-[#ff4d6d]'
}

function pnlClass(value: number): string {
  if (value > 0) return 'text-[#00d4a1]'
  if (value < 0) return 'text-[#ff4d6d]'
  return 'text-muted-foreground'
}

function formatMoney(value: number): string {
  return `$${value.toFixed(2)}`
}

function toDisplayDate(value?: string): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function OpenPositionsDashboardPage() {
  const navigate = useNavigate()
  const { user, selectedAccountId } = useAuthStore()
  const { trades, fetchTrades } = useTradeStore()
  const { analyzeOpenTrade } = useAiStore()
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [openTrades, setOpenTrades] = useState<Trade[]>([])
  const [expandedTradeIds, setExpandedTradeIds] = useState<string[]>([])
  const [expandedTradeLoadingIds, setExpandedTradeLoadingIds] = useState<string[]>([])
  const [expandedTradeErrors, setExpandedTradeErrors] = useState<Record<string, string>>({})
  const [expandedTradeAnalysisById, setExpandedTradeAnalysisById] = useState<Record<string, OpenTradeAnalysisSnapshot>>({})

  const openTradesSignature = useMemo(() => buildOpenTradesSignature(openTrades), [openTrades])

  // Fetch trades on mount
  useEffect(() => {
    if (user?.id && selectedAccountId) {
      fetchTrades(user.id, selectedAccountId)
    }
  }, [user?.id, selectedAccountId, fetchTrades])

  // Keep local open-trades state synced with trade store
  useEffect(() => {
    const filtered = (trades ?? []).filter((t) => t.status === 'open')
    setOpenTrades(filtered)
  }, [trades])

  useEffect(() => {
    const persistedAnalysis = Object.fromEntries(
      openTrades
        .filter((trade) => trade.open_trade_analysis)
        .map((trade) => [trade.id, trade.open_trade_analysis as OpenTradeAnalysisSnapshot])
    )

    setExpandedTradeAnalysisById((prev) => ({
      ...prev,
      ...persistedAnalysis,
    }))
  }, [openTrades])

  // Load persisted analysis for the current open-trades snapshot.
  // Analysis refresh is manual and only triggered by button click.
  useEffect(() => {
    if (!user?.id || !selectedAccountId) {
      setAnalysis(null)
      setCachedAt(null)
      return
    }

    let cancelled = false

    const loadPersistedAnalysis = async () => {
      const { data, error } = await supabase
        .from('open_position_analyses')
        .select('signature, generated_at, analysis')
        .eq('user_id', user.id)
        .eq('account_id', selectedAccountId)
        .maybeSingle<PersistedOpenPositionAnalysis>()

      if (cancelled) return

      if (error) {
        console.error('Failed to load open positions analysis:', error)
        setAnalysis(null)
        setCachedAt(null)
        return
      }

      if (!data) {
        setAnalysis(null)
        setCachedAt(null)
        return
      }

      if (data.signature === openTradesSignature) {
        setAnalysis(data.analysis)
        setCachedAt(data.generated_at)
      } else {
        setAnalysis(null)
        setCachedAt(null)
      }
    }

    void loadPersistedAnalysis()

    return () => {
      cancelled = true
    }
  }, [user?.id, selectedAccountId, openTradesSignature])

  // Fetch AI analysis
  const fetchAnalysis = async (openTradesArr: Trade[]) => {
    if (!user?.id || !selectedAccountId) return

    setLoading(true)
    setError(null)
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      if (authError || !session?.access_token) {
        setError('Not authenticated')
        return
      }

      const response = await fetch('/api/ai/analyze-open-trades', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          open_trades: openTradesArr,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to analyze trades')
      }

      const data: AnalysisResponse = await response.json()
      setAnalysis(data)

      const signature = buildOpenTradesSignature(openTradesArr)
      const generatedAt = new Date().toISOString()

      const { error: persistError } = await supabase
        .from('open_position_analyses')
        .upsert({
          user_id: user.id,
          account_id: selectedAccountId,
          signature,
          generated_at: generatedAt,
          analysis: data,
          updated_at: generatedAt,
        }, {
          onConflict: 'user_id,account_id',
        })

      if (persistError) {
        console.error('Failed to persist open positions analysis:', persistError)
      }

      const cachePayload: PersistedOpenPositionAnalysis = {
        signature,
        generated_at: generatedAt,
        analysis: data,
      }
      setCachedAt(cachePayload.generated_at)
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze portfolio')
    } finally {
      setLoading(false)
    }
  }

  // Summary cards
  const portfolioStats = {
    totalPositions: openTrades.length,
    cachedStatus: analysis ? 'ready' : 'empty',
  }

  const openTradesByTicker = useMemo(() => {
    const map = new Map<string, Trade[]>()
    for (const trade of openTrades) {
      const arr = map.get(trade.ticker) ?? []
      arr.push(trade)
      map.set(trade.ticker, arr)
    }
    return map
  }, [openTrades])

  const ensureExpandedTradeAnalysis = async (trade: Trade) => {
    if (trade.open_trade_analysis || expandedTradeAnalysisById[trade.id]) return

    setExpandedTradeLoadingIds((prev) => (prev.includes(trade.id) ? prev : [...prev, trade.id]))
    setExpandedTradeErrors((prev) => {
      const next = { ...prev }
      delete next[trade.id]
      return next
    })

    const result = await analyzeOpenTrade(trade)

    if (result) {
      setExpandedTradeAnalysisById((prev) => ({
        ...prev,
        [trade.id]: result,
      }))
    } else {
      setExpandedTradeErrors((prev) => ({
        ...prev,
        [trade.id]: `Failed to load AI analysis for ${trade.ticker}.`,
      }))
    }

    setExpandedTradeLoadingIds((prev) => prev.filter((id) => id !== trade.id))
  }

  return (
    <div className="p-6 space-y-6 animate-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-display tracking-wider">OPEN POSITIONS</h1>
          <p className="text-sm text-muted-foreground">Review active trades first, then refresh AI portfolio analysis on demand.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAnalysis(openTrades)}
            disabled={loading || openTrades.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {analysis ? 'Refresh Analysis' : 'Generate Analysis'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Active Positions</p>
          <p className="mt-2 text-3xl font-semibold">{portfolioStats.totalPositions}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Analysis Status</p>
          <p className="mt-2 text-sm font-medium capitalize">{portfolioStats.cachedStatus}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {cachedAt ? `Saved ${new Date(cachedAt).toLocaleString()}` : 'No saved analysis for current positions'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Portfolio Status</p>
          {analysis && (
            <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${healthBadgeColor(analysis.portfolio_health)}`}>
              {healthIcon(analysis.portfolio_health)}
              <span className="capitalize">{analysis.portfolio_health}</span>
            </div>
          )}
          {!analysis && <p className="mt-2 text-sm text-muted-foreground">Run analysis to populate status.</p>}
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-display tracking-wider">OPEN TRADES</h2>
          <p className="text-xs text-muted-foreground">These positions are displayed before AI analysis so you can validate context first.</p>
          <div className="mt-3 rounded-md border border-[#f0b429]/40 bg-[#f0b429]/10 px-3 py-2 text-xs leading-relaxed text-[#f8d07a]">
            <p>
              Disclaimer: This app does not provide stock trading advice. It offers best-effort recommendations based on current market context.
              Markets can change at any minute, and you should make your own decisions without fully relying on AI output.
              Displayed prices may be historical and may not reflect real-time quotes.
              Option contract values cannot be determined with full accuracy due to factors such as volatility, time decay, liquidity, and spreads.
            </p>
          </div>
        </div>

        {openTrades.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">No open trades found.</p>
            <button
              onClick={() => navigate('/trades/new')}
              className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Create New Trade
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Entry</th>
                  <th className="px-4 py-3">Current</th>
                  <th className="px-4 py-3">P&amp;L %</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Next Suggested Step</th>
                </tr>
              </thead>
              <tbody>
                {openTrades.map((trade, i) => {
                  const score = analysis?.per_trade_scorecard?.find((row) => row.ticker === trade.ticker && row.idx === i + 1)
                  const savedAnalysis = expandedTradeAnalysisById[trade.id] ?? trade.open_trade_analysis as OpenTradeAnalysisSnapshot | undefined
                  const isOption = trade.asset_type === 'option'
                  const entry = score?.entry ?? trade.entry_price
                  const current = score?.current ?? null
                  const pnlPercent = score?.pnl_percent ?? null
                  const grade = score?.grade ?? null
                  const urgentAction = score?.urgent_action ?? null
                  const linkedTrade = (openTradesByTicker.get(trade.ticker) ?? [trade])[0]
                  const isExpanded = expandedTradeIds.includes(trade.id)
                  const isExpandedLoading = expandedTradeLoadingIds.includes(trade.id)
                  const expandedTradeError = expandedTradeErrors[trade.id]

                  const toggleExpanded = () => {
                    const nextIsExpanded = !isExpanded

                    setExpandedTradeIds((prev) => (
                      nextIsExpanded ? [...prev, trade.id] : prev.filter((id) => id !== trade.id)
                    ))

                    if (nextIsExpanded && !savedAnalysis) {
                      void ensureExpandedTradeAnalysis(trade)
                    }
                  }

                  return (
                    <Fragment key={trade.id}>
                      <tr
                        className="cursor-pointer border-b border-border/70 hover:bg-accent/30"
                        onClick={toggleExpanded}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleExpanded()
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-expanded={isExpanded}
                      >
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          <div className="inline-flex items-center gap-1">
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <span>{i + 1}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/trades/${linkedTrade.id}`)
                            }}
                            className="font-semibold tracking-wide text-foreground hover:text-primary"
                          >
                            {trade.ticker.toUpperCase()}
                          </button>
                          {trade.asset_type && (
                            <div className="text-xs text-muted-foreground capitalize mt-0.5">{trade.asset_type}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono">${entry.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono">
                          {isOption ? <span className="text-muted-foreground">—</span> : current != null ? `$${current.toFixed(2)}` : '—'}
                        </td>
                        <td className={`px-4 py-3 font-mono font-semibold ${pnlPercent != null ? pnlClass(pnlPercent) : 'text-muted-foreground'}`}>
                          {isOption || pnlPercent == null ? <span className="text-muted-foreground">—</span> : `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%`}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${grade ? gradeClass(grade) : 'text-muted-foreground'}`}>
                          {isOption || !grade ? <span className="text-muted-foreground">—</span> : grade}
                        </td>
                        <td className="px-4 py-3 text-foreground/90">
                          {isOption || !urgentAction ? <span className="text-muted-foreground">—</span> : urgentAction}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-b border-border/70 bg-accent/10">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="space-y-3 rounded-md border border-border/70 bg-card p-4">
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-display tracking-wider">TRADE AI ANALYSIS</h3>
                                {trade.open_trade_analyzed_at && (
                                  <p className="text-xs text-muted-foreground">Saved {toDisplayDate(trade.open_trade_analyzed_at)}</p>
                                )}
                              </div>

                              {isExpandedLoading && !savedAnalysis && (
                                <div className="flex items-center gap-2 rounded border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading and saving AI analysis...
                                </div>
                              )}

                              {expandedTradeError && !savedAnalysis && (
                                <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                                  <p>{expandedTradeError}</p>
                                  <button
                                    onClick={() => void ensureExpandedTradeAnalysis(trade)}
                                    className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                                  >
                                    Retry Analysis
                                  </button>
                                </div>
                              )}

                              {savedAnalysis && (
                                <>
                                  <div className="rounded border border-border/70 bg-background/40 p-3">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market Overview</p>
                                    <p className="mt-1 text-sm leading-6 text-foreground/90">{savedAnalysis.market_overview}</p>
                                  </div>

                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded border border-border/70 bg-background/40 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Price Est.</p>
                                      <p className="mt-1 text-sm font-mono text-foreground">{formatMoney(savedAnalysis.current_price_estimate)}</p>
                                    </div>
                                    <div className="rounded border border-border/70 bg-background/40 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Est. P&amp;L</p>
                                      <p className={`mt-1 text-sm font-mono ${pnlClass(savedAnalysis.estimated_pnl)}`}>
                                        {savedAnalysis.estimated_pnl >= 0 ? '+' : ''}{formatMoney(savedAnalysis.estimated_pnl)}
                                      </p>
                                    </div>
                                    <div className="rounded border border-border/70 bg-background/40 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Est. Return</p>
                                      <p className={`mt-1 text-sm font-mono ${pnlClass(savedAnalysis.estimated_pnl)}`}>
                                        {savedAnalysis.estimated_pnl_percent >= 0 ? '+' : ''}{savedAnalysis.estimated_pnl_percent.toFixed(2)}%
                                      </p>
                                    </div>
                                    <div className="rounded border border-border/70 bg-background/40 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommendation</p>
                                      <p className="mt-1 text-sm font-mono capitalize text-primary">{savedAnalysis.recommendation}</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="rounded border border-[#00d4a1]/30 bg-[#00d4a1]/10 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-[#73f2d0]">Bullish Factors</p>
                                      <ul className="mt-2 space-y-1 text-sm text-[#baf9ea]">
                                        {savedAnalysis.bullish_factors.map((factor, index) => (
                                          <li key={index} className="flex gap-2">
                                            <span>+</span>
                                            <span>{factor}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div className="rounded border border-[#ff4d6d]/30 bg-[#ff4d6d]/10 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-[#ff9bb0]">Bearish Factors</p>
                                      <ul className="mt-2 space-y-1 text-sm text-[#ffd3dd]">
                                        {savedAnalysis.bearish_factors.map((factor, index) => (
                                          <li key={index} className="flex gap-2">
                                            <span>-</span>
                                            <span>{factor}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="rounded border border-border/70 bg-background/40 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Technical Outlook</p>
                                      <p className="mt-1 text-sm leading-6 text-foreground/90">{savedAnalysis.technical_outlook}</p>
                                    </div>
                                    <div className="rounded border border-border/70 bg-background/40 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confidence / Levels</p>
                                      <p className="mt-1 text-sm text-foreground/90">Confidence: <span className="font-mono capitalize">{savedAnalysis.confidence}</span></p>
                                      <p className="mt-1 text-sm text-foreground/90">Resistance: <span className="font-mono">{formatMoney(savedAnalysis.next_key_levels.resistance)}</span></p>
                                      <p className="mt-1 text-sm text-foreground/90">Support: <span className="font-mono">{formatMoney(savedAnalysis.next_key_levels.support)}</span></p>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loading && (
        <div className="rounded-lg border border-border bg-card p-8">
          <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing open positions...
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <p>{error}</p>
          <button
            onClick={() => fetchAnalysis(openTrades)}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retry Analysis
          </button>
        </div>
      )}

      {!loading && !error && !analysis && openTrades.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Saved analysis is not available for this exact open-trade snapshot. Click Generate Analysis when you want a refresh.
        </div>
      )}

      {!loading && analysis && (
        <section className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-3 text-base font-display tracking-wider">PORTFOLIO ANALYSIS</h2>
            <p className="text-sm text-muted-foreground leading-6">{analysis.health_summary}</p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {analysis.major_risks.length > 0 && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-display tracking-wider text-red-300">
                  <AlertCircle className="w-5 h-5" />
                  Major Risks
                </h3>
                <ul className="space-y-2">
                  {analysis.major_risks.map((risk, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-red-200">
                      <span className="text-red-300">•</span>
                      <span>{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.recommendations.length > 0 && (
              <div className="rounded-lg border border-[#00d4a1]/30 bg-[#00d4a1]/10 p-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-display tracking-wider text-[#73f2d0]">
                  <Zap className="w-5 h-5" />
                  Recommendations
                </h3>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-[#baf9ea]">
                      <span className="text-[#73f2d0]">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {analysis.best_performers.length > 0 && (
              <div className="rounded-lg border border-[#00d4a1]/30 bg-[#00d4a1]/10 p-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-display tracking-wider text-[#73f2d0]">
                  <TrendingUp className="w-5 h-5" />
                  Best Performers
                </h3>
                <div className="space-y-3">
                  {analysis.best_performers.map((performer, idx) => (
                    <div key={idx} className="rounded border border-[#00d4a1]/30 bg-card p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold text-foreground">{performer.ticker}</span>
                        <span className="text-sm font-bold text-[#00d4a1]">${performer.pnl.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{performer.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.worst_performers.length > 0 && (
              <div className="rounded-lg border border-[#ff4d6d]/30 bg-[#ff4d6d]/10 p-6">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-display tracking-wider text-[#ff9bb0]">
                  <TrendingDown className="w-5 h-5" />
                  Worst Performers
                </h3>
                <div className="space-y-3">
                  {analysis.worst_performers.map((performer, idx) => (
                    <div key={idx} className="rounded border border-[#ff4d6d]/30 bg-card p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold text-foreground">{performer.ticker}</span>
                        <span className="text-sm font-bold text-[#ff4d6d]">${performer.pnl.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{performer.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
