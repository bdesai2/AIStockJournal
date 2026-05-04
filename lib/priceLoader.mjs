/**
 * Server-side price loader with in-memory TTL cache.
 *
 * Used by AI route handlers to enrich prompts with live stock prices
 * before sending them to Claude. All AI endpoints call this module
 * instead of calling Finnhub directly so the cache is shared across
 * every request in the same server process.
 *
 * Cache TTL: 1 hour (PRICE_CACHE_TTL_MS)
 * Fallback:  returns the best available price (stale cache → null)
 * Graceful degrade: never throws — always returns a PriceResult
 */

const PRICE_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY

if (!FINNHUB_API_KEY) {
  console.warn('[priceLoader] FINNHUB_API_KEY not set — price enrichment will return null')
}

/**
 * @typedef {{ price: number | null, source: 'live' | 'cached' | 'stale' | 'unavailable', fetchedAt: number | null }} PriceResult
 */

// Shared cache: ticker → { price, fetchedAt }
// Simple Map is fine for a single-process server
const _cache = new Map()

function isCacheValid(entry) {
  return entry && Date.now() - entry.fetchedAt < PRICE_CACHE_TTL_MS
}

function isLikelyOccOptionSymbol(symbol) {
  return /^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(String(symbol || '').toUpperCase())
}

/**
 * Fetch from Finnhub and store in cache.
 * Returns the new cache entry or null on failure.
 */
async function fetchFromFinnhub(ticker) {
  if (!FINNHUB_API_KEY) return null

  try {
    const normalized = String(ticker || '').toUpperCase()
    const symbolsToTry = isLikelyOccOptionSymbol(normalized)
      ? [normalized, `O:${normalized}`]
      : [normalized]

    for (const symbol of symbolsToTry) {
      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
      const res = await fetch(url)
      if (!res.ok) {
        console.warn(`[priceLoader] Finnhub ${res.status} for ${symbol}`)
        continue
      }
      const json = await res.json()
      const price = json?.c ?? null
      if (price === null || price === 0) continue

      const entry = { price, fetchedAt: Date.now() }
      _cache.set(normalized, entry)
      return entry
    }

    return null
  } catch (err) {
    console.warn(`[priceLoader] fetch error for ${ticker}:`, err.message)
    return null
  }
}

/**
 * Get the current price for a single ticker.
 * Order of preference: fresh cache → live Finnhub fetch → stale cache → null
 *
 * @param {string} ticker - uppercase ticker symbol
 * @returns {Promise<PriceResult>}
 */
export async function getPrice(ticker) {
  const key = ticker.toUpperCase()
  const cached = _cache.get(key)

  if (cached && isCacheValid(cached)) {
    return { price: cached.price, source: 'cached', fetchedAt: cached.fetchedAt }
  }

  // Attempt live fetch
  const fresh = await fetchFromFinnhub(key)
  if (fresh) {
    return { price: fresh.price, source: 'live', fetchedAt: fresh.fetchedAt }
  }

  // Fallback: return stale cache if any
  if (cached) {
    console.warn(`[priceLoader] Returning stale price for ${key} (age: ${Math.round((Date.now() - cached.fetchedAt) / 60000)}m)`)
    return { price: cached.price, source: 'stale', fetchedAt: cached.fetchedAt }
  }

  return { price: null, source: 'unavailable', fetchedAt: null }
}

/**
 * Batch-fetch prices for multiple tickers.
 * Returns a Map<ticker, PriceResult>.
 * Fires all requests concurrently but shares the cache,
 * so duplicate tickers only hit Finnhub once.
 *
 * @param {string[]} tickers
 * @returns {Promise<Map<string, PriceResult>>}
 */
export async function getPrices(tickers) {
  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))]
  const results = await Promise.all(unique.map(async (t) => [t, await getPrice(t)]))
  return new Map(results)
}

/**
 * Expose current cache stats (useful for health/debug endpoint).
 */
export function getCacheStats() {
  const entries = [..._cache.entries()]
  return {
    size: entries.length,
    tickers: entries.map(([ticker, { price, fetchedAt }]) => ({
      ticker,
      price,
      ageMinutes: Math.round((Date.now() - fetchedAt) / 60000),
      valid: isCacheValid({ fetchedAt }),
    })),
  }
}

/**
 * Clear the cache (useful in tests or forced refresh scenarios).
 */
export function clearPriceCache() {
  _cache.clear()
}
