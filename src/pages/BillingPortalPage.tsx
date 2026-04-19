import { useState } from 'react'
import { Calendar, CreditCard, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ProBadge } from '@/components/premium/ProBadge'
import { openCustomerPortal } from '@/lib/stripe'

export function BillingPortalPage() {
  const navigate = useNavigate()
  const { subscription, subscriptionLoading, cancelProSubscription, upgradeToProTrial } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)

  const handleManageSubscription = async () => {
    try {
      setIsLoading(true)
      const returnUrl = `${window.location.origin}/settings?tab=billing`
      await openCustomerPortal(returnUrl)
    } catch (error) {
      console.error('Failed to open customer portal:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartTrial = async () => {
    try {
      setIsLoading(true)
      await upgradeToProTrial()
    } catch (error) {
      console.error('Failed to start trial:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewPricing = () => {
    navigate('/pricing')
  }

  if (!subscription) {
    return (
      <div className="p-6 rounded-lg border border-border bg-muted/30">
        <p className="text-muted-foreground">Loading subscription information...</p>
      </div>
    )
  }

  const isTrialing = subscription.status === 'trialing'
  const isPro = subscription.tier === 'pro'
  const isCanceled = subscription.status === 'canceled'

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not applicable'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Current Plan</h2>
            {isPro && !isCanceled && <ProBadge size="md" />}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Tier</p>
              <p className="text-lg font-semibold text-foreground">
                {isPro ? 'Pro' : 'Free'}
                {isTrialing && ' (Trial)'}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <p className="text-lg font-semibold text-foreground capitalize">
                {subscription.status === 'active' ? 'Active' : subscription.status === 'trialing' ? 'Trialing' : 'Canceled'}
              </p>
            </div>

            {isTrialing && subscription.trialEndsAt && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-blue-900 dark:text-blue-100">Trial Period Active</p>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Expires: {formatDate(subscription.trialEndsAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isCanceled && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  Your subscription has been canceled. You're still on the Free tier.
                </p>
              </div>
            )}

            {subscription.earlyAdopterDiscount && isPro && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg p-3">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                  ✨ Early adopter discount applied (50% off first year)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Billing Info */}
        {isPro && !isCanceled && (
          <div className="space-y-3 border-t border-border pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {isTrialing ? 'Trial Expires' : 'Next Billing'}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {formatDate(isTrialing ? subscription.trialEndsAt : subscription.renewalDate)}
                </p>
              </div>
            </div>

            {subscription.startDate && (
              <div className="flex items-center gap-3">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Subscription Started</p>
                  <p className="text-sm font-medium text-foreground">{formatDate(subscription.startDate)}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-border mt-6 pt-6 flex gap-3">
          {isPro && !isCanceled ? (
            <button
              onClick={handleManageSubscription}
              disabled={isLoading || subscriptionLoading}
              className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              {isLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          ) : subscription.status === 'trialing' ? (
            <button
              onClick={handleViewPricing}
              className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Complete Your Upgrade
            </button>
          ) : (
            <button
              onClick={handleStartTrial}
              disabled={subscriptionLoading}
              className="flex-1 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {subscriptionLoading ? 'Starting Trial...' : 'Start 7-Day Free Trial'}
            </button>
          )}
        </div>
      </div>

      {/* Pro Features Card */}
      {!isPro && (
        <div className="rounded-lg border border-border/50 bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Unlock Pro Features</h3>
          <ul className="space-y-2 mb-6">
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">✓</span>
              <span>AI-powered trade grading with letter grades and suggestions</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">✓</span>
              <span>Advanced analytics: Sharpe ratio, Sortino, drawdown</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">✓</span>
              <span>Weekly digest with pattern analysis</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">✓</span>
              <span>52-week performance heatmap</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">✓</span>
              <span>Trade similarity matching for learning</span>
            </li>
          </ul>
          <button
            onClick={handleViewPricing}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            View Pricing & Upgrade
          </button>
        </div>
      )}

      {/* FAQ Section */}
      <div className="rounded-lg border border-border/50 bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Billing Questions?</h3>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-foreground">How do I change my billing cycle?</p>
            <p className="text-muted-foreground mt-1">
              Click "Manage Subscription" above to access your Stripe portal where you can switch between monthly and annual billing.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Can I upgrade during my trial?</p>
            <p className="text-muted-foreground mt-1">
              Yes, you can upgrade anytime. Click "View Pricing & Upgrade" to get started.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">How do I cancel my subscription?</p>
            <p className="text-muted-foreground mt-1">
              Visit your subscription settings in the Stripe portal. You can cancel anytime, and your access will continue until the end of your billing period.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
