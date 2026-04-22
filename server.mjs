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
import rateLimit from 'express-rate-limit'
import Anthropic from '@anthropic-ai/sdk'
import { registerAiRoutes } from './lib/aiRoutes.mjs'
import { registerFinnhubProxyRoutes } from './lib/finnhubProxy.mjs'
import { registerStripeRoutes } from './lib/stripeRoutes.mjs'

// ─── Initialize Express & Configuration ────────────────────────────────────

const app = express()
const PORT = process.env.PORT || 3001

// ─── H1: Restrict CORS to known origins only ─────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.VITE_APP_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin) and known origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// ─── H6: Request size limits ──────────────────────────────────────────────
// Custom middleware: raw body for Stripe webhook, 10 kb JSON for everything else
app.use((req, res, next) => {
  if (req.path === '/api/stripe/webhook') {
    return express.raw({ type: 'application/json', limit: '1mb' })(req, res, next)
  }
  express.json({ limit: '10kb' })(req, res, next)
})

// ─── M4: Rate limiting ────────────────────────────────────────────────────
// General API limiter: 2 req/min per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})

// AI limiter: 10 req/min per IP (expensive Claude calls)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded, please wait before retrying' },
})

app.use('/api/ai/', aiLimiter)
app.use('/api/', apiLimiter)

// ─── L3: Debug logging (dev only) ────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/ai/')) {
      console.log(`\n📥 ${req.method} ${req.path}`)
      console.log('   Content-Type:', req.get('content-type'))
    }
    next()
  })
}

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
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Trading journal server listening on http://localhost:${PORT}`)
    console.log(`  - AI routes: /api/ai/grade-trade, /api/ai/setup-check, /api/ai/trade-analysis, /api/ai/potential-trade, /api/ai/weekly-digest`)
    console.log(`  - Stock data (Finnhub): /api/yahoo/quote/:ticker, /api/yahoo/sector/:ticker`)
    console.log(`  - Stripe routes: /api/stripe/checkout-session, /api/stripe/portal-session, /api/stripe/cancel-subscription, /api/stripe/start-trial, /api/stripe/subscription-details, /api/stripe/webhook`)
  } else {
    console.log(`Server started on port ${PORT}`)
  }
})
