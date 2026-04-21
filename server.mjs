/**
 * Stock Journal Server
 * Main entry point - initializes Express, configures routes, starts server
 *
 * Architecture:
 * - lib/systemPrompts.mjs → System prompts for Claude (cached)
 * - lib/aiHandlers.mjs → Helper functions for building prompts & parsing responses
 * - lib/aiRoutes.mjs → Express route definitions for AI endpoints
 * - lib/finnhubProxy.mjs → Express route definitions for Finnhub stock data proxy
 * - lib/utils.mjs → Utility functions (JSON parsing, etc.)
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'
import { registerAiRoutes } from './lib/aiRoutes.mjs'
import { registerFinnhubProxyRoutes } from './lib/finnhubProxy.mjs'
import { registerStripeRoutes } from './lib/stripeRoutes.mjs'

// ─── Initialize Express & Configuration ────────────────────────────────────

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())

// Custom middleware: use raw body ONLY for Stripe webhook, use JSON for everything else
app.use((req, res, next) => {
  if (req.path === '/api/stripe/webhook') {
    // Stripe webhook needs raw body
    return express.raw({ type: 'application/json' })(req, res, next)
  }
  // Everything else uses JSON parsing
  express.json()(req, res, next)
})

// Debug middleware - log all requests
app.use((req, res, next) => {
  if (req.path.startsWith('/api/ai/')) {
    console.log(`\n📥 ${req.method} ${req.path}`)
    console.log('   Content-Type:', req.get('content-type'))
  }
  next()
})

// Health check endpoint
app.get('/health', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.json({ status: 'ok' })
})

// ─── Initialize Claude Client ─────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const AI_MODEL = 'claude-sonnet-4-6' // Supports prompt caching

// ─── Register Route Groups ──────────────────────────────────────────────────

registerAiRoutes(app, anthropic, AI_MODEL)
registerFinnhubProxyRoutes(app)
registerStripeRoutes(app)

// ─── Start Server ──────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Trading journal server listening on http://localhost:${PORT}`)
  console.log(`  - AI routes: /api/ai/grade-trade, /api/ai/setup-check, /api/ai/trade-analysis, /api/ai/potential-trade, /api/ai/weekly-digest`)
  console.log(`  - Stock data (Finnhub): /api/yahoo/quote/:ticker, /api/yahoo/sector/:ticker`)
  console.log(`  - Stripe routes: /api/stripe/checkout-session, /api/stripe/portal-session, /api/stripe/cancel-subscription, /api/stripe/start-trial, /api/stripe/subscription-details, /api/stripe/webhook`)
})
