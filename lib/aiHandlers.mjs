/**
 * AI Trade Analysis Handlers
 * All Claude API calls for trade analysis, grading, and evaluation
 */

import { safeParseJSON } from './utils.mjs'
import { SYSTEM_PROMPTS } from './systemPrompts.mjs'

/**
 * Build user message prompt for trade grading
 * @param {object} trade - Trade object with ticker, status, P&L, risk data
 * @returns {string} Formatted prompt for Claude
 */
function buildGradePrompt(trade) {
  const rr = trade.stop_loss && trade.take_profit
    ? ((trade.take_profit - trade.entry_price) / (trade.entry_price - trade.stop_loss)).toFixed(2)
    : 'N/A'
  const qtyDisplay = trade.quantity === 0 ? 'dividend-only (no share quantity)' : trade.quantity

  return `Trade data:
- Ticker: ${trade.ticker} (${trade.asset_type}, ${trade.direction}${trade.option_type ? ', ' + trade.option_type : ''})
- Entry: $${trade.entry_price} on ${trade.entry_date}
- Exit: $${trade.exit_price} on ${trade.exit_date}
- Quantity: ${qtyDisplay}
- Net P&L: $${trade.net_pnl ?? 'N/A'}
- R-Multiple: ${trade.r_multiple ?? 'N/A'}
- Stop Loss: ${trade.stop_loss ?? 'not set'} | Take Profit: ${trade.take_profit ?? 'not set'}
- Strategy Tags: ${(trade.strategy_tags ?? []).join(', ') || 'none'}
- Setup Notes: ${trade.setup_notes || 'none'}
- Mistakes: ${trade.mistakes || 'none'}
- Emotional State: ${trade.emotional_state || 'not recorded'}
- Execution Quality (self-rated): ${trade.execution_quality ?? 'not rated' } out of 5.

Evaluate this trade and respond with exactly this JSON structure:
{
  "grade": "<one of: A+, A, B+, B, C+, C, D, F>",
  "setup_score": <integer 0-100>,
  "rationale": "<2-3 sentences explaining the grade. Be direct and specific to the numbers.>",
  "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "<actionable suggestion 3>"]
}`
}

/**
 * Parse and validate grade response from Claude
 * @param {string} raw - Raw JSON from Claude
 * @returns {object} Validated grade response
 */
function parseGradeResponse(raw) {
  const d = safeParseJSON(raw)
  return {
    grade: String(d.grade ?? 'C'),
    setup_score: Math.max(0, Math.min(100, Number(d.setup_score ?? 50))),
    rationale: String(d.rationale ?? ''),
    suggestions: Array.isArray(d.suggestions) ? d.suggestions.map(String) : [],
  }
}

/**
 * Build user message prompt for pre-trade setup validation
 * @param {object} params - Ticker, prices, risk parameters
 * @returns {string} Formatted prompt for Claude
 */
function buildSetupCheckPrompt({ ticker, entry_price, stop_loss, take_profit, direction, quantity }) {
  const rr = stop_loss && take_profit
    ? Math.abs((take_profit - entry_price) / (entry_price - stop_loss)).toFixed(2)
    : null
  const riskPerShare = stop_loss ? Math.abs(entry_price - stop_loss).toFixed(4) : null

  return `Proposed trade:
- Ticker: ${ticker}
- Direction: ${direction ?? 'long'}
- Entry Price: $${entry_price}
- Stop Loss: ${stop_loss ? '$' + stop_loss : 'not set'}
- Take Profit: ${take_profit ? '$' + take_profit : 'not set'}
- Quantity: ${quantity ?? 'not specified'}
- Calculated R/R: ${rr ?? 'cannot calculate — stop/target not set'}
- Risk per share: ${riskPerShare ? '$' + riskPerShare : 'N/A'}

Evaluate the setup quality and respond with exactly this JSON structure:
{
  "rr_rating": "<poor|acceptable|good|excellent>",
  "rr_comment": "<one sentence on the R/R ratio>",
  "setup_quality": "<weak|moderate|strong>",
  "setup_comment": "<one sentence on the overall setup>",
  "position_size_note": "<one sentence suggestion on sizing, or 'Set a stop loss to calculate'>",
  "warnings": ["<warning if any critical issue, otherwise empty array>"]
}`
}

/**
 * Parse and validate setup check response from Claude
 * @param {string} raw - Raw JSON from Claude
 * @returns {object} Validated setup check response
 */
