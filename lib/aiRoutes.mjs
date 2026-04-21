/**
 * AI Route Handlers
 * Express route definitions for all Claude API calls
 */

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
  callClaudeWithCache,
} from './aiHandlers.mjs'
import { SYSTEM_PROMPTS } from './systemPrompts.mjs'

// ─── Timeout Management ────────────────────────────────────────────────────
const AI_TIMEOUT_MS = 55_000 // 55s — below Vercel's 60s serverless limit

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
  app.post('/api/ai/grade-trade', async (req, res) => {
    console.log('\n📨 [grade-trade] REQUEST RECEIVED')
    console.log('   Headers:', req.headers)
    console.log('   Content-Type:', req.get('content-type'))
    console.log('   Body type:', typeof req.body)
    console.log('   Body is Buffer?', Buffer.isBuffer(req.body))
    console.log('   Body is string?', typeof req.body === 'string')
    console.log('   Body keys:', req.body ? Object.keys(req.body) : 'NO BODY')
    console.log('   Raw body:', JSON.stringify(req.body, null, 2))

    const trade = req.body?.trade
    console.log('\n🔍 [grade-trade] EXTRACTED TRADE:')
    console.log('   trade exists?', !!trade)
    console.log('   trade type:', typeof trade)
    console.log('   trade keys:', trade ? Object.keys(trade) : 'N/A')

    if (trade) {
      console.log('   ✓ trade.ticker:', trade.ticker, `(${typeof trade.ticker})`, '→', !!trade.ticker ? 'TRUTHY' : 'FALSY')
      console.log('   ✓ trade.status:', trade.status, `(${typeof trade.status})`, '→', !!trade.status ? 'TRUTHY' : 'FALSY')
      console.log('   ✓ trade.entry_price:', trade.entry_price, `(${typeof trade.entry_price})`, '→', trade.entry_price !== undefined ? 'TRUTHY' : 'FALSY')
    }

    if (!trade?.ticker || !trade?.status || !trade?.entry_price) {
      console.log('❌ [grade-trade] VALIDATION FAILED')
      console.log('   Reason: Missing',
        !trade?.ticker ? 'ticker' : '',
        !trade?.status ? 'status' : '',
        !trade?.entry_price ? 'entry_price' : ''
      )
      return res.status(400).json({ error: 'trade object with ticker, status, and entry_price required' })
    }

    console.log('✅ [grade-trade] VALIDATION PASSED\n')
    if (trade.status !== 'closed') {
      return res.status(400).json({ error: 'only closed trades can be graded' })
    }

    try {
      const raw = await withTimeout(callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_CLOSED_GRADE,
        buildGradePrompt(trade),
        512
      ))
      const parsed = parseGradeResponse(raw)
      res.json({ ...parsed, model })
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
  app.post('/api/ai/setup-check', async (req, res) => {
    const { ticker, entry_price, stop_loss, take_profit, direction, quantity } = req.body ?? {}
    if (!ticker || !entry_price) {
      return res.status(400).json({ error: 'ticker and entry_price required' })
    }

    try {
      const raw = await withTimeout(callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_SETUP_CHECK,
        buildSetupCheckPrompt({ ticker, entry_price, stop_loss, take_profit, direction, quantity }),
        384
      ))
      const parsed = parseSetupCheckResponse(raw)
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
  app.post('/api/ai/trade-analysis', async (req, res) => {
    const trade = req.body?.trade
    if (!trade?.ticker || !trade?.entry_price) {
      return res.status(400).json({ error: 'trade object with ticker and entry_price required' })
    }

    try {
      const raw = await withTimeout(callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_TRADE_ANALYSIS,
        buildTradePrompt(trade),
        1024
      ))
      const parsed = parseTradeAnalysisResponse(raw)
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
   * Review trading week: identify patterns, emotional biases, lessons learned
   * Request body: { trades: [ { ticker, direction, net_pnl, emotional_state, ... } ] }
   * Response: { positive_patterns, negative_patterns, actionable_lesson }
   */
  app.post('/api/ai/weekly-digest', async (req, res) => {
    const { trades } = req.body ?? {}
    if (!Array.isArray(trades) || trades.length === 0) {
      return res.status(400).json({ error: 'trades array required' })
    }
    if (trades.length > 30) {
      console.warn(`⚠️ /api/ai/weekly-digest: received ${trades.length} trades, digest will use only first 30`)
    }

    try {
      const raw = await withTimeout(callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_WEEKLY_DIGEST,
        buildDigestPrompt(trades),
        640
      ))
      const parsed = parseDigestResponse(raw)
      res.json(parsed)
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
  app.post('/api/ai/potential-trade', async (req, res) => {
    const { symbol, market_type, direction, proposed_entry, stop_level, target_level, notes } = req.body ?? {}
    if (!symbol || !proposed_entry) {
      return res.status(400).json({ error: 'symbol and proposed_entry required' })
    }

    try {
      const raw = await withTimeout(callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_POTENTIAL_TRADE,
        buildPotentialTradePrompt({ symbol, market_type, direction, proposed_entry, stop_level, target_level, notes }),
        512
      ))
      const parsed = parsePotentialTradeResponse(raw)
      res.json({ ...parsed, model })
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
}
