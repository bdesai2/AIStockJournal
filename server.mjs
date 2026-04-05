import 'dotenv/config'
import express from 'express'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
const PORT = process.env.PORT || 3001

// Parse JSON request bodies — REQUIRED for AI routes
app.use(express.json())

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
// Use a model that supports prompt caching (claude-3-5-sonnet or later)
const AI_MODEL = 'claude-3-5-sonnet-20241022'

// ─── System Prompts with Caching ──────────────────────────────────────────────

const SYSTEM_PROMPTS = {
  SYSTEM_PROMPT_TRADE_ANALYSIS: `You are a professional trade analysis AI. Analyze trades using current market knowledge, recent news, and macro environment. Return ONLY valid JSON with no prose or markdown fences.

Expected JSON structure:
{
  "market_overview": "<1-2 sentences on current market condition>",
  "current_price_estimate": <estimated current price as number>,
  "estimated_pnl": <P&L estimate as number>,
  "estimated_pnl_percent": <percentage as number>,
  "bullish_factors": ["<factor 1>", "<factor 2>"],
  "bearish_factors": ["<factor 1>", "<factor 2>"],
  "technical_outlook": "<1-2 sentences>",
  "recommendation": "<hold|reduce|exit|add>",
  "confidence": "<low|moderate|high>",
  "next_key_levels": {"resistance": <number>, "support": <number>}
}`,

  SYSTEM_PROMPT_CLOSED_GRADE: `You are a professional trading coach reviewing completed trades. Provide constructive, specific feedback based on the trade data provided. Respond ONLY with valid JSON — no prose, no markdown fences.

Expected JSON structure:
{
  "grade": "<one of: A+, A, B+, B, C+, C, D, F>",
  "setup_score": <integer 0-100>,
  "rationale": "<2-3 sentences explaining the grade. Be direct and specific to the numbers.>",
  "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "<actionable suggestion 3>"]
}`,

  SYSTEM_PROMPT_WEEKLY_DIGEST: `You are a trading performance coach doing weekly reviews. Analyze patterns in trade performance, emotional responses, and execution. Respond ONLY with valid JSON — no prose, no markdown fences.

Expected JSON structure:
{
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
}`,

  SYSTEM_PROMPT_SETUP_CHECK: `You are a trading risk manager doing pre-trade setup validation. Evaluate risk/reward ratios, position sizing, and trade structure. Respond ONLY with valid JSON — no prose, no markdown fences.

Expected JSON structure:
{
  "rr_rating": "<poor|acceptable|good|excellent>",
  "rr_comment": "<one sentence on the R/R ratio>",
  "setup_quality": "<weak|moderate|strong>",
  "setup_comment": "<one sentence on the overall setup>",
  "position_size_note": "<one sentence suggestion on sizing, or 'Set a stop loss to calculate'>",
  "warnings": ["<warning if any critical issue, otherwise empty array>"]
}`,

  SYSTEM_PROMPT_POTENTIAL_TRADE: `You are a trading setup identifier. Analyze potential trade opportunities and evaluate their risk/reward profile. Respond ONLY with valid JSON — no prose, no markdown fences.

Expected JSON structure:
{
  "setup_quality": "<weak|moderate|strong|excellent>",
  "rr_potential": <risk/reward ratio as number>,
  "key_levels": {"entry": <number>, "stop": <number>, "target": <number>},
  "bullish_case": "<2-3 sentences>",
  "bearish_case": "<2-3 sentences>",
  "probability": "<low|medium|high>",
  "recommendation": "<pass|watch|consider|strong buy>"
}`
}

// ─── Health Check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.json({ status: 'ok' })
})

// ─── Utility: Safe JSON Parser ────────────────────────────────────────────────

function safeParseJSON(raw) {
  // Strip markdown fences if Claude ignores the "JSON only" instruction
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(cleaned)
}

// ─── AI: Grade Trade ──────────────────────────────────────────────────────────

function buildGradePrompt(trade) {
  const rr = trade.stop_loss && trade.take_profit
    ? ((trade.take_profit - trade.entry_price) / (trade.entry_price - trade.stop_loss)).toFixed(2)
    : 'N/A'

  return `Trade data:
- Ticker: ${trade.ticker} (${trade.asset_type}, ${trade.direction})
- Entry: $${trade.entry_price} on ${trade.entry_date}
- Exit: $${trade.exit_price} on ${trade.exit_date}
- Quantity: ${trade.quantity}
- Net P&L: $${trade.net_pnl ?? 'N/A'}
- R-Multiple: ${trade.r_multiple ?? 'N/A'}
- Stop Loss: ${trade.stop_loss ?? 'not set'} | Take Profit: ${trade.take_profit ?? 'not set'}
- Risk/Reward Ratio: ${rr}
- Strategy Tags: ${(trade.strategy_tags ?? []).join(', ') || 'none'}
- Setup Notes: ${trade.setup_notes || 'none'}
- Mistakes: ${trade.mistakes || 'none'}
- Emotional State: ${trade.emotional_state || 'not recorded'}
- Execution Quality (self-rated): ${trade.execution_quality ?? 'not rated'}

Evaluate this trade and respond with exactly this JSON structure:
{
  "grade": "<one of: A+, A, B+, B, C+, C, D, F>",
  "setup_score": <integer 0-100>,
  "rationale": "<2-3 sentences explaining the grade. Be direct and specific to the numbers.>",
  "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>", "<actionable suggestion 3>"]
}`
}

