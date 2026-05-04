import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[privacyRoutes] Missing Supabase URL or anon key')
}

const anonClient = createClient(supabaseUrl, supabaseAnonKey)
const adminClient = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null

function isRelationMissing(error) {
  if (!error) return false
  const code = error.code || ''
  const msg = String(error.message || '').toLowerCase()
  return code === '42P01' || msg.includes('relation') && msg.includes('does not exist')
}

async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.slice(7)
  const { data, error } = await anonClient.auth.getUser(token)
  if (error || !data?.user?.id) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  req.user = data.user
  req.userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  next()
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function buildTradesCsv(trades) {
  const headers = [
    'Ticker',
    'Asset Type',
    'Direction',
    'Entry Price',
    'Exit Price',
    'Quantity',
    'Entry Date',
    'Exit Date',
    'P&L',
    'Risk %',
    'Setup Notes',
    'Status',
  ]

  const rows = trades.map((trade) => [
    trade.ticker,
    trade.asset_type,
    trade.direction,
    trade.entry_price,
    trade.exit_price || '',
    trade.quantity,
    trade.entry_date,
    trade.exit_date || '',
    trade.net_pnl || '',
    trade.risk_percent || '',
    trade.setup_notes || '',
    trade.status,
  ])

  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Export rate limit exceeded. You can export again in 1 hour.' },
})

const deleteLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Delete-account rate limit exceeded. Try again in 24 hours.' },
})

export function registerPrivacyRoutes(app) {
  app.post('/api/privacy/export-json', authenticateRequest, exportLimiter, async (req, res) => {
    try {
      const userId = req.user.id
      const [profile, accounts, trades, journals, auditLogs] = await Promise.all([
        req.userClient.from('profiles').select('*').eq('id', userId).single(),
        req.userClient.from('accounts').select('*').eq('user_id', userId),
        req.userClient.from('trades').select('*').eq('user_id', userId).order('entry_date', { ascending: false }),
        req.userClient.from('daily_journals').select('*').eq('user_id', userId).order('date', { ascending: false }),
        req.userClient.from('audit_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ])

      const exportData = {
        exportDate: new Date().toISOString(),
        profile: profile.data,
        accounts: accounts.data || [],
        trades: trades.data || [],
        journals: journals.data || [],
        auditLogs: auditLogs.data || [],
      }

      await req.userClient.from('audit_logs').insert({
        user_id: userId,
        action: 'EXPORT_DATA',
        details: { format: 'JSON', source: 'server' },
        user_agent: req.get('user-agent') || null,
        created_at: new Date().toISOString(),
      })

      res.json({
        fileName: `stock-journal-export-${new Date().toISOString().slice(0, 10)}.json`,
        payload: exportData,
      })
    } catch (error) {
      console.error('[privacy/export-json] error:', error)
      res.status(500).json({ error: 'Failed to export JSON data' })
    }
  })

  app.post('/api/privacy/export-csv', authenticateRequest, exportLimiter, async (req, res) => {
    try {
      const userId = req.user.id
      const { data: trades, error } = await req.userClient
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })

      if (error) throw error

      const csv = buildTradesCsv(trades || [])

      await req.userClient.from('audit_logs').insert({
        user_id: userId,
        action: 'EXPORT_DATA',
        details: { format: 'CSV', source: 'server', rows: (trades || []).length },
        user_agent: req.get('user-agent') || null,
        created_at: new Date().toISOString(),
      })

      res.json({
        fileName: `stock-journal-trades-${new Date().toISOString().slice(0, 10)}.csv`,
        csv,
      })
    } catch (error) {
      console.error('[privacy/export-csv] error:', error)
      res.status(500).json({ error: 'Failed to export CSV data' })
    }
  })

  app.post('/api/privacy/delete-account', authenticateRequest, deleteLimiter, async (req, res) => {
    if (!adminClient) {
      return res.status(500).json({
        error: 'Account deletion is not configured. Missing SUPABASE_SERVICE_ROLE_KEY.',
      })
    }

    const { confirmationText } = req.body || {}
    if (confirmationText !== 'DELETE') {
      return res.status(400).json({ error: 'Invalid confirmation text' })
    }

    const userId = req.user.id

    try {
      // Audit before destructive operations
      await req.userClient.from('audit_logs').insert({
        user_id: userId,
        action: 'DELETE_ACCOUNT',
        details: { source: 'server' },
        user_agent: req.get('user-agent') || null,
        created_at: new Date().toISOString(),
      })

      // Remove screenshot objects from storage (best effort)
      const { data: userTrades, error: tradesErr } = await adminClient
        .from('trades')
        .select('id')
        .eq('user_id', userId)

      if (tradesErr && !isRelationMissing(tradesErr)) throw tradesErr

      const tradeIds = (userTrades || []).map((t) => t.id)
      if (tradeIds.length > 0) {
        const { data: shots, error: shotsErr } = await adminClient
          .from('trade_screenshots')
          .select('storage_path')
          .in('trade_id', tradeIds)

        if (shotsErr && !isRelationMissing(shotsErr)) throw shotsErr

        const paths = (shots || []).map((s) => s.storage_path).filter(Boolean)
        if (paths.length > 0) {
          await adminClient.storage.from('trade-screenshots').remove(paths)
        }
      }

      // Delete user-owned relational data (best effort for optional tables)
      const tableDeletes = [
        ['daily_journals', 'user_id'],
        ['weekly_digests', 'user_id'],
        ['open_position_analyses', 'user_id'],
        ['audit_logs', 'user_id'],
        ['user_subscriptions', 'user_id'],
        ['subscription_logs', 'user_id'],
        ['accounts', 'user_id'],
        ['trades', 'user_id'],
      ]

      for (const [table, key] of tableDeletes) {
        const { error } = await adminClient.from(table).delete().eq(key, userId)
        if (error && !isRelationMissing(error)) throw error
      }

      const { data: userStrategies, error: stratErr } = await adminClient
        .from('strategies')
        .select('id')
        .eq('user_id', userId)
      if (stratErr && !isRelationMissing(stratErr)) throw stratErr

      const strategyIds = (userStrategies || []).map((s) => s.id)
      if (strategyIds.length > 0) {
        const { error: stratShotsErr } = await adminClient
          .from('strategy_screenshots')
          .delete()
          .in('strategy_id', strategyIds)
        if (stratShotsErr && !isRelationMissing(stratShotsErr)) throw stratShotsErr
      }

      const { error: stratDeleteErr } = await adminClient.from('strategies').delete().eq('user_id', userId)
      if (stratDeleteErr && !isRelationMissing(stratDeleteErr)) throw stratDeleteErr

      const { error: profileErr } = await adminClient.from('profiles').delete().eq('id', userId)
      if (profileErr && !isRelationMissing(profileErr)) throw profileErr

      const { error: authDeleteErr } = await adminClient.auth.admin.deleteUser(userId)
      if (authDeleteErr) throw authDeleteErr

      return res.json({ success: true })
    } catch (error) {
      console.error('[privacy/delete-account] error:', error)
      return res.status(500).json({ error: 'Failed to fully delete account' })
    }
  })
}
