import { create } from 'zustand'

export type NotificationVariant = 'info' | 'success' | 'warning' | 'error'

export type NotificationKind =
  | 'trade_created'
  | 'trade_updated'
  | 'trade_deleted'
  | 'trade_status_changed'
  | 'execution_added'
  | 'execution_updated'
  | 'execution_deleted'
  | 'screenshot_uploaded'
  | 'screenshot_deleted'
  | 'journal_saved'
  | 'ai_graded'
  | 'weekly_digest_ready'
  | 'analysis_ready'

export interface Notification {
  id: string
  kind: NotificationKind
  variant: NotificationVariant
  title: string
  message: string
  createdAt: string
  tradeId?: string
}

interface NotificationState {
  notifications: Notification[]
  push: (input: Omit<Notification, 'id' | 'createdAt'>) => void
  dismiss: (id: string) => void
  clearAll: () => void
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  push: (input) => {
    const id = createId()
    const createdAt = new Date().toISOString()
    const notification: Notification = { ...input, id, createdAt }

    set((state) => ({ notifications: [notification, ...state.notifications].slice(0, 8) }))

    const timeout = 5000
    if (timeout > 0 && typeof window !== 'undefined') {
      window.setTimeout(() => {
        const { dismiss } = get()
        dismiss(id)
      }, timeout)
    }
  },

  dismiss: (id) =>
    set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),

  clearAll: () => set({ notifications: [] }),
}))
