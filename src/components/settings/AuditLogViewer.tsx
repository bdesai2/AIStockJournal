import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { fetchAuditLogs } from '@/lib/auditLog'
import type { AuditLog } from '@/lib/auditLog'
import { Clock } from 'lucide-react'

export function AuditLogViewer() {
  const { user } = useAuthStore()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.id) {
      loadLogs()
    }
  }, [user?.id])

  const loadLogs = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const auditLogs = await fetchAuditLogs(user.id)
      setLogs(auditLogs)
    } finally {
      setLoading(false)
    }
  }

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      EXPORT_DATA: '📥 Data Export',
      DELETE_ACCOUNT: '🗑️ Account Deleted',
      DELETE_TRADE: '❌ Trade Deleted',
      LOGIN: '🔓 Logged In',
      LOGOUT: '🔐 Logged Out',
      PROFILE_UPDATE: '✏️ Profile Updated',
      ACCOUNT_CREATE: '➕ Account Created',
      ACCOUNT_DELETE: '🗑️ Account Deleted',
      TRADE_CREATE: '✅ Trade Created',
      TRADE_EDIT: '✏️ Trade Edited',
    }
    return labels[action] || action
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Activity Log (Last 90 Days)
        </span>
      </div>

      {loading ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Loading activity...
        </div>
      ) : logs.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          No activity recorded yet
        </div>
      ) : (
        <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="px-4 py-2.5 text-xs hover:bg-accent/30 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {getActionLabel(log.action)}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {formatDate(log.created_at)}
                  </p>
                </div>
                {log.user_agent && (
                  <p className="text-muted-foreground/60 text-right max-w-xs truncate">
                    {log.user_agent.split(' ').slice(-2).join(' ')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2 border-t border-border/50 bg-card/50">
        <p className="text-xs text-muted-foreground">
          Logs retained for 90 days. Sensitive actions (exports, deletions) retained for 1 year.
        </p>
      </div>
    </div>
  )
}
