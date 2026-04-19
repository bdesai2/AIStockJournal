# M6.5 Subscription System - Deployment & Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Stripe Configuration](#stripe-configuration)
4. [Database Setup (Supabase)](#database-setup-supabase)
5. [Environment Variables](#environment-variables)
6. [Deployment to Production](#deployment-to-production)
7. [Admin Dashboard Setup](#admin-dashboard-setup)
8. [Testing Checklist](#testing-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Services
- **Stripe Account** (https://stripe.com) - for payment processing
- **Supabase Project** (https://supabase.com) - for database & auth
- **Node.js** 16+ & npm
- **Git** for version control

### Development Tools
- Code editor (VS Code recommended)
- Postman or similar for API testing
- Stripe CLI for local webhook testing

---

## Local Development Setup

### 1. Clone & Install
```bash
cd "c:\Projects\AI projects\stock-journal"
npm install
```

### 2. Start Backend Server
```bash
npm run server
# Server runs on http://localhost:3001
```

### 3. Start Frontend Dev Server
```bash
npm run dev
# Frontend runs on http://localhost:5173
```

### 4. Verify Both Services
- Backend health check: `curl http://localhost:3001/health`
- Frontend: Visit http://localhost:5173

---

## Stripe Configuration

### Step 1: Get Stripe API Keys
1. Go to https://dashboard.stripe.com/apikeys
2. Make sure you're in **Test Mode** (toggle top right)
3. Copy your **Secret Key** (starts with `sk_test_`)
4. Save to `.env` as `STRIPE_SECRET_KEY`

### Step 2: Create Price Products
1. Go to https://dashboard.stripe.com/products
2. Click **+ Create product**

#### Monthly Plan
- **Name**: Trade Reflection Pro - Monthly
- **Price**: $9.99/month
- **Billing period**: Monthly
- **Copy Price ID** (e.g., `price_xxx...`)
- Add to `.env` as `STRIPE_PRICE_ID_MONTHLY`

#### Annual Plan
- **Name**: Trade Reflection Pro - Annual
- **Price**: $99.00/year
- **Billing period**: Yearly
- **Copy Price ID** (e.g., `price_yyy...`)
- Add to `.env` as `STRIPE_PRICE_ID_ANNUAL`

### Step 3: Setup Webhook
1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add Endpoint**
3. Enter webhook URL:
   - **Local testing**: Use Stripe CLI (see below)
   - **Production**: `https://yourdomain.com/api/stripe/webhook`
4. Select events to listen:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click **Add Endpoint**
6. Copy **Signing Secret** (starts with `whsec_`)
7. Add to `.env` as `STRIPE_WEBHOOK_SECRET`

### Step 4: Local Webhook Testing (Optional)
Install Stripe CLI: https://stripe.com/docs/stripe-cli

```bash
stripe login
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

The CLI will output a signing secret - use that in `.env` for local testing.

---

## Database Setup (Supabase)

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Copy your project **URL** and **Anon Key**
4. Add to `.env`:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   ```

### Step 2: Run Subscription Schema Migration
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy contents of: `database-migrations/m6_5_subscription_tables.sql`
4. Execute query
5. Should see 3 tables created:
   - `subscription_tiers`
   - `user_subscriptions`
   - `subscription_logs`

### Step 3: Run Admin Functions Migration
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy contents of: `database-migrations/admin_functions.sql`
4. Execute query
5. Should see 3 functions created (used by admin dashboard)

### Step 4: Verify Schema
```sql
-- Check tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Check functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public';
```

---

## Environment Variables

### `.env` (Root directory)
```env
# ─── Anthropic ────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-xxxx...

# ─── Finnhub ──────────────────────────────────────────────────────
FINNHUB_API_KEY=d78vklpr01qp...

# ─── Stripe (M6.5) ────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_51TNJim...
STRIPE_WEBHOOK_SECRET=whsec_1234...
STRIPE_PRICE_ID_MONTHLY=price_xxx...
STRIPE_PRICE_ID_ANNUAL=price_yyy...

# ─── Supabase ─────────────────────────────────────────────────────
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# ─── App URLs ─────────────────────────────────────────────────────
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3001
```

### `.env.local` (Optional - sensitive keys only)
Can override values in `.env` for local testing.

---

## Deployment to Production

### Option 1: Render (Recommended)

#### Backend Deployment
1. Go to https://render.com
2. Create new **Web Service**
3. Connect GitHub repository
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm run server`
   - **Environment**: Node
   - **Region**: Choose closest to users
5. Add environment variables from `.env` (except VITE_-prefixed ones)
6. Deploy
7. Note the deployed URL (e.g., `https://stock-journal-api.onrender.com`)

#### Frontend Deployment
1. Create new **Static Site**
2. Connect GitHub repository
3. Configure:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
4. Add environment variables:
   ```env
   VITE_API_BASE_URL=https://stock-journal-api.onrender.com
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGc...
   VITE_APP_URL=https://stock-journal.onrender.com
   ```
5. Deploy
6. Note the deployed URL (e.g., `https://stock-journal.onrender.com`)

#### Update Stripe Webhook
1. Go to https://dashboard.stripe.com/webhooks
2. Edit your webhook endpoint
3. Change URL to: `https://stock-journal-api.onrender.com/api/stripe/webhook`

### Option 2: Railway
1. Go to https://railway.app
2. Create new project
3. Deploy from GitHub
4. Add environment variables
5. Configure build/start scripts same as Render

### Option 3: Vercel (Frontend Only)
```bash
npm install -g vercel
vercel --prod
```

---

## Admin Dashboard Setup

### Enable Admin Access

The admin dashboard is located at `/admin` and requires admin privileges.

#### Method 1: Email Domain
Users with email ending in `@admin.stock-journal.com` automatically get admin access.

To use this:
1. Create user account with admin email
2. Access `/admin` directly

#### Method 2: Modify Code
Edit `src/pages/AdminDashboardPage.tsx` line 26:
```typescript
const isAdmin = user?.email?.endsWith('@admin.stock-journal.com') ||
                user?.email === 'your-admin@example.com'  // Add your email
```

### Using Admin Dashboard

1. Navigate to http://localhost:5173/admin (or production URL)
2. Search for user by email
3. Click **Grant Pro** to upgrade, or **Revoke** to downgrade
4. All changes logged in `subscription_logs` table

---

## Testing Checklist

### Unit Tests
```bash
npm run test
```

### Manual Testing - Free Tier
- [ ] Logged in, free user can view dashboard
- [ ] Advanced Metrics section shows **ProOnlyBanner**
- [ ] Dimensional Analysis section shows **ProOnlyBanner**
- [ ] Time-Based Analysis section shows **ProOnlyBanner**
- [ ] 52-Week Heatmap shows **ProOnlyBanner**
- [ ] Click "Upgrade" button → navigates to `/pricing`
- [ ] Strategy Library: "New Strategy" button shows **UpgradeModal**
- [ ] AI features (grade trade, etc.) show access denied

### Manual Testing - Trial Flow
- [ ] Free user goes to `/pricing`
- [ ] Clicks "Start 7-Day Trial"
- [ ] Redirected to Stripe checkout
- [ ] After checkout, user becomes "trialing" in database
- [ ] All Pro features unlock
- [ ] User sees "7 days remaining" countdown

### Manual Testing - Pro Subscription
- [ ] User upgrades to monthly ($9.99/mo)
- [ ] Stripe checkout completes
- [ ] User tier changes to "pro"
- [ ] All Pro features accessible
- [ ] User can access `/settings` → Billing
- [ ] Can open Stripe Customer Portal to manage subscription

### Manual Testing - Downgrade
- [ ] Pro user cancels subscription
- [ ] User downgraded to "free"
- [ ] Pro features show **ProOnlyBanner**
- [ ] Subscription log shows "canceled"

### Manual Testing - Admin
- [ ] Admin searches user by email
- [ ] Can grant Pro access (user tier updates immediately)
- [ ] Can revoke Pro access (user tier reverts to free)
- [ ] All actions logged in `subscription_logs`

### Webhook Testing (Local)
```bash
# Terminal 1: Start backend
npm run server

# Terminal 2: Start Stripe CLI
stripe listen --forward-to localhost:3001/api/stripe/webhook

# Terminal 3: Test checkout
stripe trigger checkout.session.completed
```

---

## Troubleshooting

### "process is not defined" on Admin Page
**Error**: `ReferenceError: process is not defined`

**Solution**:
- Environment variables must be prefixed with `VITE_` to be accessible in browser
- Server-side only vars should NOT be prefixed
- Already fixed in AdminDashboardPage.tsx (removed `process.env.REACT_APP_ADMIN_USER_ID`)

### Stripe Webhook Not Processing
**Issue**: Checkout completes but subscription not created

**Troubleshooting**:
1. Check Stripe webhook logs: https://dashboard.stripe.com/webhooks
2. Look for 4xx errors (signature mismatch)
3. Verify `STRIPE_WEBHOOK_SECRET` matches in `.env`
4. Check backend logs for webhook errors
5. Ensure webhook URL is correct (test vs production)

### User Tier Not Updating After Checkout
**Issue**: Stripe confirmed payment but backend not updated

**Troubleshooting**:
1. Check `subscription_logs` table for `admin_granted_pro` entry
2. Verify webhook event reached backend (check logs)
3. Ensure `user_subscriptions` has record for user
4. Check that webhook event type is in `registerStripeRoutes`

### Admin Dashboard Shows "Access Denied"
**Issue**: Admin user can't access `/admin`

**Troubleshooting**:
1. Verify user email ends with `@admin.stock-journal.com` OR
2. Add email to AdminDashboardPage.tsx line 26
3. Log out and back in to refresh auth state
4. Check browser console for auth errors

### Price IDs Invalid
**Error**: `Invalid API Key or Price ID`

**Troubleshooting**:
1. Go to https://dashboard.stripe.com/products
2. Find your product
3. Copy Price ID (NOT Product ID)
4. Verify format: `price_xxx...` (not `prod_xxx...`)
5. Update `.env` and restart server

### Supabase RLS Policy Blocks Access
**Error**: `new row violates row-level security policy "Users can view own subscription"`

**Troubleshooting**:
1. Ensure user is authenticated
2. Check that `auth.uid()` matches `user_id` in query
3. Verify RLS policies are created correctly (from migration)
4. For webhook updates, ensure using service role key

---

## Production Checklist

### Before Going Live
- [ ] Stripe in **Live Mode** (not test)
- [ ] Live Stripe API keys in production `.env`
- [ ] Live Stripe webhook configured
- [ ] Supabase in production (not development)
- [ ] All environment variables set on hosting platform
- [ ] Backend logs configured (Render/Railway)
- [ ] Error tracking configured (Sentry recommended)
- [ ] Manual testing passed on staging
- [ ] Admin account created with admin email
- [ ] Database backups enabled

### After Deployment
- [ ] Test free → trial → pro flows
- [ ] Test admin grant/revoke functionality
- [ ] Monitor webhook logs for errors
- [ ] Check user `subscription_logs` for activity
- [ ] Monitor database query performance
- [ ] Set up alerts for payment failures

---

## Support & Resources

### Stripe Documentation
- https://stripe.com/docs/billing/subscriptions/overview
- https://stripe.com/docs/webhooks
- https://stripe.com/docs/payments/checkout

### Supabase Documentation
- https://supabase.com/docs/guides/database
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/sql-editor

### Project Documentation
- M6.5 Progress: See `MEMORY.md`
- Feature Gates: See `/src/lib/featureGates.ts`
- Types: See `/src/types/index.ts`

---

## Changelog

### M6.5 - Latest
- ✅ Stripe checkout & subscription management
- ✅ Free/Pro tier system with 7-day trial
- ✅ Feature gating for 13 Pro features
- ✅ Admin dashboard for manual tier management
- ✅ Webhook handler for subscription events
- ✅ Enhanced dashboard metrics (Expectancy, Hold Time, Avg Size, etc.)

---

**Last Updated**: April 2026
**Maintained By**: Trade Reflection Team
