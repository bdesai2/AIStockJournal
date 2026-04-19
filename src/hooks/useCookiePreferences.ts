import { useEffect, useState } from 'react'
import { COOKIE_STORAGE_KEY, DEFAULT_PREFERENCES, type CookiePreferences } from '@/components/cookies/CookieConsentBanner'

/**
 * Hook to access user's cookie preferences
 * Returns current preferences and utilities
 */
export function useCookiePreferences() {
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES)
  const [loaded, setLoaded] = useState(false)

  // Load preferences from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_STORAGE_KEY)
    if (stored) {
      try {
        const prefs = JSON.parse(stored) as CookiePreferences
        setPreferences(prefs)
      } catch {
        // Corrupted data, use defaults
        setPreferences(DEFAULT_PREFERENCES)
      }
    }
    setLoaded(true)
  }, [])

  const hasConsentedToAnalytics = () => loaded && preferences.analytics
  const hasConsentedToMarketing = () => loaded && preferences.marketing

  /**
   * Enable analytics if user has consented
   * Safe to call - does nothing if analytics disabled
   */
  const initializeAnalytics = () => {
    if (!hasConsentedToAnalytics()) return

    // Initialize Google Analytics or similar
    if ((window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
      })
    }
  }

  /**
   * Track event if user has consented to analytics
   */
  const trackEvent = (eventName: string, data?: Record<string, unknown>) => {
    if (!hasConsentedToAnalytics()) return

    if ((window as any).gtag) {
      (window as any).gtag('event', eventName, data)
    }
  }

  return {
    preferences,
    loaded,
    hasConsentedToAnalytics,
    hasConsentedToMarketing,
    initializeAnalytics,
    trackEvent,
  }
}