function parseGradeResponse(raw) {
  const d = safeParseJSON(raw)
  return {
    grade: String(d.grade ?? 'C'),
    setup_score: Math.max(0, Math.min(100, Number(d.setup_score ?? 50))),
    rationale: String(d.rationale ?? ''),
    suggestions: Array.isArray(d.suggestions) ? d.suggestions.map(String) : [],
  }
}

app.post('/api/ai/grade-trade', async (req, res) => {
  const trade = req.body?.trade
  if (!trade?.ticker || !trade?.status) {
    return res.status(400).json({ error: 'trade object with ticker and status required' })
  }
  if (trade.status !== 'closed') {
    return res.status(400).json({ error: 'only closed trades can be graded' })
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      system: [
        {
          type: 'text', text: SYSTEM_PROMPTS.SYSTEM_PROMPT_CLOSED_GRADE,
          cache_control: { type: 'ephemeral', ttl: '1hr' },
        },
      ],
      messages: [{ role: 'user', content: buildGradePrompt(trade) }],
    })

    const raw = message.content[0].text
    const parsed = parseGradeResponse(raw)
    res.json({ ...parsed, model: AI_MODEL })
  } catch (err) {
    console.error('Claude grade-trade error:', err)
    res.status(502).json({ error: 'AI service unavailable' })
  }
})

// ─── AI: Setup Check ──────────────────────────────────────────────────────────

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

app.post('/api/ai/setup-check', async (req, res) => {
  const { ticker, entry_price, stop_loss, take_profit, direction, quantity } = req.body ?? {}
  if (!ticker || !entry_price) {
    return res.status(400).json({ error: 'ticker and entry_price required' })
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 384,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPTS.SYSTEM_PROMPT_SETUP_CHECK,
          cache_control: { type: 'ephemeral', ttl: '1hr' },
        },
      ],
      messages: [{ role: 'user', content: buildSetupCheckPrompt({ ticker, entry_price, stop_loss, take_profit, direction, quantity }) }],
    })

    const raw = message.content[0].text
    const parsed = parseSetupCheckResponse(raw)
    res.json(parsed)
  } catch (err) {
    console.error('Claude setup-check error:', err)
    res.status(502).json({ error: 'AI service unavailable' })
  }
})
// ─── AI: Trade Analysis Prompt ────────────────────────────────────────────────
function buildTradePrompt(trade) {
  const {
    symbol,
    market_type,       // stock | option | etf | crypto
    side,              // long | short
    entry_date,
    entry_price,
    quantity,
    stop_loss,         // optional
    target_price,      // optional
    notes,             // optional — user's own trade notes
    confidence,        // optional — 0 to 10
  } = trade;

  const entryTotal = entry_price * quantity;
  const stopLossLine = stop_loss
    ? `Stop Loss: $${stop_loss}`
    : `Stop Loss: Not set`;
  const targetLine = target_price
    ? `Take Profit Target: $${target_price}`
    : `Take Profit Target: Not set`;
  const notesLine = notes
    ? `Trader Notes: ${notes}`
    : `Trader Notes: None provided`;
  const confidenceLine = confidence !== undefined
    ? `Entry Confidence (0-10): ${confidence}`
    : ``;

  return `TRADE DETAILS:
  Symbol: ${symbol}
  Asset Type: ${market_type}
  Direction: ${side}
  Entry Date: ${entry_date}
  Entry Price: $${entry_price}
  Quantity: ${quantity}
  Entry Total: $${entryTotal.toFixed(2)}
  ${stopLossLine}
  ${targetLine}
  ${confidenceLine}
  ${notesLine}

  Today's Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

  Analyze this trade using current market conditions, recent news, analyst price targets, and macro environment. Calculate estimated current P&L using best estimate of current market price.
  `.trim();
}

// Add API route for trade analysis (if not already exists)
app.post('/api/ai/trade-analysis', async (req, res) => {
  const trade = req.body?.trade
  if (!trade?.symbol || !trade?.entry_price) {
    return res.status(400).json({ error: 'trade object with symbol and entry_price required' })
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPTS.SYSTEM_PROMPT_TRADE_ANALYSIS,
          cache_control: { type: 'ephemeral', ttl: '1hr' },
        },
      ],
      messages: [{ role: 'user', content: buildTradePrompt(trade) }],
    })

    const raw = message.content[0].text
    const parsed = safeParseJSON(raw)
    res.json(parsed)
  } catch (err) {
    console.error('Claude trade-analysis error:', err)
    res.status(502).json({ error: 'AI service unavailable' })
  }
})

// ─── AI: Weekly Digest ────────────────────────────────────────────────────────

