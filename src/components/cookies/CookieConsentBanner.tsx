import { useState, useEffect } from 'react'
import { X, Settings2 } from 'lucide-react'
import { CookiePreferencesModal } from './CookiePreferencesModal'

export type CookieCategory = 'essential' | 'analytics' | 'marketing'

export interface CookiePreferences {
  essential: boolean  // Always true, cannot be disabled
  analytics: boolean
  marketing: boolean
  consentDate: string
  lastUpdated: string
}

const COOKIE_STORAGE_KEY = 'stock-journal:cookie-preferences'
const DEFAULT_PREFERENCES: CookiePreferences = {
  essential: true,
  analytics: false,
  marketing: false,
  consentDate: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
}

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES)

  // Initialize on mount
  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_STORAGE_KEY)
    if (stored) {
      try {
        const prefs = JSON.parse(stored) as CookiePreferences
        setPreferences(prefs)
      } catch {
        setShowBanner(true)
      }
    } else {
      setShowBanner(true)
    }
  }, [])

  const handleAcceptAll = () => {
    const newPrefs: CookiePreferences = {
      essential: true,
      analytics: true,
      marketing: true,
      consentDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    }
    savePreferences(newPrefs)
  }

  const handleAcceptEssential = () => {
    const newPrefs: CookiePreferences = {
      essential: true,
      analytics: false,
      marketing: false,
      consentDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    }
    savePreferences(newPrefs)
  }

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(prefs))
    setPreferences(prefs)
    setShowBanner(false)

    // Trigger analytics if enabled
    if (prefs.analytics && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'granted',
      })
    }
  }

  if (!showBanner) {
    return null
  }

  return (
    <>
      {/* Cookie Consent Banner */}
      <div className="fixed inset-x-0 bottom-0 z-[9999] bg-card border-t border-border shadow-2xl animate-in slide-in-from-bottom-4">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-1">
                We use cookies to enhance your experience
              </p>
              <p className="text-xs text-muted-foreground">
                We use essential cookies for authentication and security. You can optionally enable analytics and marketing cookies to help us improve. See our{' '}
                <button
                  onClick={() => {
                    setShowBanner(false)
                    window.location.href = '/cookie-policy'
                  }}
                  className="text-blue-400 hover:underline"
                >
                  Cookie Policy
                </button>{' '}
                for details.
              </p>
            </div>

            <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={handleAcceptEssential}
                className="flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
              >
                Essential Only
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors flex items-center justify-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Customize
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="p-2 rounded-md text-muted-foreground hover:bg-accent transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cookie Preferences Modal */}
      <CookiePreferencesModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={(prefs) => savePreferences(prefs)}
        currentPreferences={preferences}
      />
    </>
  )
}

export { COOKIE_STORAGE_KEY, DEFAULT_PREFERENCES }
