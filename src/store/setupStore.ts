import { create } from 'zustand'
import type { Setup, SetupScreenshot } from '@/types'
import { db, storage } from '@/lib/supabase'

interface SetupState {
  setups: Setup[]
  loading: boolean
  error: string | null
  selectedSetup: Setup | null

  fetchSetups: (userId: string) => Promise<void>
  createSetup: (input: Omit<Setup, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'screenshots'> & { user_id: string }) => Promise<Setup | null>
  updateSetup: (id: string, patch: Partial<Omit<Setup, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'screenshots'>>) => Promise<Setup | null>
  deleteSetup: (id: string) => Promise<boolean>
  setSelectedSetup: (setup: Setup | null) => void
  uploadScreenshot: (userId: string, setupId: string, file: File, label?: string) => Promise<boolean>
  deleteScreenshot: (screenshotId: string, storagePath: string) => Promise<boolean>
  clearError: () => void
}

const SETUP_SELECT = '*, screenshots:setup_screenshots(*)'

export const useSetupStore = create<SetupState>((set, get) => ({
  setups: [],
  loading: false,
  error: null,
  selectedSetup: null,

  fetchSetups: async (userId: string) => {
    set({ loading: true, error: null })

    const { data, error } = await db
      .setups()
      .select(SETUP_SELECT)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      set({ error: error.message, loading: false })
      return
    }

    let setups = (data as Setup[]) ?? []

    const allPaths = setups
      .flatMap((s) => (s.screenshots as SetupScreenshot[] | undefined) ?? [])
      .map((s) => s.storage_path)
      .filter(Boolean)

    if (allPaths.length > 0) {
      const urlMap = await storage.getSignedUrls(allPaths)
      setups = setups.map((s) => ({
        ...s,
        screenshots: (s.screenshots as SetupScreenshot[] | undefined)?.map((shot) => ({
          ...shot,
          url: urlMap.get(shot.storage_path) ?? shot.url,
        })),
      }))
    }

    set({ setups, loading: false })
  },

  createSetup: async (input) => {
    set({ loading: true, error: null })

    const { data, error } = await db
      .setups()
      .insert({
        ...input,
        probability: input.probability ?? 'medium',
        tags: input.tags ?? [],
      })
      .select(SETUP_SELECT)
      .single()

    if (error) {
      set({ error: error.message, loading: false })
      return null
    }

    const created = data as Setup
    set((state) => ({
      setups: [created, ...state.setups],
      selectedSetup: created,
      loading: false,
    }))

    return created
  },

  updateSetup: async (id, patch) => {
    set({ loading: true, error: null })

    const { data, error } = await db
      .setups()
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(SETUP_SELECT)
      .single()

    if (error) {
      set({ error: error.message, loading: false })
      return null
    }

    const updated = data as Setup
    set((state) => ({
      setups: state.setups.map((s) => (s.id === id ? updated : s)),
      selectedSetup: state.selectedSetup?.id === id ? updated : state.selectedSetup,
      loading: false,
    }))

    return updated
  },

  deleteSetup: async (id) => {
    const setup = get().setups.find((s) => s.id === id)
    if (setup?.screenshots?.length) {
      for (const shot of setup.screenshots as SetupScreenshot[]) {
        await storage.deleteScreenshot(shot.storage_path)
      }
    }

    const { error } = await db
      .setups()
      .delete()
      .eq('id', id)

    if (error) {
      set({ error: error.message })
      return false
    }

    set((state) => ({
      setups: state.setups.filter((s) => s.id !== id),
      selectedSetup: state.selectedSetup?.id === id ? null : state.selectedSetup,
    }))

    return true
  },

  setSelectedSetup: (setup) => set({ selectedSetup: setup }),

  uploadScreenshot: async (userId, setupId, file, label) => {
    const result = await storage.uploadScreenshot(userId, setupId, file, label)
    if (!result) return false

    const { data, error } = await db
      .setupScreenshots()
      .insert({
        setup_id: setupId,
        user_id: userId,
        storage_path: result.path,
        url: result.url,
        label: label ?? null,
      })
      .select()
      .single()

    if (error) return false

    set((state) => ({
      setups: state.setups.map((s) =>
        s.id === setupId
          ? { ...s, screenshots: [...((s.screenshots as SetupScreenshot[] | undefined) ?? []), data as SetupScreenshot] }
          : s
      ),
    }))

    return true
  },

  deleteScreenshot: async (screenshotId, storagePath) => {
    await storage.deleteScreenshot(storagePath)

    const { error } = await db
      .setupScreenshots()
      .delete()
      .eq('id', screenshotId)

    if (error) return false

    set((state) => ({
      setups: state.setups.map((s) => ({
        ...s,
        screenshots: (s.screenshots as SetupScreenshot[] | undefined)?.filter((shot) => shot.id !== screenshotId),
      })),
    }))

    return true
  },

  clearError: () => set({ error: null }),
}))
