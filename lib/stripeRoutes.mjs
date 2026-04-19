/**
 * Stripe Route Handlers
 * Express route definitions for subscription & payment management
 */

import express from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Initialize Stripe & Supabase
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
})

// Initialize Supabase with available keys
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env/.env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Get current authenticated user from request headers
 * Expects Authorization: Bearer <token> header
 */
async function getAuthUser(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header')
  }

  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data?.user?.id) {
    throw new Error('Failed to authenticate user')
  }

  return data.user
}

/**
 * Register all Stripe routes on Express app
 */
export function registerStripeRoutes(app) {
  // Check if Stripe is configured
  const stripeConfigured = !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_ID_MONTHLY &&
    process.env.STRIPE_PRICE_ID_ANNUAL &&
    process.env.STRIPE_WEBHOOK_SECRET
  )

  /**
   * POST /api/stripe/checkout-session
   * Create a Stripe checkout session for upgrading to Pro
   */
  app.post('/api/stripe/checkout-session', async (req, res) => {
    if (!stripeConfigured) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Payment processing is not yet configured. Please use the admin panel to manage subscriptions.',
      })
    }
    try {
      const user = await getAuthUser(req)
      const { billingCycle, successUrl, cancelUrl } = req.body

      if (!['monthly', 'annual'].includes(billingCycle)) {
        return res.status(400).json({ message: 'Invalid billing cycle' })
      }

      // Get or create Stripe customer
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single()

      let customerId = subData?.stripe_customer_id

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { user_id: user.id },
        })
        customerId = customer.id

        // Store customer ID
        await supabase
          .from('user_subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('user_id', user.id)
      }

      // Create checkout session
      const priceId =
        billingCycle === 'annual'
          ? process.env.STRIPE_PRICE_ID_ANNUAL // e.g., price_xxx for annual
          : process.env.STRIPE_PRICE_ID_MONTHLY // e.g., price_yyy for monthly

      if (!priceId) {
        return res.status(500).json({
          message: 'Payment configuration error',
        })
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl || `${process.env.VITE_APP_URL}/settings?tab=billing&success=true`,
        cancel_url: cancelUrl || `${process.env.VITE_APP_URL}/pricing`,
        subscription_data: {
          metadata: {
            user_id: user.id,
          },
        },
      })

      res.json({ sessionId: session.id })
    } catch (err) {
      console.error('Checkout session error:', err)
      res.status(500).json({
        message: err.message || 'Failed to create checkout session',
      })
    }
  })

  /**
   * POST /api/stripe/portal-session
   * Create a Stripe customer portal session for managing subscription
   */
  app.post('/api/stripe/portal-session', async (req, res) => {
    if (!stripeConfigured) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Payment processing is not yet configured. Please use the admin panel to manage subscriptions.',
      })
    }
    try {
      const user = await getAuthUser(req)
      const { returnUrl } = req.body

      if (!returnUrl) {
        return res.status(400).json({ message: 'Return URL required' })
      }

      // Get Stripe customer ID
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single()

      if (!subData?.stripe_customer_id) {
        return res.status(400).json({
          message: 'No subscription found',
        })
      }

      // Create portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: subData.stripe_customer_id,
        return_url: returnUrl,
      })

      res.json({ url: session.url })
    } catch (err) {
      console.error('Portal session error:', err)
      res.status(500).json({
        message: err.message || 'Failed to create portal session',
      })
    }
  })

  /**
   * POST /api/stripe/start-trial
   * Start a 7-day free trial for the user
   */
  app.post('/api/stripe/start-trial', async (req, res) => {
    if (!stripeConfigured) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Payment processing is not yet configured. Please use the admin panel to manage subscriptions.',
      })
    }
    try {
      const user = await getAuthUser(req)

      // Check if user already has a trial
      const { data: existingSub } = await supabase
        .from('user_subscriptions')
        .select('status, trial_ends_at')
        .eq('user_id', user.id)
        .single()

      if (existingSub?.status === 'trialing' || existingSub?.trial_ends_at) {
        const trialEnd = new Date(existingSub.trial_ends_at)
        if (trialEnd > new Date()) {
          return res.status(400).json({
            message: 'Trial already active',
            trialEndsAt: existingSub.trial_ends_at,
          })
        }
      }

      // Calculate trial end date (7 days from now)
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 7)

      // Update user subscription to trialing
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          tier: 'pro',
          status: 'trialing',
          trial_ends_at: trialEndsAt.toISOString(),
          start_date: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (error) {
        throw error
      }

      res.json({
        message: 'Trial started',
        tier: 'pro',
        status: 'trialing',
        trialEndsAt: trialEndsAt.toISOString(),
      })
    } catch (err) {
      console.error('Trial start error:', err)
      res.status(500).json({
        message: err.message || 'Failed to start trial',
      })
    }
  })

  /**
   * POST /api/stripe/cancel-subscription
   * Cancel the user's Pro subscription
   */
  app.post('/api/stripe/cancel-subscription', async (req, res) => {
    if (!stripeConfigured) {
      return res.status(503).json({
        error: 'Stripe not configured',
        message: 'Payment processing is not yet configured. Please use the admin panel to manage subscriptions.',
      })
    }
    try {
      const user = await getAuthUser(req)

      // Get subscription ID from database
      const { data: subData } = await supabase
        .from('user_subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', user.id)
        .single()

      if (subData?.stripe_subscription_id) {
        // Cancel subscription in Stripe
        await stripe.subscriptions.cancel(subData.stripe_subscription_id)
      }

      // Update user tier back to free
      await supabase
        .from('user_subscriptions')
        .update({
          tier: 'free',
          status: 'canceled',
          stripe_subscription_id: null,
        })
        .eq('user_id', user.id)

      res.json({
        message: 'Subscription canceled',
        tier: 'free',
      })
    } catch (err) {
      console.error('Cancel subscription error:', err)
      res.status(500).json({
        message: err.message || 'Failed to cancel subscription',
      })
    }
  })

  /**
   * GET /api/stripe/subscription-details
   * Get current subscription details for the user
   */
  app.get('/api/stripe/subscription-details', async (req, res) => {
    try {
      const user = await getAuthUser(req)

      const { data: sub, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      // If no subscription record, create one
      if (!sub) {
        const newSub = {
          user_id: user.id,
          tier: 'free',
          status: 'active',
          start_date: null,
          renewal_date: null,
          trial_ends_at: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          early_adopter_discount: false,
        }

        const { data: created, error: createError } = await supabase
          .from('user_subscriptions')
          .insert([newSub])
          .select()
          .single()

        if (createError) throw createError

        return res.json(created)
      }

      res.json({
        tier: sub.tier,
        status: sub.status,
        startDate: sub.start_date,
        renewalDate: sub.renewal_date,
        trialEndsAt: sub.trial_ends_at,
        stripeCustomerId: sub.stripe_customer_id,
        stripeSubscriptionId: sub.stripe_subscription_id,
        earlyAdopterDiscount: sub.early_adopter_discount,
      })
    } catch (err) {
      // If auth fails and Stripe isn't configured, return default free tier
      if (err.message?.includes('Missing or invalid authorization header')) {
        return res.json({
          tier: 'free',
          status: 'active',
          renewalDate: null,
          trialEndsAt: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          earlyAdopterDiscount: false,
        })
      }

      console.error('Get subscription error:', err)
      res.status(500).json({
        message: err.message || 'Failed to fetch subscription details',
      })
    }
  })

  /**
   * POST /api/stripe/webhook
   * Handle Stripe webhook events (requires raw body)
   */
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const sig = req.headers['stripe-signature']
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

      if (!webhookSecret) {
        console.warn('STRIPE_WEBHOOK_SECRET not configured')
        return res.sendStatus(200)
      }

      let event

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message)
        return res.sendStatus(400)
      }

      // Handle relevant events
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object
          const userId = session.subscription_data?.metadata?.user_id

          if (userId && session.subscription) {
            // Update subscription in database
            await supabase
              .from('user_subscriptions')
              .update({
                tier: 'pro',
                status: 'active',
                stripe_subscription_id: session.subscription,
                start_date: new Date().toISOString(),
              })
              .eq('user_id', userId)
          }
          break
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object
          const userId = subscription.metadata?.user_id

          if (userId) {
            const status = subscription.status === 'active' ? 'active' : 'past_due'
            const renewalDate = new Date(subscription.current_period_end * 1000).toISOString()

            await supabase
              .from('user_subscriptions')
              .update({
                status,
                renewal_date: renewalDate,
              })
              .eq('user_id', userId)
          }
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          const userId = subscription.metadata?.user_id

          if (userId) {
            await supabase
              .from('user_subscriptions')
              .update({
                tier: 'free',
                status: 'canceled',
                stripe_subscription_id: null,
              })
              .eq('user_id', userId)
          }
          break
        }
      }

      res.sendStatus(200)
    } catch (err) {
      console.error('Webhook processing error:', err)
      res.sendStatus(500)
    }
  })
}
