import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfile } from '@/types'
import { supabase, db } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  initialized: boolean

  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (v: boolean) => void
  setInitialized: (v: boolean) => void
  fetchProfile: (userId: string) => Promise<void>
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),

  fetchProfile: async (userId: string) => {
    const { data, error } = await db
      .profiles()
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) {
      set({ profile: data as UserProfile })
    }
  },

  reset: () =>
    set({ user: null, session: null, profile: null, loading: false }),
}))

// ─── Bootstrap auth on app load ───────────────────────────────────────────────

export async function initAuth() {
  const store = useAuthStore.getState()

  const { data: { session } } = await supabase.auth.getSession()

  if (session?.user) {
    store.setUser(session.user)
    store.setSession(session)
    await store.fetchProfile(session.user.id)
  }

  store.setLoading(false)
  store.setInitialized(true)

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (_event, session) => {
    store.setSession(session)
    store.setUser(session?.user ?? null)
    if (session?.user) {
      await store.fetchProfile(session.user.id)
    } else {
      store.setProfile(null)
    }
  })
}