function buildDigestPrompt(trades) {
  const summary = trades.slice(0, 30).map(t =>
    `${t.ticker}|${t.direction}|${t.strategy_tags?.join(',')||''}|${t.net_pnl?.toFixed(2)||'0'}|${t.r_multiple?.toFixed(2)||'N/A'}|${t.emotional_state||''}|${t.mistakes||''}`
  ).join('\n')

  const winCount = trades.filter(t => (t.net_pnl ?? 0) > 0).length
  const totalPnl = trades.reduce((s, t) => s + (t.net_pnl ?? 0), 0)

  return `Last ${trades.length} closed trades summary (ticker|direction|strategies|net_pnl|r_multiple|emotion|mistakes):
${summary}

Overall: ${winCount}/${trades.length} wins, total P&L $${totalPnl.toFixed(2)}

Identify patterns and respond with exactly this JSON structure:
{
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

function parseDigestResponse(raw) {
  const d = safeParseJSON(raw)
  return {
    positive_patterns: Array.isArray(d.positive_patterns) ? d.positive_patterns : [],
    negative_patterns: Array.isArray(d.negative_patterns) ? d.negative_patterns : [],
    actionable_lesson: d.actionable_lesson ?? '',
  }
}

app.post('/api/ai/weekly-digest', async (req, res) => {
  const { trades } = req.body ?? {}
  if (!Array.isArray(trades) || trades.length === 0) {
    return res.status(400).json({ error: 'trades array required' })
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 640,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPTS.SYSTEM_PROMPT_WEEKLY_DIGEST,
          cache_control: { type: 'ephemeral', ttl: '1hr' },
        },
      ],
      messages: [{ role: 'user', content: buildDigestPrompt(trades) }],
    })

    const raw = message.content[0].text
    const parsed = parseDigestResponse(raw)
    res.json(parsed)
  } catch (err) {
    console.error('Claude weekly-digest error:', err)
    res.status(502).json({ error: 'AI service unavailable' })
  }
})

// ─── AI: Potential Trade ──────────────────────────────────────────────────────

function buildPotentialTradePrompt({ symbol, market_type, direction, proposed_entry, stop_level, target_level, notes }) {
  const rr = (stop_level && target_level)
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

app.post('/api/ai/potential-trade', async (req, res) => {
  const { symbol, market_type, direction, proposed_entry, stop_level, target_level, notes } = req.body ?? {}
  if (!symbol || !proposed_entry) {
    return res.status(400).json({ error: 'symbol and proposed_entry required' })
  }

  try {
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPTS.SYSTEM_PROMPT_POTENTIAL_TRADE,
          cache_control: { type: 'ephemeral', ttl: '1hr' },
        },
      ],
      messages: [{ role: 'user', content: buildPotentialTradePrompt({ symbol, market_type, direction, proposed_entry, stop_level, target_level, notes }) }],
    })

    const raw = message.content[0].text
    const parsed = safeParseJSON(raw)
    res.json(parsed)
  } catch (err) {
    console.error('Claude potential-trade error:', err)
    res.status(502).json({ error: 'AI service unavailable' })
  }
})

// ─── Proxy: Yahoo Finance Quote & Sector Lookup ───────────────────────────────

app.get('/api/yahoo/quote/:ticker', async (req, res) => {
  const ticker = (req.params.ticker || '').toUpperCase()

  if (!ticker) {
    res.status(400).json({ error: 'Ticker is required' })
    return
  }

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`

    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
      },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('Yahoo quote request failed:', response.status, response.statusText, text.slice(0, 200))
      // Gracefully degrade: return null price so frontend can hide unrealized P&L
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.json({ price: null })
      return
    }

    const json = await response.json()
    const quote = json?.quoteResponse?.result?.[0]
    const price = quote?.regularMarketPrice ?? null

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json({ price })
  } catch (err) {
    console.error('Error calling Yahoo Finance quote:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Sector lookup

app.get('/api/yahoo/sector/:ticker', async (req, res) => {
  const ticker = (req.params.ticker || '').toUpperCase()

  if (!ticker) {
    res.status(400).json({ error: 'Ticker is required' })
    return
  }

  try {
    const yahooUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker,
    )}?modules=assetProfile`

    const response = await fetch(yahooUrl, {
      headers: {
        // Some Yahoo endpoints are picky about User-Agent; use a browser-like one
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json, text/javascript, */*; q=0.01',
      },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error(
        'Yahoo request failed:',
        response.status,
        response.statusText,
        text.slice(0, 200),
      )
      res.status(response.status).json({ error: 'Yahoo request failed' })
      return
    }

    const json = await response.json()
    const sector =
      json?.quoteSummary?.result?.[0]?.assetProfile?.sector ?? null

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json({ sector })
  } catch (err) {
    console.error('Error calling Yahoo Finance:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.listen(PORT, () => {
  console.log(`Trading journal server listening on http://localhost:${PORT}`)
  console.log(`  - AI routes: /api/ai/grade-trade, /api/ai/setup-check, /api/ai/trade-analysis, /api/ai/potential-trade, /api/ai/weekly-digest`)
  console.log(`  - Yahoo proxy: /api/yahoo/quote/:ticker, /api/yahoo/sector/:ticker`)
})
