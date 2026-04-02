import { createClient } from '@supabase/supabase-js'
import type { Trade, UserProfile, DailyJournal, TradeScreenshot } from '@/types'

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

// ─── Typed query helpers ───────────────────────────────────────────────────────

export const db = {
  trades: () => supabase.from('trades'),
  profiles: () => supabase.from('profiles'),
  journals: () => supabase.from('daily_journals'),
  screenshots: () => supabase.from('trade_screenshots'),
} as const

// ─── Storage helpers ───────────────────────────────────────────────────────────

export const storage = {
  screenshots: supabase.storage.from('trade-screenshots'),

  async uploadScreenshot(
    userId: string,
    tradeId: string,
    file: File,
    label?: string
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

    const { data } = supabase.storage.from('trade-screenshots').getPublicUrl(path)
    return { url: data.publicUrl, path }
  },

  async deleteScreenshot(path: string): Promise<boolean> {
    const { error } = await supabase.storage.from('trade-screenshots').remove([path])
    return !error
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

export type { Trade, UserProfile, DailyJournal, TradeScreenshot }
