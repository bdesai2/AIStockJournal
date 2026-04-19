import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { auth } from '@/lib/supabase'

interface SessionConfig {
  warningMinutes: number  // Show warning when this many minutes left
  timeoutMinutes: number  // Auto logout after this many minutes
  checkFrequency: number  // Check session every N milliseconds
}

const DEFAULT_CONFIG: SessionConfig = {
  warningMinutes: 5,
  timeoutMinutes: 30,
  checkFrequency: 1000,
}

let timeoutTimer: NodeJS.Timeout | null = null
let warningTimer: NodeJS.Timeout | null = null
let lastActivityTime = Date.now()

/**
 * Hook to manage session timeout
 * Shows expiry warning and auto-logs out after inactivity
 */
export function useSessionTimeout(config: Partial<SessionConfig> = {}) {
  const { user } = useAuthStore()
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const isWarningShownRef = useRef(false)
  const onWarningRef = useRef<(() => void) | null>(null)
  const onTimeoutRef = useRef<(() => void) | null>(null)

  // Register activity listener
  useEffect(() => {
    const handleActivity = () => {
      lastActivityTime = Date.now()
      isWarningShownRef.current = false
    }

    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ]

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [])

  // Setup timeout check
  useEffect(() => {
    if (!user?.id) {
      // User not logged in, clean up
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (warningTimer) clearTimeout(warningTimer)
      return
    }

    // Clear existing timers
    if (timeoutTimer) clearTimeout(timeoutTimer)
    if (warningTimer) clearTimeout(warningTimer)

    const checkSession = () => {
      const now = Date.now()
      const inactiveMins = (now - lastActivityTime) / 1000 / 60
      const timeoutMins = mergedConfig.timeoutMinutes
      const warningMins = mergedConfig.warningMinutes

      // Show warning
      if (
        inactiveMins >= timeoutMins - warningMins &&
        inactiveMins < timeoutMins &&
        !isWarningShownRef.current
      ) {
        isWarningShownRef.current = true
        if (onWarningRef.current) {
          onWarningRef.current()
        }
      }

      // Auto logout
      if (inactiveMins >= timeoutMins) {
        if (onTimeoutRef.current) {
          onTimeoutRef.current()
        }
        handleSessionTimeout()
      }
    }

    checkSession()
    timeoutTimer = setInterval(checkSession, mergedConfig.checkFrequency)

    return () => {
      if (timeoutTimer) clearTimeout(timeoutTimer)
    }
  }, [user?.id, mergedConfig])

  const handleSessionTimeout = async () => {
    await auth.signOut()
    window.location.href = '/auth/login?reason=session_expired'
  }

  const extendSession = () => {
    lastActivityTime = Date.now()
    isWarningShownRef.current = false
  }

  const setOnWarning = (callback: () => void) => {
    onWarningRef.current = callback
  }

  const setOnTimeout = (callback: () => void) => {
    onTimeoutRef.current = callback
  }

  return {
    extendSession,
    setOnWarning,
    setOnTimeout,
  }
}

/**
 * Format time remaining until timeout
 */
export function formatTimeRemaining(minutes: number): string {
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60)
    return `${seconds} seconds`
  }
  return `${Math.round(minutes)} minutes`
}