function parseSetupCheckResponse(raw) {
  const d = safeParseJSON(raw)
  return {
    rr_rating: d.rr_rating ?? 'acceptable',
    rr_comment: d.rr_comment ?? '',
    setup_quality: d.setup_quality ?? 'moderate',
    setup_comment: d.setup_comment ?? '',
    position_size_note: d.position_size_note ?? '',
    warnings: Array.isArray(d.warnings) ? d.warnings : [],
  }
}

/**
 * Build user message prompt for active trade analysis
 * @param {object} trade - Trade data with ticker, entry_price, quantity, etc.
 * @returns {string} Formatted prompt for Claude
 */
function buildTradePrompt(trade) {
  const {
    ticker,
    asset_type,
    direction,
    entry_date,
    entry_price,
    quantity,
    stop_loss,
    take_profit,
    setup_notes,
  } = trade

  const entryTotal = entry_price * quantity
  const stopLossLine = stop_loss ? `Stop Loss: $${stop_loss}` : `Stop Loss: Not set`
  const targetLine = take_profit ? `Take Profit Target: $${take_profit}` : `Take Profit Target: Not set`
  // Escape newlines and quotes in notes to prevent JSON parse issues
  const safeNotes = setup_notes ? setup_notes.replace(/[\r\n]/g, ' ').replace(/"/g, '\\"') : 'None provided'
  const notesLine = `Setup Notes: ${safeNotes}`

  return `TRADE DETAILS:
  Ticker: ${ticker}
  Asset Type: ${asset_type}
  Direction: ${direction}
  Option Type: ${trade.option_type ?? 'N/A'}
  Entry Date: ${entry_date}
  Entry Price: $${entry_price}
  Quantity: ${quantity}
  Entry Total: $${entryTotal.toFixed(2)}
  ${stopLossLine}
  ${targetLine}
  ${notesLine}

  Today's Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

  Analyze this trade using current market conditions, recent news, analyst price targets, and macro environment. Calculate estimated current P&L using best estimate of current market price.
  `.trim()
}

/**
 * Build user message prompt for weekly trade review
 * @param {array} trades - Array of closed trades
 * @returns {string} Formatted prompt for Claude
 */
function buildDigestPrompt(trades) {
  const recentTrades = trades.slice(0, 10)
  const summary = recentTrades.map((t, i) =>
    `${i + 1}|${t.exit_date || t.entry_date || ''}|${t.ticker}|${t.direction}|${t.strategy_tags?.join(',') || ''}|${t.net_pnl?.toFixed(2) || '0'}|${t.r_multiple?.toFixed(2) || 'N/A'}|${t.emotional_state || ''}|${t.mistakes || ''}`
  ).join('\n')

  const winCount = recentTrades.filter(t => (t.net_pnl ?? 0) > 0).length
  const totalPnl = recentTrades.reduce((s, t) => s + (t.net_pnl ?? 0), 0)

  return `Most recent ${recentTrades.length} closed trades summary in chronological sequence
from newest (1) to oldest (${recentTrades.length})
(idx|date|ticker|direction|strategies|net_pnl|r_multiple|emotion|mistakes):
${summary}

Overall: ${winCount}/${recentTrades.length} wins, total P&L $${totalPnl.toFixed(2)}

Compare the newest 5 trades vs the previous 5 trades to determine whether performance is increasing, decreasing, mixed, or flat.
Identify specific mistake patterns that are becoming more frequent and specific drivers behind recent improvement or decline.

Identify patterns and respond with exactly this JSON structure:
{
  "performance_trend": "<increasing|decreasing|mixed|flat>",
  "trend_feedback": "<1-2 sentence explanation of the trend based on recent 10 trades>",
  "increasing_mistakes": [
    "<mistake getting more frequent, if any>",
    "<mistake getting more frequent, if any>",
    "<mistake getting more frequent, if any>"
  ],
  "performance_drivers": [
    "<key contributor to recent improvement or decline>",
    "<key contributor to recent improvement or decline>",
    "<key contributor to recent improvement or decline>"
  ],
  "positive_patterns": [
    {"pattern": "<pattern name>", "detail": "<one sentence>"},
    {"pattern": "<pattern name>", "detail": "<one sentence>"},
    {"pattern": "<pattern name>", "detail": "<one sentence>"}
  ],
  "negative_patterns": [
    {"pattern": "<pattern name>", "detail": "<one sentence>"},
    {"pattern": "<pattern name>", "detail": "<one sentence>"},
    {"pattern": "<pattern name>", "detail": "<one sentence>"}
  ],
  "actionable_lesson": "<one concrete, specific lesson to apply next week>"
}`
}

/**
 * Parse and validate weekly digest response from Claude
 * @param {string} raw - Raw JSON from Claude
 * @returns {object} Validated digest response
 */
function parseDigestResponse(raw) {
  const d = safeParseJSON(raw)
  const trend = String(d.performance_trend ?? 'mixed').toLowerCase()
  const safeTrend = ['increasing', 'decreasing', 'mixed', 'flat'].includes(trend) ? trend : 'mixed'
  return {
    performance_trend: safeTrend,
    trend_feedback: String(d.trend_feedback ?? ''),
    increasing_mistakes: Array.isArray(d.increasing_mistakes) ? d.increasing_mistakes.map(String) : [],
    performance_drivers: Array.isArray(d.performance_drivers) ? d.performance_drivers.map(String) : [],
    positive_patterns: Array.isArray(d.positive_patterns) ? d.positive_patterns : [],
    negative_patterns: Array.isArray(d.negative_patterns) ? d.negative_patterns : [],
    actionable_lesson: String(d.actionable_lesson ?? ''),
  }
}

/**
 * Parse and validate trade analysis response from Claude
 * @param {string} raw - Raw JSON from Claude
 * @returns {object} Validated trade analysis response
 */
function parseTradeAnalysisResponse(raw) {
  const d = safeParseJSON(raw)
  return {
    market_overview: d.market_overview ?? '',
    current_price_estimate: Number(d.current_price_estimate ?? 0),
    estimated_pnl: Number(d.estimated_pnl ?? 0),
    estimated_pnl_percent: Number(d.estimated_pnl_percent ?? 0),
    bullish_factors: Array.isArray(d.bullish_factors) ? d.bullish_factors.map(String) : [],
    bearish_factors: Array.isArray(d.bearish_factors) ? d.bearish_factors.map(String) : [],
    technical_outlook: d.technical_outlook ?? '',
    recommendation: ['hold', 'reduce', 'exit', 'add'].includes(d.recommendation) ? d.recommendation : 'hold',
    confidence: ['low', 'moderate', 'high'].includes(d.confidence) ? d.confidence : 'moderate',
    next_key_levels: {
      resistance: Number(d.next_key_levels?.resistance ?? 0),
      support: Number(d.next_key_levels?.support ?? 0),
    },
  }
}

/**
 * Parse and validate potential trade response from Claude
 * @param {string} raw - Raw JSON from Claude
 * @returns {object} Validated potential trade response
 */
function parsePotentialTradeResponse(raw) {
  const d = safeParseJSON(raw)
  return {
    setup_quality: ['weak', 'moderate', 'strong', 'excellent'].includes(d.setup_quality) ? d.setup_quality : 'moderate',
    rr_potential: d.rr_potential !== null && d.rr_potential !== undefined ? Number(d.rr_potential) : null,
    key_levels: {
      entry: Number(d.key_levels?.entry ?? 0),
      stop: Number(d.key_levels?.stop ?? 0),
      target: Number(d.key_levels?.target ?? 0),
    },
    bullish_case: String(d.bullish_case ?? ''),
    bearish_case: String(d.bearish_case ?? ''),
    probability: ['low', 'medium', 'high'].includes(d.probability) ? d.probability : 'medium',
    recommendation: ['pass', 'watch', 'consider', 'strong buy'].includes(d.recommendation) ? d.recommendation : 'watch',
  }
}

/**
 * Build user message prompt for potential trade evaluation
 * @param {object} params - Symbol, direction, price levels, notes
 * @returns {string} Formatted prompt for Claude
 */
function buildPotentialTradePrompt({ symbol, market_type, direction, proposed_entry, stop_level, target_level, notes }) {
  const rr = stop_level && target_level
    ? Math.abs((target_level - proposed_entry) / (proposed_entry - stop_level)).toFixed(2)
    : null
  const riskPerUnit = stop_level ? Math.abs(proposed_entry - stop_level).toFixed(4) : null

  return `Potential trade setup:
- Symbol: ${symbol}
- Asset Type: ${market_type || 'stock'}
- Direction: ${direction || 'long'}
- Proposed Entry: $${proposed_entry}
- Stop Level: ${stop_level ? '$' + stop_level : 'not defined'}
- Target Level: ${target_level ? '$' + target_level : 'not defined'}
- Calculated R/R: ${rr || 'cannot calculate'}
- Risk per unit: ${riskPerUnit || 'N/A'}
- Setup Notes: ${notes || 'none'}

Evaluate this potential trade opportunity and respond with exactly this JSON structure:
{
  "setup_quality": "<weak|moderate|strong|excellent>",
  "rr_potential": <risk/reward ratio as number or null>,
  "key_levels": {"entry": <number>, "stop": <number>, "target": <number>},
  "bullish_case": "<2-3 sentences>",
  "bearish_case": "<2-3 sentences>",
  "probability": "<low|medium|high>",
  "recommendation": "<pass|watch|consider|strong buy>"
}`
}

/**
 * Helper to call Claude with cached system prompt and user message
 * @param {object} anthropic - Anthropic client instance
 * @param {string} model - Claude model ID
 * @param {string} systemPrompt - System prompt from SYSTEM_PROMPTS
 * @param {string} userMessage - User message/data
 * @param {number} maxTokens - Max tokens for response
 * @returns {Promise<string>} Raw response text from Claude
 */
async function callClaudeWithCache(anthropic, model, systemPrompt, userMessage, maxTokens) {
  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  })

  return message.content[0].text
}

