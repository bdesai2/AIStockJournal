import { create } from 'zustand'
import { db } from '@/lib/supabase'
import type { DailyJournal } from '@/types'
import { useNotificationStore } from '@/store/notificationStore'
import {
  enqueueOfflineMutation,
  getOfflineQueue,
  markOfflineMutationFailed,
  removeOfflineMutation,
} from '@/lib/offlineQueue'
import { loadJournalsCache, saveJournalsCache } from '@/lib/offlineCache'

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
  flushQueuedMutations: () => Promise<number>
  clearError: () => void
}

function shouldQueueMutation(errorMessage: string): boolean {
  if (!navigator.onLine) return true
  return /network|offline|fetch|timeout|failed to fetch/i.test(errorMessage)
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
      const cached = await loadJournalsCache(userId, year, month).catch(() => null)
      if (cached?.length) {
        const patch: Record<string, DailyJournal> = {}
        for (const journal of cached) {
          patch[journal.date] = journal
        }
        set((state) => ({
          loading: false,
          journals: { ...state.journals, ...patch },
          error: `Offline mode: showing cached journals (${cached.length})`,
        }))
      } else {
        set({ loading: false, error: error.message })
      }
      return
    }

    const patch: Record<string, DailyJournal> = {}
    for (const j of data ?? []) {
      patch[(j as DailyJournal).date] = j as DailyJournal
    }

    set((state) => ({ loading: false, journals: { ...state.journals, ...patch } }))
    void saveJournalsCache(userId, year, month, Object.values(patch))
  },

  upsertJournal: async (userId, date, data) => {
    const { data: result, error } = await db
      .journals()
      .upsert({ user_id: userId, date, ...data }, { onConflict: 'user_id,date' })
      .select()
      .single()

    if (error) {
      if (shouldQueueMutation(error.message)) {
        enqueueOfflineMutation('journal', 'upsert', { userId, date, data })

        const optimistic: DailyJournal = {
          id: `${userId}-${date}`,
          user_id: userId,
          date,
          pre_market_notes: data.pre_market_notes ?? undefined,
          post_market_notes: data.post_market_notes ?? undefined,
          market_mood: data.market_mood ?? undefined,
          personal_mood: data.personal_mood ?? undefined,
          goals: data.goals ?? [],
          reviewed_rules: data.reviewed_rules ?? false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        set((state) => ({
          journals: { ...state.journals, [date]: optimistic },
          error: 'Offline: journal entry queued and will sync when online.',
        }))

        return
      }

      set({ error: error.message })
      return
    }

    if (result) {
      const journal = result as DailyJournal
      set((state) => ({
        journals: { ...state.journals, [journal.date]: journal },
      }))

      const { push } = useNotificationStore.getState()
      push({
        kind: 'journal_saved',
        variant: 'success',
        title: 'Journal saved',
        message: journal.date,
      })
    }
  },

  flushQueuedMutations: async () => {
    const queued = getOfflineQueue('journal')
    if (queued.length === 0) return 0

    let processed = 0

    for (const item of queued) {
      if (item.action !== 'upsert') continue

      try {
        const payload = item.payload as {
          userId: string
          date: string
          data: JournalUpdateData
        }

        await db
          .journals()
          .upsert(
            { user_id: payload.userId, date: payload.date, ...payload.data },
            { onConflict: 'user_id,date' }
          )

        removeOfflineMutation(item.id)
        processed += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync error'
        markOfflineMutationFailed(item, message)
        // Keep mutation in queue; it will retry later.
      }
    }

    if (processed > 0) {
      const { push } = useNotificationStore.getState()
      push({
        kind: 'journal_saved',
        variant: 'success',
        title: 'Offline journals synced',
        message: `${processed} queued journal change${processed === 1 ? '' : 's'} synchronized.`,
      })
    }

    return processed
  },

  clearError: () => set({ error: null }),
}))
