import { useState, useEffect } from 'react'

/** Extends the standard BeforeInstallPromptEvent which is not in the TS DOM lib. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Captures the browser's PWA install prompt so the app can trigger it on demand.
 *
 * canInstall  – true when the browser has signalled it's ready to install
 * install     – call to show the native install dialog
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // If already running as installed PWA, the event never fires — that's fine.
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  return { canInstall: deferredPrompt !== null, install }
}
