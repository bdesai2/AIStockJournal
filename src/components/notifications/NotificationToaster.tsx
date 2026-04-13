import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react'
import { useNotificationStore } from '@/store/notificationStore'
import { cn } from '@/lib/utils'

function iconForVariant(variant: 'info' | 'success' | 'warning' | 'error') {
  switch (variant) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-300" />
    case 'error':
      return <XCircle className="w-4 h-4 text-red-400" />
    case 'info':
    default:
      return <Info className="w-4 h-4 text-sky-300" />
  }
}

export function NotificationToaster() {
  const { notifications, dismiss } = useNotificationStore()

  if (!notifications.length) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-end px-4 py-6 pointer-events-none">
      <div className="flex flex-col gap-2 w-full max-w-sm ml-auto pointer-events-auto">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={cn(
              'rounded-md border border-border bg-card/95 backdrop-blur px-3 py-2.5 shadow-lg flex items-start gap-2 text-xs',
            )}
          >
            <div className="mt-0.5 flex-shrink-0">{iconForVariant(n.variant)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[11px] leading-tight truncate">{n.title}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-3">
                {n.message}
              </p>
            </div>
            <button
              onClick={() => dismiss(n.id)}
              className="ml-1 mt-0.5 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
