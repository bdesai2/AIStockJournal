import { X, Check, ArrowRight } from 'lucide-react'
import { ProBadge } from './ProBadge'
import { getUpgradeMessage } from '@/lib/featureGates'

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  onUpgrade: () => void
  featureKey?: string
  customMessage?: string
  isLoading?: boolean
}

/**
 * Modal dialog to prompt user to upgrade to Pro
 * Shown when free user tries to access a Pro feature
 */
export function UpgradeModal({
  isOpen,
  onClose,
  onUpgrade,
  featureKey,
  customMessage,
  isLoading = false,
}: UpgradeModalProps) {
  if (!isOpen) return null

  const message = customMessage || (featureKey ? getUpgradeMessage(featureKey) : '')

  const proFeatures = [
    'AI-powered trade grading with letter grades and suggestions',
    'Advanced analytics: Sharpe ratio, Sortino, drawdown',
    'Weekly digest with pattern analysis',
    'Setup validation before taking trades',
    'Trade similarity matching for learning',
    '52-week performance heatmap',
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card rounded-xl border border-border max-w-md w-full animate-in slide-in-from-bottom-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ProBadge size="md" />
            <span className="text-lg font-semibold">Premium Features</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Message */}
          {message && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
              <p className="text-sm font-medium text-primary">{message}</p>
            </div>
          )}

          {/* Pro Features List */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Unlock with Pro:</h3>
            <ul className="space-y-2">
              {proFeatures.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing Info */}
          <div className="bg-accent/30 rounded-lg p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-foreground font-semibold">$9.99</span>
              <span className="text-sm text-muted-foreground">/month</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Or save 17% with annual billing: <span className="text-foreground font-medium">$99/year</span>
            </p>
            <p className="text-xs text-primary font-medium pt-2">
              ✨ Early adopters: 50% off first year
            </p>
          </div>

          {/* Trial Info */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-semibold">Try for free:</span> Get a 7-day trial to experience all Pro features risk-free
            </p>
          </div>
        </div>

        {/* Footer - Actions */}
        <div className="flex gap-2 px-6 py-4 border-t border-border/50 bg-card/50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-accent transition-colors disabled:opacity-50"
          >
            Maybe Later
          </button>
          <button
            onClick={onUpgrade}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                Starting...
              </>
            ) : (
              <>
                Upgrade Now
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
