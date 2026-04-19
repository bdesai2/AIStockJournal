import { useState } from 'react'
import { Cookie, RotateCw } from 'lucide-react'
import { useCookiePreferences } from '@/hooks/useCookiePreferences'
import { CookiePreferencesModal } from '@/components/cookies/CookiePreferencesModal'
import { COOKIE_STORAGE_KEY, type CookiePreferences } from '@/components/cookies/CookieConsentBanner'

export function CookieSettingsSection() {
  const { preferences } = useCookiePreferences()
  const [showModal, setShowModal] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSavePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_STORAGE_KEY, JSON.stringify(prefs))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setShowModal(false)
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <Cookie className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Cookie Preferences
          </span>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Manage which cookies you want to allow. Learn more in our <a href="/cookie-policy" className="text-blue-400 hover:underline">Cookie Policy</a>.
          </p>

          {/* Status */}
          <div className="bg-accent/30 rounded border border-border/50 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Essential Cookies:</span>
              <span className="font-mono text-green-400">Always Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Analytics Cookies:</span>
              <span className={`font-mono ${preferences.analytics ? 'text-blue-400' : 'text-muted-foreground'}`}>
                {preferences.analytics ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Marketing Cookies:</span>
              <span className={`font-mono ${preferences.marketing ? 'text-purple-400' : 'text-muted-foreground/60'}`}>
                {preferences.marketing ? 'Enabled' : 'Disabled (Coming Soon)'}
              </span>
            </div>
            <p className="text-muted-foreground/60 text-xs italic pt-2 border-t border-border/30">
              Last updated: {new Date(preferences.lastUpdated).toLocaleDateString()}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
              Change Preferences
            </button>
          </div>

          {saved && (
            <p className="text-xs text-green-400">
              ✓ Preferences saved successfully
            </p>
          )}
        </div>
      </div>

      {/* Cookie Preferences Modal */}
      <CookiePreferencesModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSavePreferences}
        currentPreferences={preferences}
      />
    </>
  )
}