/**
 * Build user message prompt for analyzing all open trades
 * @param {array} openTrades - Array of open trade objects with current market prices
 * @returns {string} Formatted prompt for Claude
 */
function buildAnalyzeOpenTradesPrompt(openTrades) {
  if (!openTrades || openTrades.length === 0) {
    return 'User has no open trades. Summarize this as a clean slate ready for new trades.'
  }

  // Calculate portfolio-level stats
  const portfolio = {
    totalPositions: openTrades.length,
    winners: 0,
    losers: 0,
    totalGrossUnrealizedPnl: 0,
    totalByTicker: {},
    riskConcentration: {},
  }

  const tradesData = openTrades.map((trade, idx) => {
    // Estimate current P&L using current price if available
    const estimatedCurrentPrice = trade.current_price ?? trade.entry_price
    const estimatedGross = trade.direction === 'short'
      ? (trade.entry_price - estimatedCurrentPrice) * trade.quantity
      : (estimatedCurrentPrice - trade.entry_price) * trade.quantity
    const estimatedNetUnrealized = estimatedGross - (trade.fees ?? 0)
    const estimatedPnlPercent = ((estimatedNetUnrealized / (trade.entry_price * trade.quantity)) * 100)

    // Portfolio stats
    portfolio.totalGrossUnrealizedPnl += estimatedGross
    if (estimatedNetUnrealized > 0) portfolio.winners += 1
    if (estimatedNetUnrealized < 0) portfolio.losers += 1
    portfolio.totalByTicker[trade.ticker] = (portfolio.totalByTicker[trade.ticker] ?? 0) + estimatedNetUnrealized
    portfolio.riskConcentration[trade.ticker] = (portfolio.riskConcentration[trade.ticker] ?? 0) + (trade.initial_risk ?? 0)

    return `${idx + 1}|${trade.ticker}|${trade.asset_type}|${trade.direction}|$${trade.entry_price}|$${estimatedCurrentPrice}|${trade.quantity}|$${estimatedNetUnrealized.toFixed(2)}|${estimatedPnlPercent.toFixed(1)}%|${trade.strategy_tags?.join(',') || 'none'}|${trade.ai_grade || '-'}`
  }).join('\n')

  const bestByPnl = Object.entries(portfolio.totalByTicker).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const worstByPnl = Object.entries(portfolio.totalByTicker).sort((a, b) => a[1] - b[1]).slice(0, 3)
  const bestByPnlStr = bestByPnl.map(([t, p]) => `${t} ($${p.toFixed(2)})`).join(', ') || 'none'
  const worstByPnlStr = worstByPnl.map(([t, p]) => `${t} ($${p.toFixed(2)})`).join(', ') || 'none'

  return `OPEN POSITIONS PORTFOLIO ANALYSIS
User has ${portfolio.totalPositions} open trade(s).

Position summary (idx|ticker|asset|direction|entry|current_est|qty|unrealized_pnl|pnl%|tags|grade):
${tradesData}

Portfolio Summary:
- Total Unrealized P&L (gross): $${portfolio.totalGrossUnrealizedPnl.toFixed(2)}
- Winners: ${portfolio.winners} | Losers: ${portfolio.losers} | Win Rate: ${portfolio.totalPositions > 0 ? ((portfolio.winners / portfolio.totalPositions) * 100).toFixed(1) : 0}%
- Top 3 Performers: ${bestByPnlStr}
- Bottom 3 Performers: ${worstByPnlStr}
- Largest Risk Concentration: ${Object.entries(portfolio.riskConcentration).sort((a, b) => b[1] - a[1])[0]?.[0] || 'diversified'}

Analyze this portfolio and respond with exactly this JSON structure.
CRITICAL RULES:
- Return one per_trade_scorecard row for EACH input position.
- Preserve idx so row mapping stays stable.
- grade must be one of A+, A, A-, B+, B, B-, C+, C, C-, D, F.
- urgent_action must be a concrete next step in under 14 words.

Required JSON structure:
{
  "portfolio_health": "<concerning|weakening|stable|improving|strong>",
  "health_summary": "<1-2 sentences on overall portfolio status>",
  "per_trade_scorecard": [
    {
      "idx": <input idx integer>,
      "ticker": "<ticker>",
      "entry": <entry price as number>,
      "current": <current price as number>,
      "pnl_percent": <unrealized pnl percent as number>,
      "grade": "<A+|A|A-|B+|B|B-|C+|C|C-|D|F>",
      "urgent_action": "<single highest-priority next step>"
    }
  ],
  "major_risks": [
    "<concentration risk or concerning position>",
    "<concentration risk or concerning position>",
    "<concentration risk or concerning position>"
  ],
  "best_performers": [
    {"ticker": "<ticker>", "pnl": <unrealized pnl>, "reason": "<short reason>"},
    {"ticker": "<ticker>", "pnl": <unrealized pnl>, "reason": "<short reason>"},
    {"ticker": "<ticker>", "pnl": <unrealized pnl>, "reason": "<short reason>"}
  ],
  "worst_performers": [
    {"ticker": "<ticker>", "pnl": <unrealized pnl>, "reason": "<short reason>"},
    {"ticker": "<ticker>", "pnl": <unrealized pnl>, "reason": "<short reason>"},
    {"ticker": "<ticker>", "pnl": <unrealized pnl>, "reason": "<short reason>"}
  ],
  "recommendations": [
    "<actionable recommendation #1>",
    "<actionable recommendation #2>",
    "<actionable recommendation #3>"
  ]
}`
}

