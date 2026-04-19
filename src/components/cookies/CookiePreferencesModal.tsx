import { useState } from 'react'
import { X, Check } from 'lucide-react'
import type { CookiePreferences } from './CookieConsentBanner'

interface CookiePreferencesModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (preferences: CookiePreferences) => void
  currentPreferences: CookiePreferences
}

export function CookiePreferencesModal({
  isOpen,
  onClose,
  onSave,
  currentPreferences,
}: CookiePreferencesModalProps) {
  const [prefs, setPrefs] = useState<CookiePreferences>(currentPreferences)

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      ...prefs,
      lastUpdated: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[10000] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card rounded-lg border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 sticky top-0 bg-card">
          <h2 className="text-lg font-display tracking-wider">Cookie Preferences</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Essential Cookies */}
          <div className="border border-green-900/30 rounded-lg p-4 bg-green-950/20">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-foreground">✅ Essential Cookies</h3>
                  <span className="text-xs bg-green-950/60 text-green-200 px-2 py-0.5 rounded">
                    Always On
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Required for authentication and security. Cannot be disabled.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-3">
                  <li>• Supabase Session Token - Keeps you logged in</li>
                  <li>• CSRF Protection - Prevents unauthorized requests</li>
                  <li>• Security Headers - Protects against attacks</li>
                </ul>
              </div>
              <div className="flex-shrink-0 mt-1">
                <Check className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </div>

          {/* Analytics Cookies */}
          <div className="border border-blue-900/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <label className="flex items-center cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={prefs.analytics}
                  onChange={(e) =>
                    setPrefs({ ...prefs, analytics: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                <div className="ml-3 flex-1">
                  <h3 className="font-semibold text-foreground">📊 Analytics Cookies</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Help us understand how you use the app. No personal info is shared.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-3 mt-2">
                    <li>• Pages visited and features used</li>
                    <li>• Time spent on app</li>
                    <li>• Anonymized event tracking</li>
                    <li>• See Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">privacy policy</a></li>
                  </ul>
                </div>
              </label>
            </div>
          </div>

          {/* Marketing Cookies */}
          <div className="border border-purple-900/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <label className="flex items-center cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={prefs.marketing}
                  onChange={(e) =>
                    setPrefs({ ...prefs, marketing: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-border accent-primary"
                  disabled
                />
                <div className="ml-3 flex-1">
                  <h3 className="font-semibold text-foreground text-muted-foreground/60">
                    🎯 Marketing Cookies
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Currently disabled. Used for retargeting ads in the future.
                  </p>
                  <div className="text-xs text-muted-foreground/60 mt-2 italic">
                    Not yet available (coming soon)
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-accent/30 rounded-lg p-3 border border-border/50">
            <p className="text-xs text-muted-foreground">
              📋 <strong>Last updated:</strong> {new Date(prefs.lastUpdated).toLocaleDateString()}{' '}
              at {new Date(prefs.lastUpdated).toLocaleTimeString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              💾 Your preferences are saved locally and never shared with third parties.
            </p>
          </div>

          {/* Footer Links */}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <a href="/privacy" className="text-blue-400 hover:underline">
              Privacy Policy
            </a>
            <span>•</span>
            <a href="/cookie-policy" className="text-blue-400 hover:underline">
              Cookie Policy
            </a>
            <span>•</span>
            <a href="/terms" className="text-blue-400 hover:underline">
              Terms of Service
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-border/50 bg-card/50 sticky bottom-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}
