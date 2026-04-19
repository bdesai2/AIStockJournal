import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfile, Account, UserSubscription } from '@/types'
import { supabase, db } from '@/lib/supabase'
import {
  createCheckoutSession,
  startProTrial,
  cancelSubscription,
} from '@/lib/stripe'

interface AuthState {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  initialized: boolean

  // Multi-account support
  accounts: Account[]
  selectedAccountId: string | null
  selectedAccount: Account | null

  // Subscription & billing (M6.5)
  subscription: UserSubscription | null
  subscriptionLoading: boolean

  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setProfile: (profile: UserProfile | null) => void
  setLoading: (v: boolean) => void
  setInitialized: (v: boolean) => void
  setSelectedAccount: (accountId: string) => void
  fetchProfile: (userId: string) => Promise<void>
  fetchAccounts: (userId: string) => Promise<void>
  createAccount: (userId: string, name: string, startingBalance: number, broker?: string) => Promise<Account | null>
  deleteAccount: (accountId: string) => Promise<boolean>
  updateAccount: (accountId: string, updates: Partial<Account>) => Promise<boolean>

  // Subscription methods
  fetchSubscription: (userId: string) => Promise<void>
  upgradeToProTrial: () => Promise<void>
  upgradeToProMonthly: (billingCycle: 'monthly' | 'annual') => Promise<void>
  cancelProSubscription: () => Promise<void>

  reset: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  initialized: false,
  accounts: [],
  selectedAccountId: null,
  selectedAccount: null,
  subscription: null,
  subscriptionLoading: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setInitialized: (initialized) => set({ initialized }),

  setSelectedAccount: (accountId: string) => {
    const state = get()
    const account = state.accounts.find((a) => a.id === accountId)
    if (account) {
      set({ selectedAccountId: accountId, selectedAccount: account })
      // Persist to localStorage
      localStorage.setItem('selectedAccountId', accountId)
    }
  },

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

