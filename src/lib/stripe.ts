import { loadStripe, type Stripe } from '@stripe/stripe-js'

let stripePromise: Promise<Stripe | null>

/**
 * Initialize Stripe
 * Should be called once on app load
 */
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY
    if (!publishableKey) {
      console.error(
        'Stripe publishable key not found in environment variables. Set VITE_STRIPE_PUBLIC_KEY.'
      )
      return Promise.resolve(null)
    }
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise
}

/**
 * Redirect to Stripe-hosted checkout
 * Server endpoint should handle creating the checkout session
 */
export async function redirectToCheckout(checkoutSessionId: string) {
  const stripe = await getStripe()
  if (!stripe) {
    throw new Error('Stripe failed to initialize')
  }

  const { error } = await stripe.redirectToCheckout({
    sessionId: checkoutSessionId,
  })

  if (error) {
    throw new Error(error.message || 'Failed to redirect to checkout')
  }
}

/**
 * Open Stripe Customer Portal
 * For managing subscription, updating payment method, viewing invoices
 */
export async function openCustomerPortal(returnUrl: string) {
  const response = await fetch('/api/stripe/portal-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ returnUrl }),
  })

  if (!response.ok) {
    throw new Error('Failed to create portal session')
  }

  const { url } = await response.json()
  if (url) {
    window.location.href = url
  }
}

/**
 * Create a checkout session for Pro upgrade
 * Calls backend endpoint to create Stripe checkout session
 */
export async function createCheckoutSession(billingCycle: 'monthly' | 'annual') {
  const response = await fetch('/api/stripe/checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      billingCycle,
      successUrl: `${window.location.origin}/settings?tab=billing&success=true`,
      cancelUrl: `${window.location.origin}/pricing`,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create checkout session')
  }

  const { sessionId } = await response.json()
  return sessionId
}

/**
 * Cancel user's Pro subscription
 * Downgrade to free tier at end of billing period
 */
export async function cancelSubscription() {
  const response = await fetch('/api/stripe/cancel-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to cancel subscription')
  }

  return await response.json()
}

/**
 * Start a pro trial for the user
 * Backend initiates 7-day trial
 */
export async function startProTrial() {
  const response = await fetch('/api/stripe/start-trial', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to start trial')
  }

  return await response.json()
}

/**
 * Get current subscription details for user
 * Fetches from backend to ensure latest data from Stripe
 */
export async function getSubscriptionDetails() {
  const response = await fetch('/api/stripe/subscription-details', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch subscription details')
  }

  return await response.json()
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Apply early adopter discount to price
 * 50% off first year
 */
export function applyEarlyAdopterDiscount(monthlyPrice: number, yearlyPrice: number) {
  return {
    discountedMonthly: monthlyPrice * 0.5, // 50% off first month
    discountedYearly: yearlyPrice * 0.5, // 50% off first year
    originalMonthly: monthlyPrice,
    originalYearly: yearlyPrice,
    savingsMonthly: monthlyPrice * 0.5,
    savingsYearly: yearlyPrice * 0.5,
  }
}

/**
 * Calculate subscription details
 */
export function calculateSubscriptionDetails(
  billingCycle: 'monthly' | 'annual',
  monthlyPrice: number,
  yearlyPrice: number,
  hasDiscount: boolean = false
) {
  if (billingCycle === 'annual') {
    const price = hasDiscount ? yearlyPrice * 0.5 : yearlyPrice
    return {
      price,
      description: `$${monthlyPrice.toFixed(2)}/month billed annually`,
      billingCycle: 'yearly',
      savings: hasDiscount ? yearlyPrice * 0.5 : 0,
    }
  } else {
    const price = hasDiscount ? monthlyPrice * 0.5 : monthlyPrice
    return {
      price,
      description: `$${price.toFixed(2)}/month`,
      billingCycle: 'monthly',
      savings: hasDiscount ? monthlyPrice * 0.5 : 0,
    }
  }
}

export type { Stripe }
