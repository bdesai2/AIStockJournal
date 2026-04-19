# M6.5 Subscription System - Testing Guide

## Quick Start Testing (5 minutes)

### Prerequisites
- Backend running on http://localhost:3001
- Frontend running on http://localhost:5173
- Stripe keys configured in `.env`
- Supabase migrations applied

---

## Test Scenario 1: Free User → Trial

### Steps
1. **Create test account**
   - Go to http://localhost:5173/auth/login
   - Sign up with test email (e.g., `test@example.com`)
   - Verify email (check Supabase/email)

2. **Verify free tier access**
   - Dashboard shows only core metrics (no Pro section)
   - Click "Advanced Metrics" → shows **ProOnlyBanner**
   - Try "New Strategy" → shows **UpgradeModal**

3. **Start trial**
   - Click "Upgrade" or "New Strategy"
   - Select "Start 7-Day Trial"
   - Redirect to Stripe Checkout (test mode)
   - Use test card: `4242 4242 4242 4242` | Any future date | Any CVC
   - Complete checkout

4. **Verify trial activated**
   - Should redirect back to app
   - Check database: `SELECT * FROM user_subscriptions WHERE user_id = 'xxx'`
   - Status should be `'trialing'`, tier should be `'pro'`
   - All Pro features now accessible

### Expected Results
- ✅ User successfully starts trial
- ✅ Paywall removed from Pro features
- ✅ Can create strategies
- ✅ Advanced metrics visible
- ✅ Trial countdown shows in settings

---

## Test Scenario 2: Trial → Monthly Pro

### Steps
1. **User with active trial**
   - From previous test, user should have active trial

2. **Upgrade to monthly**
   - Go to `/pricing`
   - Click "Upgrade to Monthly ($9.99/mo)"
   - Complete Stripe checkout with same test card

3. **Verify subscription activated**
   - Database: `SELECT * FROM user_subscriptions WHERE user_id = 'xxx'`
   - Status should be `'active'`, tier should be `'pro'`
   - `renewal_date` should be ~30 days from today
   - `stripe_subscription_id` should be populated

### Expected Results
- ✅ Subscription created in Stripe
- ✅ Customer ID saved in database
- ✅ Renewal date calculated
- ✅ Webhook processes `checkout.session.completed`
- ✅ User can access billing portal

---

## Test Scenario 3: Manage Subscription

### Steps
1. **User with active subscription**
   - From previous test, user should have active Pro subscription

2. **Access billing portal**
   - Go to `/settings` → "Billing & Subscription"
   - Click "Manage Subscription"
   - Opens Stripe customer portal

3. **View/modify subscription**
   - Can see renewal date
   - Can update payment method
   - Can cancel subscription

### Expected Results
- ✅ Stripe portal opens in new window
- ✅ Can view next billing date
- ✅ Can update card
- ✅ Can preview invoice

---

## Test Scenario 4: Cancel Subscription

### Steps
1. **User with active subscription**
   - From previous test

2. **Cancel subscription**
   - Click "Cancel Subscription" button (if visible in UI)
   - OR go to Stripe customer portal and cancel there

3. **Verify downgrade**
   - Database: Status should change to `'canceled'`, tier to `'free'`
   - Webhook processes `customer.subscription.deleted`
   - Check `subscription_logs` for `admin_revoked_pro` entry (if admin did it)

4. **Verify access revoked**
   - Refresh dashboard
   - Advanced Metrics shows **ProOnlyBanner** again
   - "New Strategy" shows **UpgradeModal**

### Expected Results
- ✅ Subscription canceled in Stripe
- ✅ User downgraded to free tier
- ✅ Pro features locked again
- ✅ Can re-subscribe if desired

---

## Test Scenario 5: Admin Grant Pro Access

### Setup
1. Create two test users:
   - `user1@example.com` (free user)
   - `admin@admin.stock-journal.com` (admin user)

2. Admin user must have email with `@admin.stock-journal.com` domain

### Steps
1. **Login as admin**
   - Go to `/admin`
   - Should see admin dashboard (not access denied)

2. **Search for user**
   - Type `user1@example.com` in search box
   - Click "Search"
   - User appears in results with "Free" tier

3. **Grant Pro access**
   - Click "Grant Pro" button
   - Should see success message
   - User tier changes to "Pro"
   - Renewal date set to 1 year from now

4. **Verify in database**
   - `SELECT * FROM user_subscriptions WHERE user_id = 'user1@example.com'`
   - Tier should be `'pro'`
   - Status should be `'active'`

5. **Verify in subscription_logs**
   - Last entry should have action: `'admin_granted_pro'`
   - Details should show admin email and timestamp

### Expected Results
- ✅ Admin can access `/admin` dashboard
- ✅ Can search users by email
- ✅ Can grant Pro tier instantly
- ✅ No payment required (manual grant)
- ✅ All actions logged in audit trail

---

## Test Scenario 6: Admin Revoke Pro Access

### Steps
1. **From previous test, user has Pro access**