/**
 * Parse and validate open trades analysis response from Claude
 * @param {string} raw - Raw JSON from Claude
 * @returns {object} Validated analysis response
 */
function parseAnalyzeOpenTradesResponse(raw) {
  const d = safeParseJSON(raw)
  const health = String(d.portfolio_health ?? 'stable').toLowerCase()
  const safeHealth = ['concerning', 'weakening', 'stable', 'improving', 'strong'].includes(health) ? health : 'stable'

  const allowedGrades = new Set(['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'])
  const perTradeScorecard = Array.isArray(d.per_trade_scorecard)
    ? d.per_trade_scorecard.map((row) => {
      const normalizedGrade = String(row?.grade ?? 'C').toUpperCase()
      return {
        idx: Number(row?.idx ?? 0),
        ticker: String(row?.ticker ?? '').toUpperCase(),
        entry: Number(row?.entry ?? 0),
        current: Number(row?.current ?? 0),
        pnl_percent: Number(row?.pnl_percent ?? 0),
        grade: allowedGrades.has(normalizedGrade) ? normalizedGrade : 'C',
        urgent_action: String(row?.urgent_action ?? 'Monitor closely and reassess risk today'),
      }
    }).filter((row) => row.idx > 0 && row.ticker)
    : []

  return {
    portfolio_health: safeHealth,
    health_summary: String(d.health_summary ?? ''),
    per_trade_scorecard: perTradeScorecard,
    major_risks: Array.isArray(d.major_risks) ? d.major_risks.map(String).slice(0, 3) : [],
    best_performers: Array.isArray(d.best_performers) ? d.best_performers.slice(0, 3) : [],
    worst_performers: Array.isArray(d.worst_performers) ? d.worst_performers.slice(0, 3) : [],
    recommendations: Array.isArray(d.recommendations) ? d.recommendations.map(String).slice(0, 5) : [],
  }
}

/**
 * Export handler functions for use in route definitions
 * Each handler validates input, calls Claude, parses response, and returns JSON
 */
export {
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
  callClaudeWithCache,
}
