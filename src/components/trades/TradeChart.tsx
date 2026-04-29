import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  CrosshairMode,
  LineStyle,
} from 'lightweight-charts'
import type { Trade } from '@/types'
import { ArrowUpRight, ArrowDownRight, ExternalLink, Loader2, AlertCircle } from 'lucide-react'

interface TradeChartProps {
  trade: Trade
  apiKey?: string
}

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CandleResponse {
  candles?: Candle[]
  error?: string
}

function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'Etc/UTC'
  }
}

function getBaseApiUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || ''
}

async function fetchCandles(
  ticker: string,
  from: number,
  to: number,
  resolution: string
): Promise<Candle[]> {
  const baseUrl = getBaseApiUrl()
  const url = `${baseUrl}/api/yahoo/candles/${encodeURIComponent(ticker)}?from=${from}&to=${to}&resolution=${resolution}`

  const res = await fetch(url)
  let payload: CandleResponse = {}
  try {
    payload = await res.json()
  } catch {
    payload = {}
  }

  if (!res.ok) {
    throw new Error(payload.error || `Price API request failed (${res.status})`)
  }

  return Array.isArray(payload.candles) ? payload.candles : []
}

/** Select resolution + lookback based on trade duration */
function getResolutionConfig(trade: Trade): { resolution: string; lookbackDays: number; label: string } {
  const hasScalp = trade.strategy_tags?.some(t => t.toLowerCase().includes('scalp'))

  // Use entry and exit to determine actual trade length
  const entryMs = new Date(trade.entry_date).getTime()
  const exitMs = trade.exit_date ? new Date(trade.exit_date).getTime() : entryMs
  const durationHours = (exitMs - entryMs) / (1000 * 60 * 60)

  if (hasScalp || durationHours < 2) {
    return { resolution: '5', lookbackDays: 1, label: '5-min' }
  }
  if (durationHours < 24) {
    return { resolution: '15', lookbackDays: 2, label: '15-min' }
  }
  if (durationHours < 168) {
    return { resolution: '60', lookbackDays: 7, label: '1-hour' }
  }
  return { resolution: 'D', lookbackDays: 90, label: 'Daily' }
}

