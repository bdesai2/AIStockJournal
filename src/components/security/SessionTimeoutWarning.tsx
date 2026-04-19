import { useState, useEffect } from 'react'
import { AlertTriangle, LogOut } from 'lucide-react'
import { useSessionTimeout, formatTimeRemaining } from '@/hooks/useSessionTimeout'

export function SessionTimeoutWarning() {
  const [showWarning, setShowWarning] = useState(false)
  const [minutesRemaining, setMinutesRemaining] = useState(5)
  const { extendSession, setOnWarning, setOnTimeout } = useSessionTimeout()

  useEffect(() => {
    setOnWarning(() => {
      setShowWarning(true)
      // Update countdown every second
      const interval = setInterval(() => {
        setMinutesRemaining((prev) => {
          const newVal = prev - 1 / 60
          if (newVal <= 0) {
            clearInterval(interval)
            return 0
          }
          return newVal
        })
      }, 1000)
    })

    setOnTimeout(() => {
      // Will auto-logout via useSessionTimeout hook
    })
  }, [setOnWarning, setOnTimeout])

  if (!showWarning) {
    return null
  }

  const handleExtend = () => {
    extendSession()
    setShowWarning(false)
    setMinutesRemaining(5)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[10001] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card rounded-lg border border-destructive/50 max-w-sm w-full animate-in slide-in-from-bottom-4">
        {/* Icon & Title */}
        <div className="px-6 py-4 border-b border-destructive/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-foreground">Session Expiring</h2>
            <p className="text-sm text-muted-foreground mt-1">
              You've been inactive for a while. Your session will expire for security.
            </p>
          </div>
        </div>

        {/* Countdown */}
        <div className="px-6 py-4 bg-destructive/5">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Time remaining:</p>
            <p className="text-2xl font-mono font-bold text-destructive">
              {formatTimeRemaining(minutesRemaining)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-destructive/20 flex gap-2">
          <button
            onClick={handleExtend}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Stay Logged In
          </button>
          <button
            onClick={() => {
              window.location.href = '/auth/login'
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-destructive/20 text-destructive rounded-md px-4 py-2 text-sm font-medium hover:bg-destructive/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* Security Note */}
        <div className="px-6 py-3 bg-accent/20 text-xs text-muted-foreground border-t border-destructive/10">
          This protects your account from unauthorized access if your device is left unattended.
        </div>
      </div>
    </div>
  )
}
