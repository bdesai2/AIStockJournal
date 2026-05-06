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

/**
 * Hook to manage session timeout
 * Shows expiry warning and auto-logs out after inactivity
 */
export function useSessionTimeout(config: Partial<SessionConfig> = {}) {
  const { user } = useAuthStore()
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  const timeoutMs = mergedConfig.timeoutMinutes * 60 * 1000
  const warningMs = mergedConfig.warningMinutes * 60 * 1000
  const checkFrequency = mergedConfig.checkFrequency

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityRef = useRef(Date.now())
  const lastLightActivityRef = useRef(0)
  const isSigningOutRef = useRef(false)
  const isWarningShownRef = useRef(false)
  const onWarningRef = useRef<(() => void) | null>(null)
  const onTimeoutRef = useRef<(() => void) | null>(null)

  const markActivity = (force = false) => {
    const now = Date.now()
    if (!force && now - lastLightActivityRef.current < 15_000) {
      return
    }
    lastLightActivityRef.current = now
    lastActivityRef.current = now
    isWarningShownRef.current = false
  }

  // Register activity listener
  useEffect(() => {
    const handleStrongActivity = () => markActivity(true)
    const handleLightActivity = () => markActivity(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        markActivity(true)
      }
    }

    window.addEventListener('focus', handleStrongActivity)
    document.addEventListener('visibilitychange', handleVisibility)

    document.addEventListener('keydown', handleStrongActivity)
    document.addEventListener('click', handleStrongActivity)
    document.addEventListener('pointerdown', handleStrongActivity)

    document.addEventListener('scroll', handleLightActivity, { passive: true })
    document.addEventListener('mousemove', handleLightActivity, { passive: true })
    document.addEventListener('touchstart', handleLightActivity, { passive: true })

    // Start each mount from "active now" to avoid stale module-level timeouts.
    markActivity(true)

    return () => {
      window.removeEventListener('focus', handleStrongActivity)
      document.removeEventListener('visibilitychange', handleVisibility)

      document.removeEventListener('keydown', handleStrongActivity)
      document.removeEventListener('click', handleStrongActivity)
      document.removeEventListener('pointerdown', handleStrongActivity)

      document.removeEventListener('scroll', handleLightActivity)
      document.removeEventListener('mousemove', handleLightActivity)
      document.removeEventListener('touchstart', handleLightActivity)
    }
  }, [])

  // Setup timeout check
  useEffect(() => {
    if (!user?.id) {
      // User not logged in, clean up
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      isSigningOutRef.current = false
      return
    }

    // New auth session should always start from now.
    markActivity(true)

    // Clear existing timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    const checkSession = () => {
      const now = Date.now()
      const inactiveMs = now - lastActivityRef.current

      // Show warning
      if (
        inactiveMs >= timeoutMs - warningMs &&
        inactiveMs < timeoutMs &&
        !isWarningShownRef.current
      ) {
        isWarningShownRef.current = true
        if (onWarningRef.current) {
          onWarningRef.current()
        }
      }

      // Auto logout
      if (inactiveMs >= timeoutMs && !isSigningOutRef.current) {
        isSigningOutRef.current = true
        if (onTimeoutRef.current) {
          onTimeoutRef.current()
        }
        void handleSessionTimeout()
      }
    }

    checkSession()
    intervalRef.current = setInterval(checkSession, checkFrequency)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [user?.id, timeoutMs, warningMs, checkFrequency])

  const handleSessionTimeout = async () => {
    await auth.signOut()
    window.location.href = '/auth/login?reason=session_expired'
  }

  const extendSession = () => {
    markActivity(true)
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