  fetchAccounts: async (userId: string) => {
    const { data, error } = await db
      .accounts()
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      set({ accounts: data as Account[] })

      // Select first account or last selected from localStorage
      const lastSelectedId = localStorage.getItem('selectedAccountId')
      const accountToSelect = lastSelectedId
        ? data.find((a: Account) => a.id === lastSelectedId)
        : data[0]

      if (accountToSelect) {
        const state = get()
        state.setSelectedAccount(accountToSelect.id)
      }
    }
  },

  createAccount: async (userId: string, name: string, startingBalance: number, broker?: string) => {
    const { data, error } = await db.accounts().insert({
      user_id: userId,
      account_name: name,
      starting_balance: startingBalance,
      broker,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select('*').single()

    if (!error && data) {
      const newAccount = data as Account
      const state = get()
      set({ accounts: [...state.accounts, newAccount] })
      // Auto-select the new account
      state.setSelectedAccount(newAccount.id)
      return newAccount
    }
    return null
  },

  deleteAccount: async (accountId: string) => {
    const { error } = await db.accounts().delete().eq('id', accountId)

    if (!error) {
      const state = get()
      const updatedAccounts = state.accounts.filter((a) => a.id !== accountId)
      set({ accounts: updatedAccounts })

      // If deleted account was selected, select the first remaining account
      if (state.selectedAccountId === accountId) {
        if (updatedAccounts.length > 0) {
          state.setSelectedAccount(updatedAccounts[0].id)
        } else {
          set({ selectedAccountId: null, selectedAccount: null })
        }
      }
      return true
    }
    return false
  },

  updateAccount: async (accountId: string, updates: Partial<Account>) => {
    const { error } = await db
      .accounts()
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)

    if (!error) {
      const state = get()
      const updatedAccounts = state.accounts.map((a) =>
        a.id === accountId ? { ...a, ...updates } : a
      )
      set({ accounts: updatedAccounts })

      // Update selected account if it was modified
      if (state.selectedAccountId === accountId) {
        const updatedSelected = updatedAccounts.find((a) => a.id === accountId)
        if (updatedSelected) {
          set({ selectedAccount: updatedSelected })
        }
      }
      return true
    }
    return false
  },

  // ─── Subscription Methods ──────────────────────────────────────────────────────

  fetchSubscription: async (userId: string) => {
    try {
      set({ subscriptionLoading: true })

      console.log('[fetchSubscription] Fetching for userId:', userId)

      // Query Supabase directly for user subscription with tier info
      const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      console.log('[fetchSubscription] subData:', subData)
      console.log('[fetchSubscription] subError:', subError)

      // If no subscription record exists, default to free
      if (subError?.code === 'PGRST116' || !subData) {
        console.log('[fetchSubscription] No subscription record, defaulting to free')
        set({
          subscription: {
            tier: 'free',
            status: 'active',
            startDate: null,
            renewalDate: null,
            trialEndsAt: null,
            earlyAdopterDiscount: false,
          },
        })
        return
      }

      if (subError && subError.code !== 'PGRST116') {
        throw subError
      }

      // Get the tier name
      let tierName = 'free'
      if (subData.tier_id) {
        console.log('[fetchSubscription] Looking up tier for tier_id:', subData.tier_id)
        const { data: tierData, error: tierError } = await supabase
          .from('subscription_tiers')
          .select('name')
          .eq('id', subData.tier_id)
          .single()

        console.log('[fetchSubscription] tierData:', tierData)
        console.log('[fetchSubscription] tierError:', tierError)

        if (tierData?.name) {
          tierName = tierData.name
          console.log('[fetchSubscription] Set tierName to:', tierName)
        } else {
          console.log('[fetchSubscription] No name in tierData, keeping default free')
        }
      } else {
        console.log('[fetchSubscription] subData.tier_id is null/undefined')
      }

      console.log('[fetchSubscription] Final subscription state:', {
        tier: tierName,
        status: subData.status,
      })

      set({
        subscription: {
          tier: (tierName as 'free' | 'pro') || 'free',
          status: subData.status as any,
          startDate: subData.start_date,
          renewalDate: subData.renewal_date,
          trialEndsAt: subData.trial_end_date,
          earlyAdopterDiscount: subData.early_adopter_discount || false,
        },
      })
    } catch (error) {
      console.error('[fetchSubscription] Error:', error)
      // Default to free tier if fetch fails
      set({
        subscription: {
          tier: 'free',
          status: 'active',
          startDate: null,
          renewalDate: null,
          trialEndsAt: null,
          earlyAdopterDiscount: false,
        },
      })
    } finally {
      set({ subscriptionLoading: false })
    }
  },

  upgradeToProTrial: async () => {
    try {
      set({ subscriptionLoading: true })
      await startProTrial()
      // Refresh subscription data
      const state = get()
      if (state.user) {
        await state.fetchSubscription(state.user.id)
      }
    } catch (error) {
      console.error('Failed to start trial:', error)
      throw error
    } finally {
      set({ subscriptionLoading: false })
    }
  },

  upgradeToProMonthly: async (billingCycle: 'monthly' | 'annual') => {
    try {
      set({ subscriptionLoading: true })
      const sessionId = await createCheckoutSession(billingCycle)
      // Redirect handled by stripe.ts
      const { redirectToCheckout } = await import('@/lib/stripe')
      await redirectToCheckout(sessionId)
    } catch (error) {
      console.error('Failed to create checkout session:', error)
      throw error
    } finally {
      set({ subscriptionLoading: false })
    }
  },

  cancelProSubscription: async () => {
    try {
      set({ subscriptionLoading: true })
      await cancelSubscription()
      // Refresh subscription data
      const state = get()
      if (state.user) {
        await state.fetchSubscription(state.user.id)
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error)
      throw error
    } finally {
      set({ subscriptionLoading: false })
    }
  },

  reset: () =>
    set({
      user: null,
      session: null,
      profile: null,
      accounts: [],
      selectedAccountId: null,
      selectedAccount: null,
      subscription: null,
      loading: false,
    }),
}))

// ─── Bootstrap auth on app load ───────────────────────────────────────────────

export async function initAuth() {
  const store = useAuthStore.getState()

  const { data: { session } } = await supabase.auth.getSession()

  if (session?.user) {
    store.setUser(session.user)
    store.setSession(session)
    await store.fetchProfile(session.user.id)
    await store.fetchAccounts(session.user.id)
    await store.fetchSubscription(session.user.id)
  }

  store.setLoading(false)
  store.setInitialized(true)

  // Listen for auth changes
  supabase.auth.onAuthStateChange(async (_event, session) => {
    store.setSession(session)
    store.setUser(session?.user ?? null)
    if (session?.user) {
      await store.fetchProfile(session.user.id)
      await store.fetchAccounts(session.user.id)
      await store.fetchSubscription(session.user.id)
    } else {
      store.reset()
    }
  })
}
