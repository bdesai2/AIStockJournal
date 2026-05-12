/**
 * AI Route Handlers
 * Express route definitions for all Claude API calls
 */

import { createClient } from '@supabase/supabase-js'
import { isValidTicker, safeErrorMessage } from './validators.mjs'
import { getPrice, getPrices } from './priceLoader.mjs'
import {
  buildGradePrompt,
  parseGradeResponse,
  buildSetupCheckPrompt,
  parseSetupCheckResponse,
  buildTradePrompt,
  parseTradeAnalysisResponse,
  buildDigestPrompt,
  parseDigestResponse,
  buildPotentialTradePrompt,
  parsePotentialTradeResponse,
  buildAnalyzeOpenTradesPrompt,
  parseAnalyzeOpenTradesResponse,
  buildGenerateSetupsPrompt,
  parseGenerateSetupsResponse,
  callClaudeWithCache,
} from './aiHandlers.mjs'
import { SYSTEM_PROMPTS } from './systemPrompts.mjs'

// ─── Supabase Client (for token verification) ─────────────────────────────
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

// ─── Auth Middleware ───────────────────────────────────────────────────────
/**
 * Verify the Bearer token in the Authorization header against Supabase.
 * Rejects unauthenticated requests with 401 before they reach AI handlers.
 */
async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user?.id) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.user = data.user
  next()
}

// ─── Timeout Management ────────────────────────────────────────────────────
const AI_TIMEOUT_MS = 55_000 // 55s — below Vercel's 60s serverless limit
const AI_RESPONSE_CACHE_TTL_MS = 5 * 365 * 24 * 60 * 60 * 1000 // 5 years
const AI_REQUESTS_PER_HOUR = 5
const AI_RATE_WINDOW_MS = 60 * 60 * 1000

const aiResponseCache = new Map()
const aiRequestTracker = new Map()

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Promise that rejects if timeout exceeded
 */
async function withTimeout(promise, ms = AI_TIMEOUT_MS) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI_TIMEOUT')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

function stableSerialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`
}

function getResponseCacheKey(userId, routeKey, payload) {
  return `${userId}:${routeKey}:${stableSerialize(payload)}`
}

function getSavedAiResponse(userId, routeKey, payload) {
  if (!userId) return null
  const key = getResponseCacheKey(userId, routeKey, payload)
  const entry = aiResponseCache.get(key)
  if (!entry) return null

  if (Date.now() - entry.savedAt > AI_RESPONSE_CACHE_TTL_MS) {
    aiResponseCache.delete(key)
    return null
  }

  return entry.response
}

function saveAiResponse(userId, routeKey, payload, response) {
  if (!userId) return
  const key = getResponseCacheKey(userId, routeKey, payload)
  aiResponseCache.set(key, {
    response,
    savedAt: Date.now(),
  })
}

function consumeAiQuota(userId) {
  const now = Date.now()
  const current = aiRequestTracker.get(userId) ?? []
  const withinWindow = current.filter((ts) => now - ts < AI_RATE_WINDOW_MS)

  if (withinWindow.length >= AI_REQUESTS_PER_HOUR) {
    const oldest = withinWindow[0]
    const retryAfterMs = Math.max(0, AI_RATE_WINDOW_MS - (now - oldest))
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      remaining: 0,
    }
  }

  withinWindow.push(now)
  aiRequestTracker.set(userId, withinWindow)

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, AI_REQUESTS_PER_HOUR - withinWindow.length),
  }
}

function toOccDate(expiration) {
  if (!expiration) return null
  const iso = String(expiration).trim()
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    const [, yyyy, mm, dd] = m
    return `${yyyy.slice(2)}${mm}${dd}`
  }

  const us = iso.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (us) {
    const [, mmRaw, ddRaw, yyyyRaw] = us
    const mm = mmRaw.padStart(2, '0')
    const dd = ddRaw.padStart(2, '0')
    const yyyy = yyyyRaw.length === 2 ? `20${yyyyRaw}` : yyyyRaw
    return `${yyyy.slice(2)}${mm}${dd}`
  }

  return null
}

function toOccStrike(strike) {
  const n = Number(strike)
  if (!Number.isFinite(n) || n <= 0) return null
  return String(Math.round(n * 1000)).padStart(8, '0')
}

function extractOptionSymbolFromText(value) {
  if (!value) return null
  const text = String(value).trim().toUpperCase()
  const match = text.match(/(?:O:)?([A-Z]{1,6}\d{6}[CP]\d{8})/)
  return match ? match[1] : null
}

function resolveOptionQuoteSymbol(trade) {
  const strategySymbol = extractOptionSymbolFromText(trade.option_strategy)
  if (strategySymbol) return strategySymbol

  const legs = Array.isArray(trade.option_legs) ? trade.option_legs : []
  const preferredLeg = legs.find((l) => l?.action === 'buy') || legs[0]
  if (!preferredLeg) return null

  const occDate = toOccDate(preferredLeg.expiration)
  const occStrike = toOccStrike(preferredLeg.strike)
  const cp = String(preferredLeg.option_type || '').toLowerCase() === 'put' ? 'P' : 'C'
  const root = String(trade.ticker || '').trim().toUpperCase()
  if (!root || !occDate || !occStrike) return null

  return `${root}${occDate}${cp}${occStrike}`
}

function resolveQuoteSymbol(trade) {
  if (trade?.asset_type === 'option') {
    return resolveOptionQuoteSymbol(trade)
  }
  return String(trade?.ticker || '').toUpperCase()
}

/**
 * Register all AI routes on Express app
 * @param {object} app - Express application instance
 * @param {object} anthropic - Anthropic client instance
 * @param {string} model - Claude model ID to use
 */
export function registerAiRoutes(app, anthropic, model) {
  /**
   * POST /api/ai/grade-trade
   * Grade a completed trade: A+ to F based on setup, execution, risk/reward
   * Request body: { trade: { ticker, status, entry_price, exit_price, ... } }
   * Response: { grade, setup_score, rationale, suggestions, model }
   */
  app.post('/api/ai/grade-trade', authenticateRequest, async (req, res) => {
    const trade = req.body?.trade
    const routeKey = '/api/ai/grade-trade'
    const requestPayload = { trade }

    if (!trade?.ticker || !trade?.status || !trade?.entry_price) {
      return res.status(400).json({ error: 'trade object with ticker, status, and entry_price required' })
    }

    if (trade.status !== 'closed') {
      return res.status(400).json({ error: 'only closed trades can be graded' })
    }

    const savedResponse = getSavedAiResponse(req.user?.id, routeKey, requestPayload)
    const isCachedFallback =
      savedResponse?.market_context === 'AI output formatting failed for this request, so no setups were generated. Try again in a few seconds.'

    if (savedResponse && !isCachedFallback) {
      return res.json(savedResponse)
    }

    const quota = consumeAiQuota(req.user?.id)
    if (!quota.allowed) {
      return res.status(429).json({
        error: `AI request limit reached (max ${AI_REQUESTS_PER_HOUR}/hour). Please try again in ${quota.retryAfterSeconds} seconds.`,
      })
    }

    try {
      // Fetch current price (fresh, cached, or stale)
      const priceResult = await getPrice(trade.ticker)
      const priceNote = priceResult.price
        ? `Current Market Price (${priceResult.source}): $${priceResult.price}`
        : 'Current Market Price: unavailable — use your training data knowledge'

      const prompt = buildGradePrompt(trade) + '\n\n' + priceNote

      const raw = await withTimeout(callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_CLOSED_GRADE,
        prompt,
        512
      ))
      const parsed = { ...parseGradeResponse(raw), model }
      saveAiResponse(req.user?.id, routeKey, requestPayload, parsed)
      res.json(parsed)
    } catch (err) {
      if (err.message === 'AI_TIMEOUT') {
        console.error('⏱ /api/ai/grade-trade timed out')
        return res.status(504).json({ error: 'AI request timed out' })
      }
      if (err.message?.startsWith('JSON parse failed')) {
        console.error('❌ /api/ai/grade-trade parse error:', err.message)
        return res.status(500).json({ error: 'AI returned invalid response' })
      }
      console.error('❌ /api/ai/grade-trade error:', err.message)
      res.status(502).json({ error: 'AI service unavailable' })
    }
  })

  /**
   * POST /api/ai/setup-check
   * Validate a pre-trade setup: R/R ratio, position sizing, risk management
   * Request body: { ticker, entry_price, stop_loss?, take_profit?, direction, quantity? }
   * Response: { rr_rating, rr_comment, setup_quality, setup_comment, position_size_note, warnings }
   */
  app.post('/api/ai/setup-check', authenticateRequest, async (req, res) => {
    const { ticker, entry_price, stop_loss, take_profit, direction, quantity } = req.body ?? {}
    const routeKey = '/api/ai/setup-check'
    const requestPayload = { ticker, entry_price, stop_loss, take_profit, direction, quantity }
    if (!ticker || !entry_price) {
      return res.status(400).json({ error: 'ticker and entry_price required' })
    }
    if (!isValidTicker(ticker)) {
      return res.status(400).json({ error: 'Invalid ticker format' })
    }

    const savedResponse = getSavedAiResponse(req.user?.id, routeKey, requestPayload)
    if (savedResponse) {
      return res.json(savedResponse)
    }

    const quota = consumeAiQuota(req.user?.id)
    if (!quota.allowed) {
      return res.status(429).json({
        error: `AI request limit reached (max ${AI_REQUESTS_PER_HOUR}/hour). Please try again in ${quota.retryAfterSeconds} seconds.`,
      })
    }

    try {
      // Fetch current price to contextualize the proposed setup
      const priceResult = await getPrice(ticker)
      const priceNote = priceResult.price
        ? `Current Market Price (${priceResult.source}): $${priceResult.price}`
        : 'Current Market Price: unavailable — use your training data'

      const prompt = buildSetupCheckPrompt({ ticker, entry_price, stop_loss, take_profit, direction, quantity }) + '\n\n' + priceNote

      const raw = await withTimeout(callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_SETUP_CHECK,
        prompt,
        384
      ))
      const parsed = parseSetupCheckResponse(raw)
      saveAiResponse(req.user?.id, routeKey, requestPayload, parsed)
      res.json(parsed)
    } catch (err) {
      if (err.message === 'AI_TIMEOUT') {
        console.error('⏱ /api/ai/setup-check timed out')
        return res.status(504).json({ error: 'AI request timed out' })
      }
      if (err.message?.startsWith('JSON parse failed')) {
        console.error('❌ /api/ai/setup-check parse error:', err.message)
        return res.status(500).json({ error: 'AI returned invalid response' })
      }
      console.error('❌ /api/ai/setup-check error:', err.message)
      res.status(502).json({ error: 'AI service unavailable' })
    }
  })

  /**
   * POST /api/ai/trade-analysis
   * Analyze an active/open trade: estimate current price, P&L, bullish/bearish factors, recommendation
   * Request body: { trade: { ticker, asset_type, direction, entry_date, entry_price, ... } }
   * Response: { market_overview, current_price_estimate, estimated_pnl, bullish_factors, ... }
   */
  app.post('/api/ai/trade-analysis', authenticateRequest, async (req, res) => {
    const trade = req.body?.trade
    const routeKey = '/api/ai/trade-analysis'
    const requestPayload = { trade }
    if (!trade?.ticker || !trade?.entry_price) {
      return res.status(400).json({ error: 'trade object with ticker and entry_price required' })
    }

    const savedResponse = getSavedAiResponse(req.user?.id, routeKey, requestPayload)
    if (savedResponse) {
      return res.json(savedResponse)
    }

    const quota = consumeAiQuota(req.user?.id)
    if (!quota.allowed) {
      return res.status(429).json({
        error: `AI request limit reached (max ${AI_REQUESTS_PER_HOUR}/hour). Please try again in ${quota.retryAfterSeconds} seconds.`,
      })
    }

    try {
      // Fetch current price to analyze the trade's current status
      const priceResult = await getPrice(trade.ticker)
      const priceNote = priceResult.price
        ? `Current Market Price (${priceResult.source}): $${priceResult.price}`
        : 'Current Market Price: unavailable — use your training data'

      const prompt = buildTradePrompt(trade) + '\n\n' + priceNote

      const raw = await withTimeout(callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_TRADE_ANALYSIS,
        prompt,
        1024
      ))
      const parsed = parseTradeAnalysisResponse(raw)
      saveAiResponse(req.user?.id, routeKey, requestPayload, parsed)
      res.json(parsed)
    } catch (err) {
      if (err.message === 'AI_TIMEOUT') {
        console.error('⏱ /api/ai/trade-analysis timed out')
        return res.status(504).json({ error: 'AI request timed out' })
      }
      if (err.message?.startsWith('JSON parse failed')) {
        console.error('❌ /api/ai/trade-analysis parse error:', err.message)
        return res.status(500).json({ error: 'AI returned invalid response' })
      }
      console.error('❌ /api/ai/trade-analysis error:', err.message)
      res.status(502).json({ error: 'AI service unavailable' })
    }
  })

  /**
   * POST /api/ai/weekly-digest
    * Review most recent trades: identify trend, mistakes, drivers, and lessons
   * Request body: { trades: [ { ticker, direction, net_pnl, emotional_state, ... } ] }
  * Response: { performance_trend, trend_feedback, increasing_mistakes, performance_drivers, positive_patterns, negative_patterns, actionable_lesson }
   */
  app.post('/api/ai/weekly-digest', authenticateRequest, async (req, res) => {
    const { trades } = req.body ?? {}
    const routeKey = '/api/ai/weekly-digest'
    const requestPayload = { trades }
    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ error: 'trades array required' })
    }
    if (trades.length > 10) {
      console.warn(`⚠️ /api/ai/weekly-digest: received ${trades.length} trades, digest will use only first 10`)
    }

    const savedResponse = getSavedAiResponse(req.user?.id, routeKey, requestPayload)
    if (savedResponse) {
      return res.json(savedResponse)
    }

    const quota = consumeAiQuota(req.user?.id)
    if (!quota.allowed) {
      return res.status(429).json({
        error: `AI request limit reached (max ${AI_REQUESTS_PER_HOUR}/hour). Please try again in ${quota.retryAfterSeconds} seconds.`,
      })
    }

    try {
      // Fetch current prices for all tickers in the trades
      const uniqueTickers = [...new Set(trades.map(t => t.ticker).filter(Boolean))]
      const pricesResult = await getPrices(uniqueTickers)
      const firstPriceResult = uniqueTickers.length > 0 ? pricesResult.get(uniqueTickers[0]) : null
      const priceNote = uniqueTickers.length > 0
        ? `Current Market Prices (${firstPriceResult?.source || 'unavailable'}): ${uniqueTickers.map((t) => {
            const result = pricesResult.get(t)
            return `${t}=$${result?.price ?? 'unavailable'}`
          }).join(', ')}`
        : 'Current Market Prices: unavailable — use your training data'

      const prompt = buildDigestPrompt(trades) + '\n\n' + priceNote
      let lastErr = null

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const raw = await withTimeout(callClaudeWithCache(
            anthropic,
            model,
            SYSTEM_PROMPTS.SYSTEM_PROMPT_WEEKLY_DIGEST,
            prompt,
            900
          ))
          const parsed = parseDigestResponse(raw)
          saveAiResponse(req.user?.id, routeKey, requestPayload, parsed)
          return res.json(parsed)
        } catch (err) {
          lastErr = err
          if (err.message?.startsWith('JSON parse failed') && attempt === 1) {
            console.warn('⚠️ /api/ai/weekly-digest parse failed on first attempt, retrying once')
            continue
          }
          throw err
        }
      }

      throw lastErr ?? new Error('Digest generation failed')
    } catch (err) {
      if (err.message === 'AI_TIMEOUT') {
        console.error('⏱ /api/ai/weekly-digest timed out')
        return res.status(504).json({ error: 'AI request timed out' })
      }
      if (err.message?.startsWith('JSON parse failed')) {
        console.error('❌ /api/ai/weekly-digest parse error:', err.message)
        return res.status(500).json({ error: 'AI returned invalid response' })
      }
      console.error('❌ /api/ai/weekly-digest error:', err.message)
      res.status(502).json({ error: 'AI service unavailable' })
    }
  })

  /**
   * POST /api/ai/potential-trade
   * Evaluate a potential trade setup: quality, R/R, key levels, recommendation
   * Request body: { symbol, market_type?, direction?, proposed_entry, stop_level?, target_level?, notes? }
   * Response: { setup_quality, rr_potential, key_levels, bullish_case, bearish_case, probability, recommendation }
   */
  app.post('/api/ai/potential-trade', authenticateRequest, async (req, res) => {
    const { symbol, market_type, direction, proposed_entry, stop_level, target_level, notes } = req.body ?? {}
    const routeKey = '/api/ai/potential-trade'
    const requestPayload = { symbol, market_type, direction, proposed_entry, stop_level, target_level, notes }
    if (!symbol || !proposed_entry) {
      return res.status(400).json({ error: 'symbol and proposed_entry required' })
    }
    if (!isValidTicker(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol format' })
    }

    const savedResponse = getSavedAiResponse(req.user?.id, routeKey, requestPayload)
    if (savedResponse) {
      return res.json(savedResponse)
    }

    const quota = consumeAiQuota(req.user?.id)
    if (!quota.allowed) {
      return res.status(429).json({
        error: `AI request limit reached (max ${AI_REQUESTS_PER_HOUR}/hour). Please try again in ${quota.retryAfterSeconds} seconds.`,
      })
    }

    try {
      // Fetch current price to evaluate the potential setup in current market context
      const priceResult = await getPrice(symbol)
      const priceNote = priceResult.price
        ? `Current Market Price (${priceResult.source}): $${priceResult.price}`
        : 'Current Market Price: unavailable — use your training data'

      const prompt = buildPotentialTradePrompt({ symbol, market_type, direction, proposed_entry, stop_level, target_level, notes }) + '\n\n' + priceNote

      const raw = await withTimeout(callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_POTENTIAL_TRADE,
        prompt,
        512
      ))
      const parsed = { ...parsePotentialTradeResponse(raw), model }
      saveAiResponse(req.user?.id, routeKey, requestPayload, parsed)
      res.json(parsed)
    } catch (err) {
      if (err.message === 'AI_TIMEOUT') {
        console.error('⏱ /api/ai/potential-trade timed out')
        return res.status(504).json({ error: 'AI request timed out' })
      }
      if (err.message?.startsWith('JSON parse failed')) {
        console.error('❌ /api/ai/potential-trade parse error:', err.message)
        return res.status(500).json({ error: 'AI returned invalid response' })
      }
      console.error('❌ /api/ai/potential-trade error:', err.message)
      res.status(502).json({ error: 'AI service unavailable' })
    }
  })

  /**
   * POST /api/ai/generate-setups
   * Generate high-conviction A+ setup candidates from user constraints
   * Request body: { market_bias?, timeframe?, risk_profile?, focus_sectors?, watchlist?, max_setups?, notes? }
   * Response: { market_context, risk_notes, setups[] }
   */
  app.post('/api/ai/generate-setups', authenticateRequest, async (req, res) => {
    const {
      market_bias,
      timeframe,
      risk_profile,
      focus_sectors,
      watchlist,
      max_setups,
      notes,
    } = req.body ?? {}
    const routeKey = '/api/ai/generate-setups'

    const safeWatchlist = Array.isArray(watchlist)
      ? watchlist
        .map((s) => String(s || '').trim().toUpperCase())
        .filter((s) => isValidTicker(s))
      : []

    const safeMaxSetups = Math.max(1, Math.min(10, Number(max_setups ?? 5)))
    const requestPayload = {
      market_bias,
      timeframe,
      risk_profile,
      focus_sectors: Array.isArray(focus_sectors) ? focus_sectors.map(String) : [],
      watchlist: safeWatchlist,
      max_setups: safeMaxSetups,
      notes,
    }

    const savedResponse = getSavedAiResponse(req.user?.id, routeKey, requestPayload)
    if (savedResponse) {
      return res.json(savedResponse)
    }

    const quota = consumeAiQuota(req.user?.id)
    if (!quota.allowed) {
      return res.status(429).json({
        error: `AI request limit reached (max ${AI_REQUESTS_PER_HOUR}/hour). Please try again in ${quota.retryAfterSeconds} seconds.`,
      })
    }

    try {
      let priceContext = 'unavailable'
      if (safeWatchlist.length > 0) {
        const prices = await getPrices(safeWatchlist)
        priceContext = safeWatchlist
          .map((ticker) => {
            const item = prices.get(ticker)
            return `${ticker}=${item?.price ?? 'n/a'}`
          })
          .join(', ')
      }

      const prompt = buildGenerateSetupsPrompt({
        market_bias,
        timeframe,
        risk_profile,
        focus_sectors: Array.isArray(focus_sectors) ? focus_sectors.map(String) : [],
        watchlist: safeWatchlist,
        max_setups: safeMaxSetups,
        notes,
        price_context: priceContext,
      })

      let parsed

      try {
        const raw = await withTimeout(callClaudeWithCache(
          anthropic,
          model,
          SYSTEM_PROMPTS.SYSTEM_PROMPT_SETUP_GENERATOR,
          prompt,
          2000
        ))

        if (process.env.NODE_ENV !== 'production') {
          console.log('[/api/ai/generate-setups] Raw response (attempt 1):', raw.substring(0, 500))
        }

        parsed = parseGenerateSetupsResponse(raw)
      } catch (err) {
        if (!err.message?.startsWith('JSON parse failed')) throw err

        console.warn('⚠️ /api/ai/generate-setups parse failed on first attempt, retrying with stricter prompt')

        try {
          const retryRaw = await withTimeout(callClaudeWithCache(
            anthropic,
            model,
            SYSTEM_PROMPTS.SYSTEM_PROMPT_SETUP_GENERATOR,
            `${prompt}\n\nIMPORTANT: Return ONLY valid JSON with no other text, markdown, or explanation. Double-check all brackets and quotes.`,
            2000
          ))

          if (process.env.NODE_ENV !== 'production') {
            console.log('[/api/ai/generate-setups] Raw response (attempt 2):', retryRaw.substring(0, 500))
          }

          parsed = parseGenerateSetupsResponse(retryRaw)
        } catch (retryErr) {
          if (!retryErr.message?.startsWith('JSON parse failed')) throw retryErr

          console.warn('⚠️ /api/ai/generate-setups parse failed after retry, running final strict JSON attempt')

          try {
            const finalPrompt = [
              'Return exactly one valid JSON object.',
              'Do not include markdown, prose, comments, or code fences.',
              'Start your response with { and end it with }.',
              '',
              prompt,
            ].join('\n')

            const finalRaw = await withTimeout(callClaudeWithCache(
              anthropic,
              model,
              SYSTEM_PROMPTS.SYSTEM_PROMPT_SETUP_GENERATOR,
              finalPrompt,
              2000
            ))

            if (process.env.NODE_ENV !== 'production') {
              console.log('[/api/ai/generate-setups] Raw response (attempt 3):', finalRaw.substring(0, 500))
            }

            parsed = parseGenerateSetupsResponse(finalRaw)
          } catch (finalErr) {
            if (!finalErr.message?.startsWith('JSON parse failed')) throw finalErr

            console.warn('⚠️ /api/ai/generate-setups parse failed after 3 attempts, using fallback response')
            parsed = {
              market_context: 'AI output formatting failed for this request, so no setups were generated. Try again in a few seconds.',
              risk_notes: [
                'Model response could not be parsed into valid JSON.',
                'Verify all trade ideas manually before execution.',
              ],
              setups: [],
            }
          }
        }
      }

      const responsePayload = {
        ...parsed,
        setups: parsed.setups.slice(0, safeMaxSetups),
        generated_at: new Date().toISOString(),
      }

      const isFallbackResponse =
        responsePayload.market_context === 'AI output formatting failed for this request, so no setups were generated. Try again in a few seconds.'

      if (!isFallbackResponse) {
        saveAiResponse(req.user?.id, routeKey, requestPayload, responsePayload)
      }

      res.json(responsePayload)
    } catch (err) {
      if (err.message === 'AI_TIMEOUT') {
        console.error('⏱ /api/ai/generate-setups timed out')
        return res.status(504).json({ error: 'AI request timed out' })
      }
      if (err.message?.startsWith('JSON parse failed')) {
        console.error('❌ /api/ai/generate-setups parse error:', err.message)
        return res.status(500).json({ error: 'AI returned invalid response' })
      }
      console.error('❌ /api/ai/generate-setups error:', safeErrorMessage(err))
      res.status(502).json({ error: 'AI service unavailable' })
    }
  })

  /**
   * POST /api/ai/analyze-open-trades
   * Analyze all open trades in portfolio: health, risks, recommendations
   * Request body: { open_trades: [ { ticker, asset_type, direction, entry_price, quantity, current_price, ... } ] }
   * Response: { portfolio_health, health_summary, major_risks, best_performers, worst_performers, recommendations }
   */
  app.post('/api/ai/analyze-open-trades', authenticateRequest, async (req, res) => {
    const openTrades = req.body?.open_trades
    const routeKey = '/api/ai/analyze-open-trades'
    const requestPayload = { open_trades: openTrades }
    if (!Array.isArray(openTrades)) {
      return res.status(400).json({ error: 'open_trades array required' })
    }

    // If no open trades, return a simple response
    if (openTrades.length === 0) {
      return res.json({
        portfolio_health: 'stable',
        health_summary: 'No open trades currently. Portfolio is in a clean state, ready for new opportunity exploration.',
        per_trade_scorecard: [],
        major_risks: [],
        best_performers: [],
        worst_performers: [],
        recommendations: ['Review watchlist for new setup opportunities', 'Backtest historical strategies', 'Plan next week trading thesis'],
      })
    }

    const savedResponse = getSavedAiResponse(req.user?.id, routeKey, requestPayload)
    if (savedResponse) {
      return res.json(savedResponse)
    }

    const quota = consumeAiQuota(req.user?.id)
    if (!quota.allowed) {
      return res.status(429).json({
        error: `AI request limit reached (max ${AI_REQUESTS_PER_HOUR}/hour). Please try again in ${quota.retryAfterSeconds} seconds.`,
      })
    }

    try {
      // Fetch current prices for stock/equity trades only.
      // Option trades are excluded from live price lookup (contract quotes unreliable on free tier).
      const stockTrades = openTrades.filter((t) => t.asset_type !== 'option')
      const tradesWithQuoteSymbol = stockTrades.map((trade) => ({
        ...trade,
        quote_symbol: resolveQuoteSymbol(trade),
      }))
      const uniqueQuoteSymbols = [...new Set(tradesWithQuoteSymbol.map((t) => t.quote_symbol).filter(Boolean))]
      const pricesResult = uniqueQuoteSymbols.length > 0 ? await getPrices(uniqueQuoteSymbols) : new Map()
      const stockPriceMap = new Map(tradesWithQuoteSymbol.map((t) => [t.id, pricesResult.get(t.quote_symbol)?.price ?? t.entry_price]))

      // Merge prices into trades for AI context
      const enrichedTrades = openTrades.map((trade, idx) => ({
        ...trade,
        idx: idx + 1,
        is_option: trade.asset_type === 'option',
        current_price: trade.asset_type === 'option' ? trade.entry_price : (stockPriceMap.get(trade.id) ?? trade.entry_price),
      }))

      const prompt = buildAnalyzeOpenTradesPrompt(enrichedTrades)
      let parsed

      try {
        const raw = await withTimeout(callClaudeWithCache(
          anthropic,
          model,
          SYSTEM_PROMPTS.SYSTEM_PROMPT_OPEN_POSITIONS,
          prompt,
          1400
        ))
        parsed = parseAnalyzeOpenTradesResponse(raw)
      } catch (err) {
        if (!err.message?.startsWith('JSON parse failed')) throw err

        console.warn('⚠️ /api/ai/analyze-open-trades parse failed on first attempt, retrying once')
        try {
          const retryRaw = await withTimeout(callClaudeWithCache(
            anthropic,
            model,
            SYSTEM_PROMPTS.SYSTEM_PROMPT_OPEN_POSITIONS,
            `${prompt}\n\nIMPORTANT: Return only valid JSON with all required keys and no trailing commas.`,
            1600
          ))
          parsed = parseAnalyzeOpenTradesResponse(retryRaw)
        } catch (retryErr) {
          if (!retryErr.message?.startsWith('JSON parse failed')) throw retryErr

          console.warn('⚠️ /api/ai/analyze-open-trades parse failed after retry, using rule-based fallback')
          const winCount = enrichedTrades.filter((t) => {
            const current = Number(t.current_price ?? t.entry_price)
            const pct = t.entry_price > 0
              ? ((t.direction === 'short' ? (t.entry_price - current) : (current - t.entry_price)) / t.entry_price) * 100
              : 0
            return pct > 0
          }).length
          const winRate = enrichedTrades.length > 0 ? (winCount / enrichedTrades.length) * 100 : 0
          const fallbackHealth = winRate >= 60 ? 'improving' : winRate >= 45 ? 'stable' : 'weakening'

          parsed = {
            portfolio_health: fallbackHealth,
            health_summary: 'AI output could not be fully parsed, so this view is using a rule-based scorecard from live prices. Click Refresh Analysis to try AI formatting again.',
            per_trade_scorecard: [],
            major_risks: ['AI response formatting failed; verify actions before execution'],
            best_performers: [],
            worst_performers: [],
            recommendations: ['Review top losing positions first', 'Tighten stops on high-volatility holdings', 'Refresh analysis in a few seconds for full AI narrative'],
          }
        }
      }

      // Guarantee one row per open trade even when AI omits or misformats rows.
      const aiRowsByIdx = new Map((parsed.per_trade_scorecard ?? []).map((row) => [row.idx, row]))
      const mergedScorecard = enrichedTrades.map((trade) => {
        const aiRow = aiRowsByIdx.get(trade.idx)
        const current = Number(trade.current_price ?? trade.entry_price)
        const pnlPercent = trade.entry_price > 0
          ? ((trade.direction === 'short'
            ? (trade.entry_price - current)
            : (current - trade.entry_price)) / trade.entry_price) * 100
          : 0

        const fallbackGrade = pnlPercent >= 20
          ? 'A'
          : pnlPercent >= 8
            ? 'B+'
            : pnlPercent >= 0
              ? 'B'
              : pnlPercent >= -4
                ? 'C+'
                : pnlPercent >= -8
                  ? 'C'
                  : pnlPercent >= -12
                    ? 'D'
                    : 'F'

        const fallbackAction = pnlPercent >= 20
          ? `Raise stop near $${(current * 0.92).toFixed(2)} today`
          : pnlPercent >= 8
            ? 'Scale out 20-30% into strength and trail stop'
            : pnlPercent >= 0
              ? 'Hold with disciplined stop; avoid adding size'
              : pnlPercent >= -6
                ? 'Reduce risk or tighten stop before next session'
                : 'Cut size aggressively and protect remaining capital'

        return {
          idx: trade.idx,
          ticker: trade.ticker,
          asset_type: trade.asset_type,
          entry: Number(trade.entry_price),
          current: trade.is_option ? null : Number(current),
          pnl_percent: trade.is_option ? null : Number(pnlPercent),
          grade: trade.is_option ? null : (aiRow?.grade ?? fallbackGrade),
          urgent_action: trade.is_option ? null : (aiRow?.urgent_action ?? fallbackAction),
        }
      })

      const responsePayload = {
        ...parsed,
        per_trade_scorecard: mergedScorecard,
      }
      saveAiResponse(req.user?.id, routeKey, requestPayload, responsePayload)
      res.json(responsePayload)
    } catch (err) {
      if (err.message === 'AI_TIMEOUT') {
        console.error('⏱ /api/ai/analyze-open-trades timed out')
        return res.status(504).json({ error: 'AI request timed out' })
      }
      if (err.message?.startsWith('JSON parse failed')) {
        console.error('❌ /api/ai/analyze-open-trades parse error:', err.message)
        return res.status(500).json({ error: 'AI returned invalid response' })
      }
      console.error('❌ /api/ai/analyze-open-trades error:', err.message)
      res.status(502).json({ error: 'AI service unavailable' })
    }
  })
}

