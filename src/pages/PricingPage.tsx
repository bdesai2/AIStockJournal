import { useState } from 'react'
import { Check, X, Crown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ProBadge } from '@/components/premium/ProBadge'
import { getProFeatures, getCoreFeatures } from '@/lib/featureGates'

export function PricingPage() {
  const navigate = useNavigate()
  const { subscription, upgradeToProTrial, upgradeToProMonthly, subscriptionLoading } = useAuthStore()
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<'monthly' | 'annual'>('annual')
  const [isUpgrading, setIsUpgrading] = useState(false)

  const coreFeatures = getCoreFeatures()
  const proFeatures = getProFeatures()

  const handleStartTrial = async () => {
    if (isUpgrading) return
    try {
      setIsUpgrading(true)
      await upgradeToProTrial()
      navigate('/')
    } catch (error) {
      console.error('Failed to start trial:', error)
    } finally {
      setIsUpgrading(false)
    }
  }

  const handleUpgradeNow = async () => {
    if (isUpgrading || subscriptionLoading) return
    try {
      setIsUpgrading(true)
      await upgradeToProMonthly(selectedBillingCycle)
    } catch (error) {
      console.error('Failed to upgrade:', error)
    } finally {
      setIsUpgrading(false)
    }
  }

  const isProUser = subscription?.tier === 'pro'

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Simple, Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade anytime. Get access to advanced analytics and AI-powered insights to level up your trading.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Free Tier */}
          <div className="rounded-xl border border-border bg-card p-8 hover:border-border/80 transition-colors">
            <h2 className="text-2xl font-bold text-foreground mb-2">Free</h2>
            <p className="text-muted-foreground mb-6">Perfect for getting started</p>

            <div className="mb-6">
              <span className="text-3xl font-bold text-foreground">$0</span>
              <span className="text-muted-foreground">/month</span>
            </div>

            <button
              disabled
              className="w-full py-2 px-4 rounded-md bg-accent/30 text-foreground font-medium cursor-not-allowed"
            >
              Current Plan
            </button>

            <div className="mt-8 space-y-3 border-t border-border pt-8">
              {coreFeatures.slice(0, 4).map((feature) => (
                <div key={feature.key} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-foreground">{feature.name}</span>
                </div>
              ))}
              <div className="flex items-start gap-3 pt-2">
                <span className="text-xs text-muted-foreground">+ {coreFeatures.length - 4} more features</span>
              </div>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/5 to-transparent p-8 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <ProBadge size="md" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">Pro</h2>
            <p className="text-muted-foreground mb-6">For serious traders</p>

            <div className="mb-6">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-foreground">$9.99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Or <span className="font-semibold text-foreground">$99/year</span> (save 17%)
              </p>
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex gap-2 mb-6 p-1 bg-accent/30 rounded-lg w-fit">
              <button
                onClick={() => setSelectedBillingCycle('monthly')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  selectedBillingCycle === 'monthly'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedBillingCycle('annual')}
                className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                  selectedBillingCycle === 'annual'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual
              </button>
            </div>

            {/* Early Adopter Discount */}
            <div className="mb-6 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <span className="font-semibold">✨ Early adopter offer:</span> 50% off your first year
              </p>
            </div>

            {isProUser ? (
              <button
                disabled
                className="w-full py-2 px-4 rounded-md bg-accent/30 text-foreground font-medium cursor-not-allowed"
              >
                Your Current Plan
              </button>
            ) : (
              <>
                <button
                  onClick={handleUpgradeNow}
                  disabled={isUpgrading || subscriptionLoading}
                  className="w-full py-2 px-4 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                >
                  {isUpgrading ? 'Processing...' : 'Upgrade Now'}
                </button>
                <button
                  onClick={handleStartTrial}
                  disabled={isUpgrading || subscriptionLoading}
                  className="w-full py-2 px-4 rounded-md border border-primary text-primary font-medium hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpgrading ? 'Processing...' : 'Free 7-Day Trial'}
                </button>
              </>
            )}

            <div className="mt-8 space-y-3 border-t border-border pt-8">
              {proFeatures.slice(0, 6).map((feature) => (
                <div key={feature.key} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-sm text-foreground">{feature.name}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3 pt-2">
                <span className="text-xs text-muted-foreground">+ {proFeatures.length - 6} more Pro features</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Comparison Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-accent/30">
                  <th className="text-left px-6 py-4 font-semibold text-foreground">Feature</th>
                  <th className="text-center px-6 py-4 font-semibold text-foreground">Free</th>
                  <th className="text-center px-6 py-4 font-semibold text-foreground">Pro</th>
                </tr>
              </thead>
              <tbody>
                {/* Core Features */}
                <tr className="border-b border-border/30 bg-muted/20">
                  <td colSpan={3} className="px-6 py-3 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Core Features
                  </td>
                </tr>
                {coreFeatures.map((feature) => (
                  <tr key={feature.key} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-foreground">{feature.name}</td>
                    <td className="text-center px-6 py-4">
                      <Check className="w-5 h-5 text-primary mx-auto" />
                    </td>
                    <td className="text-center px-6 py-4">
                      <Check className="w-5 h-5 text-primary mx-auto" />
                    </td>
                  </tr>
                ))}

                {/* Pro Features */}
                <tr className="border-b border-border/30 bg-muted/20">
                  <td colSpan={3} className="px-6 py-3 font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Crown className="w-4 h-4" /> Premium Features
                  </td>
                </tr>
                {proFeatures.map((feature) => (
                  <tr key={feature.key} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-foreground">
                      {feature.name}
                      <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                    </td>
                    <td className="text-center px-6 py-4">
                      <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                    </td>
                    <td className="text-center px-6 py-4">
                      <Check className="w-5 h-5 text-primary mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">Frequently Asked Questions</h2>

          <div className="space-y-6">
            <div className="rounded-lg border border-border/50 p-6">
              <h3 className="font-semibold text-foreground mb-2">Can I try Pro for free?</h3>
              <p className="text-muted-foreground">
                Yes! We offer a 7-day free trial with full access to all Pro features. No credit card required.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 p-6">
              <h3 className="font-semibold text-foreground mb-2">How do I upgrade?</h3>
              <p className="text-muted-foreground">
                Click the "Upgrade Now" button above and follow the checkout process. You can switch between monthly and annual billing anytime.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 p-6">
              <h3 className="font-semibold text-foreground mb-2">What happens to my data if I downgrade?</h3>
              <p className="text-muted-foreground">
                Your trades and journal entries remain safe on the Free tier. You'll only lose access to Pro features like AI grading and advanced analytics.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 p-6">
              <h3 className="font-semibold text-foreground mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground">
                Yes, you can cancel your subscription anytime from your account settings. Your subscription will remain active until the end of your billing period.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 p-6">
              <h3 className="font-semibold text-foreground mb-2">What's the early adopter discount?</h3>
              <p className="text-muted-foreground">
                Early adopters get 50% off their first year of Pro. This means $49.50/year instead of $99/year, or $5/month instead of $9.99/month.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
