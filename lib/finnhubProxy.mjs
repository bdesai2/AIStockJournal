/**
 * Stock Data Proxy Routes
 * Fetches real-time quote data using Finnhub API
 *
 * Requires FINNHUB_API_KEY in .env (get free key at https://finnhub.io)
 * Rate limit: 60 calls/min on free tier, no credit card needed
 * These endpoints gracefully degrade on failure to avoid breaking the app.
 */

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY

if (!FINNHUB_API_KEY) {
  console.warn('⚠️  FINNHUB_API_KEY not set in .env. Stock price lookups will be unavailable.')
}

function mapResolutionToYahooInterval(resolution) {
  if (resolution === '1') return '1m'
  if (resolution === '5') return '5m'
  if (resolution === '15') return '15m'
  if (resolution === '30') return '30m'
  if (resolution === '60') return '60m'
  if (resolution === 'D') return '1d'
  if (resolution === 'W') return '1wk'
  if (resolution === 'M') return '1mo'
  return '1d'
}

async function fetchYahooCandles(ticker, from, to, resolution = 'D') {
  try {
    const interval = mapResolutionToYahooInterval(String(resolution))
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${from}&period2=${to}&interval=${interval}&includePrePost=false&events=div%2Csplits`
    const response = await fetch(url)

    if (!response.ok) {
      return []
    }

    const json = await response.json()
    const result = json?.chart?.result?.[0]
    const timestamps = result?.timestamp
    const quote = result?.indicators?.quote?.[0]

    if (!Array.isArray(timestamps) || !quote) {
      return []
    }

    const candles = []
    for (let i = 0; i < timestamps.length; i += 1) {
      const time = timestamps[i]
      const open = quote.open?.[i]
      const high = quote.high?.[i]
      const low = quote.low?.[i]
      const close = quote.close?.[i]
      const volume = quote.volume?.[i] ?? 0

      // Skip partial/null bars
      if ([time, open, high, low, close].some((v) => v == null)) continue

      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume,
      })
    }

    return candles
  } catch {
    return []
  }
}

/**
 * Register stock data proxy routes on Express app
 * @param {object} app - Express application instance
 */
export function registerFinnhubProxyRoutes(app) {
  /**
   * GET /api/yahoo/quote/:ticker
   * Fetch current market price for a ticker using Finnhub
   * Returns: { price: number | null }
   * Note: Returns null on any failure to gracefully degrade
   */
  app.get('/api/yahoo/quote/:ticker', async (req, res) => {
    const ticker = (req.params.ticker || '').toUpperCase()

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' })
    }

    res.setHeader('Access-Control-Allow-Origin', '*')

    if (!FINNHUB_API_KEY) {
      console.warn('⚠️  FINNHUB_API_KEY not configured')
      return res.json({ price: null })
    }

    try {
      const finnhubUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`

      const response = await fetch(finnhubUrl)

      if (!response.ok) {
        console.warn(`Finnhub quote ${response.status}:`, ticker, response.statusText)
        return res.json({ price: null })
      }

      const json = await response.json()
      // Finnhub returns 'c' for current price
      const price = json?.c ?? null

      res.json({ price })
    } catch (err) {
      console.warn('⚠️  Finnhub quote error:', ticker, err.message)
      res.json({ price: null })
    }
  })

  /**
   * GET /api/yahoo/candles/:ticker?from=<unix>&to=<unix>&resolution=<str>
   * Fetch OHLCV candle data for a ticker using Finnhub
   * resolution: 1, 5, 15, 30, 60, D, W, M
   * Returns: { candles: Array<{ time, open, high, low, close, volume }> } | { candles: [] } on error
   */
  app.get('/api/yahoo/candles/:ticker', async (req, res) => {
    const ticker = (req.params.ticker || '').toUpperCase()
    const { from, to, resolution = '5' } = req.query

    if (!ticker || !from || !to) {
      return res.status(400).json({ error: 'ticker, from, and to are required' })
    }

    res.setHeader('Access-Control-Allow-Origin', '*')

    try {
      let candles = []

      // Primary source: Finnhub (when key is configured)
      if (FINNHUB_API_KEY) {
        const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
        const response = await fetch(url)

        if (response.ok) {
          const json = await response.json()
          // Finnhub returns { s: 'ok'|'no_data', t, o, h, l, c, v }
          if (json.s === 'ok' && Array.isArray(json.t) && json.t.length > 0) {
            candles = json.t.map((time, i) => ({
              time,
              open: json.o[i],
              high: json.h[i],
              low: json.l[i],
              close: json.c[i],
              volume: json.v[i],
            }))
          }
        } else {
          console.warn(`Finnhub candles ${response.status}:`, ticker)
        }
      }

      // Fallback source: Yahoo chart endpoint (no API key required)
      if (!candles.length) {
        candles = await fetchYahooCandles(ticker, from, to, resolution)
      }

      res.json({ candles })
    } catch (err) {
      console.warn('⚠️  Candle fetch error:', ticker, err.message)
      res.json({ candles: [] })
    }
  })

  /**
   * GET /api/yahoo/sector/:ticker
   * Fetch company profile for a ticker using Finnhub
   * Returns: { sector: string | null }
   * Note: Returns null on any failure to gracefully degrade
   */
  app.get('/api/yahoo/sector/:ticker', async (req, res) => {
    const ticker = (req.params.ticker || '').toUpperCase()

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' })
    }

    res.setHeader('Access-Control-Allow-Origin', '*')

    if (!FINNHUB_API_KEY) {
      console.warn('⚠️  FINNHUB_API_KEY not configured')
      return res.json({ sector: null })
    }

    try {
      const finnhubUrl = `https://finnhub.io/api/v1/company-profile2?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_API_KEY}`

      const response = await fetch(finnhubUrl)

      if (!response.ok) {
        console.warn(`Finnhub profile ${response.status}:`, ticker, response.statusText)
        return res.json({ sector: null })
      }

      const json = await response.json()
      const sector = json?.finnhubIndustry ?? null

      res.json({ sector })
    } catch (err) {
      console.warn('⚠️  Finnhub profile error:', ticker, err.message)
      res.json({ sector: null })
    }
  })
}
