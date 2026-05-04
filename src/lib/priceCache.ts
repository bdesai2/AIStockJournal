/**
 * Client-side price cache (frontend only).
 *
 * Mirrors a small subset of the server-side cache so the UI can
 * display live prices in the Open Trades table and Setup Generator
 * without hammering the server on every render cycle.
 *
 * Data flows:
 *   TradesPage / OpenTradesPage
 *     → fetches /api/yahoo/quote/:ticker (server → Finnhub)
 *     → stores result here
 *     → subsequent renders use cached value until TTL expires
 *
 * TTL: 1 hour (matching server cache)
 */

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

type PriceCacheEntry = {
  price: number | null
  fetchedAt: number
}

// Module-level Map shared across all components in the same session
const _clientCache = new Map<string, PriceCacheEntry>()

export function isCacheValid(ticker: string): boolean {
  const entry = _clientCache.get(ticker.toUpperCase())
  return !!entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

export function getCachedPrice(ticker: string): number | null {
  return _clientCache.get(ticker.toUpperCase())?.price ?? null
}

export function setPriceCache(ticker: string, price: number | null): void {
  _clientCache.set(ticker.toUpperCase(), { price, fetchedAt: Date.now() })
}

/**
 * Fetch a single ticker price from the app's backend proxy.
 * Returns the cached value if still fresh (no network call).
 *
 * @param ticker - e.g. "AAPL"
 * @param baseUrl - VITE_API_BASE_URL or empty for relative
 */
export async function fetchPrice(
  ticker: string,
  baseUrl = import.meta.env.VITE_API_BASE_URL || ''
): Promise<number | null> {
  const key = ticker.toUpperCase()
  if (isCacheValid(key)) return getCachedPrice(key)

  try {
    const res = await fetch(`${baseUrl}/api/yahoo/quote/${encodeURIComponent(key)}`)
    if (!res.ok) {
      console.warn(`[priceCache] ${res.status} fetching ${key}`)
      setPriceCache(key, null)
      return null
    }
    const { price } = (await res.json()) as { price: number | null }
    setPriceCache(key, price)
    return price
  } catch (err) {
    console.warn(`[priceCache] fetch error for ${key}:`, err)
    setPriceCache(key, null)
    return null
  }
}

/**
 * Batch-fetch prices for many tickers concurrently.
 * Skips tickers already in a valid cache entry.
 *
 * @returns Map<ticker, price | null>
 */
export async function fetchPrices(
  tickers: string[],
  baseUrl = import.meta.env.VITE_API_BASE_URL || ''
): Promise<Map<string, number | null>> {
  const unique = [...new Set(tickers.map((t) => t.toUpperCase()))]
  const pairs = await Promise.all(
    unique.map(async (t) => [t, await fetchPrice(t, baseUrl)] as [string, number | null])
  )
  return new Map(pairs)
}
