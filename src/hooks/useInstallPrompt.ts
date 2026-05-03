import { useState, useEffect, useMemo } from 'react'
import { useCookiePreferences } from '@/hooks/useCookiePreferences'

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
  const { trackEvent } = useCookiePreferences()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(() => {
    const mediaMatches = window.matchMedia('(display-mode: standalone)').matches
    const nav = navigator as Navigator & { standalone?: boolean }
    return mediaMatches || nav.standalone === true
  })

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      trackEvent('pwa_install_prompt_available', {
        surface: 'header',
      })
    }

    const onInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      trackEvent('pwa_installed', {
        source: 'appinstalled-event',
      })
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', onInstalled)

    // If already running as installed PWA, the event never fires — that's fine.
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [trackEvent])

  const installHelpText = useMemo(() => {
    if (isInstalled) return null

    const ua = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(ua)
    const isSafari = /safari/.test(ua) && !/chrome|crios|edg|edge|opr/.test(ua)
    const isFirefox = /firefox/.test(ua)

    if (deferredPrompt) return null

    if (isIOS && isSafari) {
      return 'To install on iPhone/iPad: tap Share, then Add to Home Screen.'
    }

    if (isIOS) {
      return 'To install on iPhone/iPad: open this app in Safari, then use Add to Home Screen.'
    }

    if (isFirefox) {
      return 'Install prompt is not fully supported in Firefox. Use the browser menu install option when available.'
    }

    return 'If install is not shown, open your browser menu and choose Install app or Add to Home Screen.'
  }, [deferredPrompt, isInstalled])

  const install = async () => {
    if (!deferredPrompt) return

    trackEvent('pwa_install_prompt_opened', {
      surface: 'header',
    })

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    trackEvent('pwa_install_prompt_result', {
      outcome,
      surface: 'header',
    })

    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  return {
    canInstall: deferredPrompt !== null,
    isInstalled,
    installHelpText,
    install,
  }
}