2. **Revoke Pro access**
   - Click "Revoke" button
   - Confirm dialog appears
   - Click "Yes, revoke"

3. **Verify downgrade**
   - User tier changes back to "Free"
   - Status changes to `'active'`
   - `renewal_date` cleared

4. **Verify in logs**
   - Last entry: action `'admin_revoked_pro'`
   - Details show reason & timestamp

### Expected Results
- ✅ Admin can revoke Pro tier
- ✅ User instantly downgraded
- ✅ Confirmation required (prevent accidents)
- ✅ Audit trail complete

---

## Test Scenario 7: Feature Gating

### Test Each Pro Feature

#### Dashboard Metrics
- [ ] Free user: Advanced Metrics shows **ProOnlyBanner**
- [ ] Pro user: All 12 metrics visible and interactive
- [ ] Free user: Dimensional Analysis shows **ProOnlyBanner**
- [ ] Free user: Time-Based Analysis shows **ProOnlyBanner**
- [ ] Free user: 52-Week Heatmap shows **ProOnlyBanner**

#### AI Features
- [ ] Grade Trade: Free user gets error "Pro feature"
- [ ] Trade Grade: Pro user can use feature
- [ ] Setup Validation: Free user cannot access
- [ ] Setup Validation: Pro user can use
- [ ] Weekly Digest: Free user cannot run
- [ ] Weekly Digest: Pro user can generate

#### Strategy Library
- [ ] Free user: "New Strategy" shows **UpgradeModal**
- [ ] Free user: Can view existing strategies (read-only)
- [ ] Free user: Cannot click "Edit"
- [ ] Pro user: Can create new strategies
- [ ] Pro user: Can edit existing strategies
- [ ] Pro user: Can delete strategies

### Expected Results
- ✅ All Free users see consistent paywall UI
- ✅ All Pro users have unrestricted access
- ✅ Proper error messages when accessing locked features
- ✅ Navigation to `/pricing` available from all paywalls

---

## Webhook Testing (Advanced)

### Setup Stripe CLI
```bash
# Install: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3001/api/stripe/webhook
# Note the signing secret output
```

Update `.env`:
```env
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx
```

### Test Events
```bash
# Terminal with stripe listen running:
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### Verify Processing
1. Check backend logs for webhook receipt
2. Check database tables:
   - `user_subscriptions` updated with correct tier
   - `subscription_logs` has new entry
3. Check no errors in Stripe dashboard webhooks

### Expected Results
- ✅ Webhooks received and processed
- ✅ Database updated correctly
- ✅ No 400 errors from signature validation
- ✅ Logs show successful processing

---

## Debugging Commands

### Check User Subscription
```sql
SELECT
  u.email,
  us.tier,
  us.status,
  us.start_date,
  us.renewal_date,
  us.trial_end_date,
  us.stripe_subscription_id
FROM auth.users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
WHERE u.email = 'test@example.com';
```

### Check Recent Subscription Changes
```sql
SELECT * FROM subscription_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Check Stripe Customers
```sql
SELECT
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  tier
FROM user_subscriptions
WHERE stripe_customer_id IS NOT NULL;
```

---

## Common Issues & Fixes

### User Stuck on Trial
**Problem**: Trial expired but user still has Pro access
**Fix**: Run in Supabase:
```sql
UPDATE user_subscriptions
SET tier = 'free', status = 'active'
WHERE user_id = 'xxxx' AND trial_end_date < NOW();
```

### Webhook Not Processing
**Problem**: Stripe says event delivered but database not updated
**Fix**:
1. Check backend logs for errors
2. Verify `STRIPE_WEBHOOK_SECRET` matches
3. Check that webhook endpoint is correct in Stripe dashboard
4. Manually re-trigger event: `stripe trigger checkout.session.completed --skip-validation`

### Admin Can't Access Dashboard
**Problem**: `/admin` shows "Access Denied"
**Fix**:
1. Verify user email ends with `@admin.stock-journal.com`
2. OR add email to AdminDashboardPage.tsx line 26
3. Log out/in to refresh session
4. Check browser dev tools for auth errors

### Price IDs Not Working
**Problem**: Checkout fails with "Invalid Price ID"
**Fix**:
1. Verify Price IDs (not Product IDs) in Stripe dashboard
2. Format should be `price_xxx...`
3. Update `.env` and restart server
4. Verify both monthly AND annual IDs set

---

## Performance Testing

### Load Test Checkout (Optional)
```bash
# Using Apache Bench
ab -n 100 -c 10 http://localhost:3001/health
```

### Monitor Database
```sql
-- Check for slow queries
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Sign-Off Checklist

- [ ] Free → Trial flow works
- [ ] Trial → Pro upgrade works
- [ ] Pro → Free downgrade works
- [ ] Admin grant/revoke works
- [ ] All Pro features gated correctly
- [ ] Webhooks process correctly
- [ ] Database updates sync
- [ ] No SQL errors in logs
- [ ] No Stripe API errors
- [ ] User subscription_logs populated

**Status**: Ready for Production 🚀

---

**Last Updated**: April 2026
