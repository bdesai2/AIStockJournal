import { Lock, ArrowRight } from 'lucide-react'
import { ProBadge } from './ProBadge'

interface LockedFeatureProps {
  children: React.ReactNode
  featureName: string
  message?: string
  onUpgradeClick?: () => void
  showOverlay?: boolean
}

/**
 * Wraps content that is locked behind Pro tier
 * Shows an overlay with upgrade prompt when feature is accessed
 */
export function LockedFeature({
  children,
  featureName,
  message,
  onUpgradeClick,
  showOverlay = true,
}: LockedFeatureProps) {
  if (!showOverlay) {
    return <>{children}</>
  }

  return (
    <div className="relative">
      {/* Content (blurred) */}
      <div className="opacity-40 pointer-events-none blur-sm">{children}</div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background/80 via-background/70 to-background/80 backdrop-blur-sm rounded-lg">
        <div className="text-center space-y-3 px-4">
          <div className="flex justify-center">
            <ProBadge size="md" />
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">{featureName} is a Pro Feature</h3>
            <p className="text-sm text-muted-foreground">
              {message || 'Upgrade to Pro to unlock this feature'}
            </p>
          </div>

          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Upgrade to Pro
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Simple "Pro Only" badge/banner
 * Use when you want to show that a feature is locked without overlay
 */
export function ProOnlyBanner({ featureName, onUpgradeClick }: {
  featureName?: string
  onUpgradeClick?: () => void
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-amber-800 dark:text-amber-200">
          {featureName ? `${featureName} is available in ` : 'This feature is available in '}
          <span className="font-semibold">Pro</span>
        </p>
      </div>
      {onUpgradeClick && (
        <button
          onClick={onUpgradeClick}
          className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
        >
          Upgrade →
        </button>
      )}
    </div>
  )
}
