import { createClient } from '@supabase/supabase-js'
import type { Trade, UserProfile, DailyJournal, TradeScreenshot, Strategy, StrategyScreenshot } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// ─── Session management ───────────────────────────────────────────────────────

// Warn user if session is about to expire
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
    if (session?.expires_at) {
      const expiresAt = session.expires_at * 1000 // Convert to ms
      const now = Date.now()
      const timeUntilExpiry = expiresAt - now

      // If less than 5 minutes left, warn user
      if (timeUntilExpiry > 0 && timeUntilExpiry < 5 * 60 * 1000) {
        console.warn(`⚠️ Session expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes`)
      }
    }
  }
})


// ─── Typed query helpers ───────────────────────────────────────────────────────

export const db = {
  trades: () => supabase.from('trades'),
  profiles: () => supabase.from('profiles'),
  journals: () => supabase.from('daily_journals'),
  screenshots: () => supabase.from('trade_screenshots'),
  executions: () => supabase.from('trade_executions'),
  digests: () => supabase.from('weekly_digests'),
  strategies: () => supabase.from('strategies'),
  strategyScreenshots: () => supabase.from('strategy_screenshots'),
} as const

// ─── Storage helpers ───────────────────────────────────────────────────────────

export const storage = {
  screenshots: supabase.storage.from('trade-screenshots'),

  async uploadScreenshot(
    userId: string, tradeId: string, file: File, _label?: string
  ): Promise<{ url: string; path: string } | null> {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${tradeId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('trade-screenshots')
      .upload(path, file, { upsert: false })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    // Store a short-lived signed URL; fetchTrades regenerates them on every load
    const { data: signData, error: signError } = await supabase.storage
      .from('trade-screenshots')
      .createSignedUrl(path, 60 * 60 * 24) // 24 h — refreshed on next fetchTrades
    if (signError || !signData) return null
    return { url: signData.signedUrl, path }
  },

  async deleteScreenshot(path: string): Promise<boolean> {
    const { error } = await supabase.storage.from('trade-screenshots').remove([path])
    return !error
  },

  // Batch-refresh signed URLs for all screenshot paths in one round-trip
  async getSignedUrls(paths: string[]): Promise<Map<string, string>> {
    if (paths.length === 0) return new Map()
    const { data } = await supabase.storage
      .from('trade-screenshots')
      .createSignedUrls(paths, 60 * 60 * 24) // 24 h
    if (!data) return new Map()
    return new Map(
      data
        .filter((s): s is typeof s & { path: string; signedUrl: string } =>
          typeof s.path === 'string' && typeof s.signedUrl === 'string'
        )
        .map((s) => [s.path, s.signedUrl])
    )
  },
}

// ─── Auth helpers ──────────────────────────────────────────────────────────────

export const auth = {
  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    }),

  signInWithEmail: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signUpWithEmail: (email: string, password: string) =>
    supabase.auth.signUp({ email, password }),

  signOut: () => supabase.auth.signOut(),

  getSession: () => supabase.auth.getSession(),

  onAuthStateChange: (cb: Parameters<typeof supabase.auth.onAuthStateChange>[0]) =>
    supabase.auth.onAuthStateChange(cb),
}

export type { Trade, UserProfile, DailyJournal, TradeScreenshot, Strategy, StrategyScreenshot }
