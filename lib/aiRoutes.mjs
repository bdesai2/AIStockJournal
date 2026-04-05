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
  callClaudeWithCache,
} from './aiHandlers.mjs'
import { SYSTEM_PROMPTS } from './systemPrompts.mjs'

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
    const trade = req.body?.trade
    if (!trade?.ticker || !trade?.status) {
      return res.status(400).json({ error: 'trade object with ticker and status required' })
    }
    if (trade.status !== 'closed') {
      return res.status(400).json({ error: 'only closed trades can be graded' })
    }

    try {
      const raw = await callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_CLOSED_GRADE,
        buildGradePrompt(trade),
        512
      )
      const parsed = parseGradeResponse(raw)
      res.json({ ...parsed, model })
    } catch (err) {
      console.error('❌ /api/ai/grade-trade error:', err)
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
      const raw = await callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_SETUP_CHECK,
        buildSetupCheckPrompt({ ticker, entry_price, stop_loss, take_profit, direction, quantity }),
        384
      )
      const parsed = parseSetupCheckResponse(raw)
      res.json(parsed)
    } catch (err) {
      console.error('❌ /api/ai/setup-check error:', err)
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

    let raw
    try {
      raw = await callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_TRADE_ANALYSIS,
        buildTradePrompt(trade),
        1024
      )
      const parsed = parseTradeAnalysisResponse(raw)
      res.json(parsed)
    } catch (err) {
      console.error('❌ /api/ai/trade-analysis error:', err.message)
      if (raw && err.message.includes('Unterminated string')) {
        console.error('Raw response preview:', raw.substring(0, 500))
      }
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

    try {
      const raw = await callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_WEEKLY_DIGEST,
        buildDigestPrompt(trades),
        640
      )
      const parsed = parseDigestResponse(raw)
      res.json(parsed)
    } catch (err) {
      console.error('❌ /api/ai/weekly-digest error:', err)
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
      const raw = await callClaudeWithCache(
        anthropic,
        model,
        SYSTEM_PROMPTS.SYSTEM_PROMPT_POTENTIAL_TRADE,
        buildPotentialTradePrompt({ symbol, market_type, direction, proposed_entry, stop_level, target_level, notes }),
        512
      )
      const parsed = JSON.parse(raw)
      res.json(parsed)
    } catch (err) {
      console.error('❌ /api/ai/potential-trade error:', err)
      res.status(502).json({ error: 'AI service unavailable' })
    }
  })
}