export function TradeChart({ trade }: TradeChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [candleCount, setCandleCount] = useState(0)

  const isLong = trade.direction === 'long'
  const userTimezone = getUserTimezone()
  const { resolution, lookbackDays, label } = getResolutionConfig(trade)
  const [resolvedLabel, setResolvedLabel] = useState('')

  useEffect(() => {
    setResolvedLabel(label)
  }, [label])

  useEffect(() => {
    if (!chartContainerRef.current) return

    // â”€â”€ Create chart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: 'hsl(215 20% 65%)',
        fontFamily: 'monospace',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.2)', style: LineStyle.Dashed },
        horzLine: { color: 'rgba(255,255,255,0.2)', style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    })
    chartRef.current = chart

    // â”€â”€ Candlestick series â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00d4a1',
      downColor: '#ff4d6d',
      borderUpColor: '#00d4a1',
      borderDownColor: '#ff4d6d',
      wickUpColor: '#00d4a1',
      wickDownColor: '#ff4d6d',
    })
    seriesRef.current = series

    // â”€â”€ Resize observer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry && chartRef.current) {
        chartRef.current.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })
    resizeObserver.observe(chartContainerRef.current)

    // â”€â”€ Fetch candles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const entryTs = Math.floor(new Date(trade.entry_date).getTime() / 1000)
    const exitTs = trade.exit_date
      ? Math.floor(new Date(trade.exit_date).getTime() / 1000)
      : entryTs

    const fromTs = entryTs - lookbackDays * 24 * 60 * 60
    // Show at least 1 lookback-period after exit so context is visible
    const toTs = exitTs + lookbackDays * 24 * 60 * 60

    const ticker = trade.asset_type === 'option'
      ? trade.ticker.replace(/\d{6}[CP]\d+/, '') // strip option suffix if any
      : trade.ticker

    const fallbackFromTs = entryTs - 365 * 24 * 60 * 60
    const nowTs = Math.floor(Date.now() / 1000)
    const attempts: Array<{ resolution: string; from: number; to: number; label: string }> = [
      { resolution, from: fromTs, to: toTs, label },
    ]

    if (resolution !== '60') {
      attempts.push({
        resolution: '60',
        from: entryTs - 14 * 24 * 60 * 60,
        to: Math.max(toTs, nowTs),
        label: '1-hour',
      })
    }

    if (resolution !== 'D') {
      attempts.push({
        resolution: 'D',
        from: fallbackFromTs,
        to: Math.max(toTs, nowTs),
        label: 'Daily',
      })
    }

    const run = async () => {
      try {
        let candles: Candle[] = []
        let usedLabel = label
        let lastApiError: string | null = null

        for (const attempt of attempts) {
          try {
            const result = await fetchCandles(ticker, attempt.from, attempt.to, attempt.resolution)
            if (result.length > 0) {
              candles = result
              usedLabel = attempt.label
              break
            }
          } catch (err) {
            lastApiError = err instanceof Error ? err.message : 'Failed to fetch candles'
          }
        }

        if (!candles?.length) {
          setError(lastApiError || 'No price history available for this ticker/timeframe.')
          setLoading(false)
          return
        }

        setResolvedLabel(usedLabel)

        // lightweight-charts v5 expects { time (unix seconds), open, high, low, close }
        const data = candles.map(c => ({
          time: c.time as unknown as import('lightweight-charts').Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))

        series.setData(data)
        setCandleCount(data.length)

        // â”€â”€ Entry marker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Snap to the closest candle time at or after entry
        const entryCandle = candles.reduce((best, c) =>
          Math.abs(c.time - entryTs) < Math.abs(best.time - entryTs) ? c : best
        )
        const exitCandle = trade.exit_date
          ? candles.reduce((best, c) =>
              Math.abs(c.time - exitTs) < Math.abs(best.time - exitTs) ? c : best
            )
          : null

        const markers: import('lightweight-charts').SeriesMarker<import('lightweight-charts').Time>[] = [
          {
            time: entryCandle.time as unknown as import('lightweight-charts').Time,
            position: isLong ? 'belowBar' : 'aboveBar',
            color: '#00d4a1',
            shape: isLong ? 'arrowUp' : 'arrowDown',
            text: `Entry $${trade.entry_price.toFixed(2)}`,
            size: 2,
          },
        ]

        if (exitCandle && trade.exit_price != null) {
          markers.push({
            time: exitCandle.time as unknown as import('lightweight-charts').Time,
            position: isLong ? 'aboveBar' : 'belowBar',
            color: '#ff4d6d',
            shape: isLong ? 'arrowDown' : 'arrowUp',
            text: `Exit $${trade.exit_price.toFixed(2)}`,
            size: 2,
          })
        }

        createSeriesMarkers(series, markers)

        // â”€â”€ Entry price line â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        series.createPriceLine({
          price: trade.entry_price,
          color: 'rgba(0, 212, 161, 0.5)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: 'Entry',
        })

        if (trade.exit_price != null) {
          series.createPriceLine({
            price: trade.exit_price,
            color: 'rgba(255, 77, 109, 0.5)',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'Exit',
          })
        }

        // â”€â”€ Fit view to trade window + some context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        chart.timeScale().fitContent()
        setLoading(false)
      } catch (err) {
        console.warn('[TradeChart] Fetch error:', err)
        const message = err instanceof Error ? err.message : 'Failed to load chart data.'
        setError(message)
        setLoading(false)
      }
    }

    run()

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade.id])

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/60">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Price Action â€” {trade.ticker}
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
            {resolvedLabel}
          </span>
          <span className="hidden sm:inline text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
            {userTimezone}
          </span>
        </div>

        {/* Entry/Exit price summary */}
        <div className="flex items-center gap-4 text-xs">
          <div>
            <p className="text-muted-foreground">Entry</p>
            <p className="font-mono font-semibold text-[#00d4a1]">${trade.entry_price.toFixed(2)}</p>
          </div>
          {trade.exit_price != null && (
            <>
              <div className="w-px h-8 bg-border/50" />
              <div>
                <p className="text-muted-foreground">Exit</p>
                <p className="font-mono font-semibold text-[#ff4d6d]">${trade.exit_price.toFixed(2)}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className="relative h-[280px] sm:h-[400px] md:h-[500px]">
        {/* Lightweight chart canvas */}
        <div ref={chartContainerRef} className="absolute inset-0" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loading price historyâ€¦</p>
            </div>
          </div>
        )}

        {/* Error state â€” falls back to TradingView link */}
        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/90 z-10 p-4 text-center">
            <AlertCircle className="w-6 h-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{error}</p>
            <a
              href={`https://www.tradingview.com/chart/?symbol=${trade.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/40 hover:border-primary/70 rounded-md px-3 py-1.5 transition-colors"
            >
              Open in TradingView <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Footer */}
      {!loading && !error && (
        <div className="px-4 py-2 text-[10px] text-muted-foreground bg-muted/20 border-t border-border/50 flex justify-between items-center">
          <span>
            {candleCount} candles Â·{' '}
            <span className="text-foreground font-mono">{resolvedLabel}</span> Â·{' '}
            Duration:{' '}
            <span className="font-mono text-foreground">
              {trade.exit_date
                ? Math.round((new Date(trade.exit_date).getTime() - new Date(trade.entry_date).getTime()) / (1000 * 60)) + ' min'
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
      )}
    </div>
  )
}
