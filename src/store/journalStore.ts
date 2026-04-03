import { create } from 'zustand'
import { db } from '@/lib/supabase'
import type { DailyJournal } from '@/types'

type JournalUpdateData = Partial<
  Pick<
    DailyJournal,
    | 'pre_market_notes'
    | 'post_market_notes'
    | 'market_mood'
    | 'personal_mood'
    | 'goals'
    | 'reviewed_rules'
  >
>

interface JournalState {
  journals: Record<string, DailyJournal>
  loading: boolean
  error: string | null
  fetchJournalsForMonth: (userId: string, year: number, month: number) => Promise<void>
  upsertJournal: (userId: string, date: string, data: JournalUpdateData) => Promise<void>
  clearError: () => void
}

export const useJournalStore = create<JournalState>((set) => ({
  journals: {},
  loading: false,
  error: null,

  fetchJournalsForMonth: async (userId, year, month) => {
    set({ loading: true, error: null })
    const m = String(month).padStart(2, '0')
    const start = `${year}-${m}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`

    const { data, error } = await db
      .journals()
      .select('*')
      .eq('user_id', userId)
      .gte('date', start)
      .lte('date', end)

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const patch: Record<string, DailyJournal> = {}
    for (const j of data ?? []) {
      patch[(j as DailyJournal).date] = j as DailyJournal
    }

    set((state) => ({ loading: false, journals: { ...state.journals, ...patch } }))
  },

  upsertJournal: async (userId, date, data) => {
    const { data: result, error } = await db
      .journals()
      .upsert({ user_id: userId, date, ...data }, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (error) {
      set({ error: error.message })
      return
    }

    if (result) {
      const journal = result as DailyJournal
      set((state) => ({
        journals: { ...state.journals, [journal.date]: journal },
      }))
    }
  },

  clearError: () => set({ error: null }),
}))
