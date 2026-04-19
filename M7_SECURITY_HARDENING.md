# M7 - Security Hardening Milestone

**Status**: 🔴 NOT STARTED
**Priority**: CRITICAL - All issues must be fixed before production deployment
**Deadline**: Before any production release
**Owner**: Security Team

---

## Executive Summary

A comprehensive security audit identified **20 vulnerabilities** across the Trade Reflection codebase:
- **4 CRITICAL** - Immediate action required
- **6 HIGH** - Must fix before production
- **7 MEDIUM** - Fix within sprint
- **3 LOW** - Fix as best effort

**Risk Level**: 🔴 **CRITICAL** - Multiple vulnerabilities allow unauthorized access, billing fraud, and data exposure.

---

## CRITICAL ISSUES (Fix Immediately)

### C1: Hardcoded API Secrets in Version Control
**Severity**: 🔴 CRITICAL
**Status**: 🔴 NOT STARTED
**Effort**: 2 hours

**Files Affected**:
- `.env`
- `.env.local`
- `.env.production`

**Description**:
Exposed API keys in git repository including:
- Anthropic API key
- Stripe secret key
- Finnhub API key
- Supabase JWT token

**Impact**:
- Attackers can impersonate the app to Claude AI
- Can make fraudulent Stripe transactions
- Can access all user data in Supabase
- Bills could skyrocket from API abuse

**Fix Steps**:
- [ ] Rotate ALL exposed API keys immediately:
  - [ ] Anthropic: https://console.anthropic.com/account/keys
  - [ ] Stripe: https://dashboard.stripe.com/apikeys
  - [ ] Finnhub: https://finnhub.io/account/api-key
  - [ ] Supabase: Generate new API keys in dashboard
- [ ] Remove secrets from git history:
  ```bash
  git filter-branch --tree-filter 'rm -f .env .env.local .env.production' -- --all
  git push origin --force --all
  ```
- [ ] Add to `.gitignore`:
  ```
  .env
  .env.local
  .env.production
  .env.*.local
  ```
- [ ] Setup GitHub Secrets for CI/CD:
  - ANTHROPIC_API_KEY
  - STRIPE_SECRET_KEY
  - FINNHUB_API_KEY
  - VITE_SUPABASE_ANON_KEY
- [ ] Setup Vercel/Railway environment variables for each environment
- [ ] Document secret management policy in SECURITY.md

**Testing**:
- [ ] Confirm no secrets in git log: `git log -p | grep -i "sk_" | wc -l` (should be 0)
- [ ] Verify app still works with rotated keys
- [ ] Test all API calls with new keys

---

### C2: Client-Side Admin Access Control
**Severity**: 🔴 CRITICAL
**Status**: 🔴 NOT STARTED
**Effort**: 4 hours

**Files Affected**:
- `src/pages/AdminDashboardPage.tsx` (line 27)

**Description**:
Admin privileges checked only in frontend JavaScript. Can be bypassed with:
- Browser DevTools
- Modified localStorage
- Browser extensions
- Network interception

**Impact**:
- Unauthorized users can grant themselves Pro access
- Can revoke Pro access from legitimate users
- Can view all user subscription data
- Defeats entire billing system

**Fix Steps**:
- [ ] Create `admin_users` table in Supabase:
  ```sql
  CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'admin',  -- admin, moderator, etc
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id)
  );

  CREATE RLS POLICY "Admins can view admin list" ON admin_users
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM admin_users));
  ```

- [ ] Add admin user (your ID):
  ```sql
  INSERT INTO admin_users (user_id, role) VALUES ('YOUR_USER_ID_HERE', 'admin');
  ```

- [ ] Update `lib/stripeRoutes.mjs` to check admin status:
  ```javascript
  async function requireAdmin(req, res, next) {
    const user = await getAuthUser(req)
    const { data: admin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!admin) {
      return res.status(403).json({ error: 'Admin access required' })
    }
    req.user = user
    next()
  }

  app.post('/api/stripe/grant-pro', requireAdmin, handler)
  ```

- [ ] Update `src/pages/AdminDashboardPage.tsx`:
  ```typescript
  // Remove client-side check entirely
  // OR keep it as UX optimization but always verify on backend
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdminStatus()  // Fetch from backend
  }, [])

  const checkAdminStatus = async () => {
    const { data } = await supabase
      .rpc('is_user_admin', { user_id: user?.id })
    setIsAdmin(data?.is_admin || false)
  }
  ```

- [ ] Remove hardcoded email checks:
  ```typescript
  // REMOVE THIS:
  // const isAdmin = user?.email?.endsWith('@admin.stock-journal.com') || user?.email === 'bdesai2@gmail.com'

  // Use only server-side verification
  ```

**Testing**:
- [ ] Try calling `/api/stripe/*` endpoints as regular user → should get 403
- [ ] Try modifying localStorage to fake admin → should still get 403
- [ ] Try calling as actual admin → should work
- [ ] Verify audit logs show admin actions

---

### C3: Unprotected RPC Function Access
**Severity**: 🔴 CRITICAL
**Status**: 🔴 NOT STARTED
**Effort**: 3 hours

**Files Affected**:
- `database-migrations/admin_functions.sql`
- `src/pages/AdminDashboardPage.tsx`
- `lib/stripeRoutes.mjs`

**Description**:
RPC functions `grant_pro_access`, `revoke_pro_access`, `get_user_subscription_info` are callable by any authenticated user. No server-side authorization checks.

**Impact**:
- Any user can upgrade themselves to Pro for free
- Any user can downgrade other users
- Any user can enumerate all users' subscription data

**Fix Steps**:
- [ ] Update `database-migrations/admin_functions.sql`:

```sql
-- BEFORE: No auth check
CREATE OR REPLACE FUNCTION grant_pro_access(target_user_id UUID, notes TEXT)
RETURNS jsonb AS $$
BEGIN
  -- AFTER: Add this at the start
  IF auth.uid() NOT IN (SELECT user_id FROM admin_users) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- ... rest of function
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] Apply same fix to:
  - [ ] `revoke_pro_access()`
  - [ ] `get_user_subscription_info()`

- [ ] Update RPC calls in backend to use service role for internal operations only:
  ```javascript
  // For admin operations, use service role key
  const adminClient = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // Server-only!
  )
  ```

- [ ] Re-run migrations in Supabase SQL editor:
  ```bash
  # From Supabase Dashboard → SQL Editor
  # Paste updated admin_functions.sql
  # Execute
  ```

**Testing**:
- [ ] Call `get_user_subscription_info` as regular user → should error
- [ ] Call `grant_pro_access` as regular user → should error (403)
- [ ] Call as admin user → should work
- [ ] Verify non-admin users can't view others' subs

---

### C4: Unprotected AI API Endpoints
**Severity**: 🔴 CRITICAL
**Status**: 🔴 NOT STARTED
**Effort**: 3 hours

**Files Affected**:
- `lib/aiRoutes.mjs` (all 5 AI endpoints)

**Description**:
AI endpoints (`/api/ai/grade-trade`, `/api/ai/setup-check`, etc.) have NO authentication. Anyone can call them and consume Anthropic API credits.

**Impact**:
- Attackers can make unlimited AI requests → massive bill
- Can analyze sensitive trading data without owning it
- Potential DoS attacks
- Untracked usage for audit

**Fix Steps**:
- [ ] Create authentication middleware in `lib/aiRoutes.mjs`:

```javascript
// Add before route definitions
async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const token = authHeader.slice(7)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  req.user = data.user
  next()
}
```

- [ ] Apply middleware to all AI routes:
```javascript
// OLD:
app.post('/api/ai/grade-trade', async (req, res) => { ... })

// NEW:
app.post('/api/ai/grade-trade', authenticateRequest, async (req, res) => { ... })
```

- [ ] Add to routes:
  - [ ] `/api/ai/grade-trade`
  - [ ] `/api/ai/setup-check`
  - [ ] `/api/ai/trade-analysis`
  - [ ] `/api/ai/weekly-digest`
  - [ ] `/api/ai/potential-trade`

- [ ] Add rate limiting (see HIGH priority issue #15)

**Testing**:
- [ ] Call endpoint without auth header → 401
- [ ] Call with invalid token → 401
- [ ] Call with valid token → works
- [ ] Check server logs for auth failures

---

## HIGH SEVERITY ISSUES

### H1: Unrestricted CORS Configuration
**Severity**: 🔴 HIGH
**Status**: 🔴 NOT STARTED
**Effort**: 1 hour

**Files Affected**:
- `server.mjs` (line 27)

**Fix**:
```javascript
// BEFORE:
app.use(cors())

// AFTER:
app.use(cors({
  origin: process.env.VITE_APP_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}))
```

**Testing**:
- [ ] Call API from different origin → should be blocked
- [ ] Call from allowed origin → should work

---

### H2: Stripe Webhook Secret Not Configured
**Severity**: 🔴 HIGH
**Status**: 🔴 NOT STARTED
**Effort**: 1 hour

**Files Affected**:
- `.env` (line 12)
- `lib/stripeRoutes.mjs` (lines 319-327)

**Fix**:
- [ ] Get real webhook secret from Stripe:
  1. Go to https://dashboard.stripe.com/webhooks
  2. Click on your endpoint
  3. Scroll to "Signing secret"
  4. Click "Reveal" and copy

- [ ] Update `.env`:
  ```env
  STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
  ```

- [ ] Make it required in code:
```javascript
// BEFORE:
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
if (!webhookSecret) {
  console.warn('STRIPE_WEBHOOK_SECRET not configured')
  return res.sendStatus(200)  // BUG: Accept unverified!
}

// AFTER:
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
if (!webhookSecret) {
  throw new Error('STRIPE_WEBHOOK_SECRET must be configured')
}
```

**Testing**:
- [ ] Send fake webhook → should be rejected
- [ ] Send real webhook → verify signature and process

---

### H3: Weak Stripe Webhook User ID Verification
**Severity**: 🔴 HIGH
**Status**: 🔴 NOT STARTED
**Effort**: 2 hours

**Files Affected**:
- `lib/stripeRoutes.mjs` (lines 352-367)

**Current Vulnerable Code**:
```javascript
const userId = session.subscription_data?.metadata?.user_id
// metadata is NOT verified against Stripe customer!
```

**Fix**:
```javascript
// Verify metadata matches Stripe customer
const customerId = session.customer
const { data: subscription } = await supabase
  .from('user_subscriptions')
  .select('user_id, stripe_customer_id')
  .eq('stripe_customer_id', customerId)
  .single()

if (!subscription) {
  console.error('Webhook: Customer not found in database')
  return res.status(400).json({ error: 'Invalid customer' })
}

const userId = subscription.user_id  // Use DB value, not untrusted metadata
```

**Testing**:
- [ ] Send webhook with mismatched user_id → reject
- [ ] Send webhook with fake user_id → reject
- [ ] Send valid webhook → process correctly

---

### H4: Insufficient Stripe Token Validation
**Severity**: 🔴 HIGH
**Status**: 🔴 NOT STARTED
**Effort**: 2 hours

**Files Affected**:
- `lib/stripeRoutes.mjs` (lines 30-44)

**Fix**:
```javascript
async function getAuthUser(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization header')
  }

  const token = authHeader.slice(7)

  // Validate token format and signature
  try {
    const { data, error } = await supabase.auth.getUser(token)
    if (error) throw error

    // Check token not revoked
    if (!data?.user?.id) {
      throw new Error('Invalid user')
    }

    return data.user
  } catch (err) {
    console.error('Authentication failed:', err.message)
    throw new Error('Authentication failed')
  }
}
```

---

### H5: Admin User ID Exposure
**Severity**: 🔴 HIGH
**Status**: 🔴 NOT STARTED
**Effort**: 1 hour

**Fix**:
- [ ] Remove `REACT_APP_ADMIN_USER_ID` from `.env`
  - [ ] Delete from `.env` file
  - [ ] Remove from `.env.local`
  - [ ] Remove from git history

- [ ] Use admin_users table for all admin checks (see C2)

---

### H6: Missing Request Size Limits
**Severity**: 🔴 HIGH
**Status**: 🔴 NOT STARTED
**Effort**: 1 hour

**Files Affected**:
- `server.mjs` (line 30)

**Fix**:
```javascript
// BEFORE:
app.use(express.json())

// AFTER:
app.use(express.json({ limit: '10kb' }))
app.use(express.raw({
  type: 'application/json',
  path: '/api/stripe/webhook',
  limit: '5mb'  // Stripe webhooks need more space
}))
```

**Testing**:
- [ ] Send payload > 10kb (non-webhook) → rejected
- [ ] Send normal payload → accepted
- [ ] Send webhook with valid size → accepted

---

## MEDIUM SEVERITY ISSUES

### M1: Missing Input Validation Middleware
**Severity**: 🟡 MEDIUM
**Status**: 🔴 NOT STARTED
**Effort**: 2 hours

**Fix**:
- [ ] Add validation middleware for all inputs
- [ ] Minimum search length validation
- [ ] Email format validation
- [ ] UUID format validation

### M2: Missing Security Headers
**Severity**: 🟡 MEDIUM
**Status**: 🔴 NOT STARTED
**Effort**: 2 hours

**Files Affected**:
- `vercel.json`

**Fix**:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co https://*.stripe.com https://api.anthropic.com https://api.finnhub.io"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=()"
        }
      ]
    }
  ]
}
```

---

### M3: localStorage Misuse
**Severity**: 🟡 MEDIUM
**Status**: 🔴 NOT STARTED
**Effort**: 1 hour

**Fix**:
- [ ] Remove sensitive data from localStorage
- [ ] Use secure, HttpOnly cookies for session
- [ ] Validate account ownership on every API call

---

### M4: Missing Rate Limiting
**Severity**: 🟡 MEDIUM
**Status**: 🔴 NOT STARTED
**Effort**: 3 hours

**Fix**:
```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit'

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,  // 10 requests per minute
  message: 'Too many requests, please try again later'
})

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,  // More restrictive for expensive operations
  skipSuccessfulRequests: false
})

app.post('/api/ai/*', aiLimiter, ...)
app.use(apiLimiter)
```

---

### M5: Error Message Information Disclosure
**Severity**: 🟡 MEDIUM
**Status**: 🔴 NOT STARTED
**Effort**: 2 hours

**Fix**:
- [ ] Sanitize all error messages
- [ ] Log detailed errors server-side
- [ ] Return generic errors to clients
- [ ] Implement proper error tracking (Sentry)

---

### M6: Insufficient Logging
**Severity**: 🟡 MEDIUM
**Status**: 🔴 NOT STARTED
**Effort**: 4 hours

**Fix**:
- [ ] Log all admin actions with user ID and timestamp
- [ ] Log all payment events
- [ ] Log all authentication failures
- [ ] Log all API errors with request IDs
- [ ] Rotate logs after 30 days
- [ ] Never log sensitive data (API keys, tokens, passwords)

---

### M7: No Audit Trail System
**Severity**: 🟡 MEDIUM
**Status**: 🔴 NOT STARTED
**Effort**: 4 hours

**Fix**:
- [ ] Create `audit_logs` table (already exists but not used)
- [ ] Log to audit table on:
  - [ ] Admin grants Pro access
  - [ ] Admin revokes Pro access
  - [ ] User starts trial
  - [ ] User upgrades to Pro
  - [ ] User cancels subscription
  - [ ] User accesses admin dashboard

---

## LOW SEVERITY ISSUES

### L1: Missing .well-known/security.txt
**Severity**: 🟢 LOW
**Status**: 🔴 NOT STARTED
**Effort**: 30 min

**Fix**:
Create `public/.well-known/security.txt`:
```
Contact: security@example.com
Expires: 2025-12-31T23:59:59.000Z
Preferred-Languages: en
```

---

### L2: Missing Subresource Integrity (SRI)
**Severity**: 🟢 LOW
**Status**: 🔴 NOT STARTED
**Effort**: 1 hour

**Fix**:
- [ ] Add SRI hashes to all external CDN resources
- [ ] Document in SECURITY.md

---

### L3: Verbose Server Logging
**Severity**: 🟢 LOW
**Status**: 🔴 NOT STARTED
**Effort**: 30 min

**Fix**:
```javascript
if (process.env.NODE_ENV !== 'production') {
  console.log(`Server listening on port ${PORT}`)
}
```

---

## IMPLEMENTATION ROADMAP

### Phase 1: Emergency (THIS WEEK)
**Goal**: Stop immediate security threats

**Priority**:
1. ✅ C1: Rotate API keys immediately
2. ✅ C2: Implement server-side admin checks
3. ✅ C3: Add authorization to RPC functions
4. ✅ C4: Add authentication to AI endpoints
5. ✅ H1: Restrict CORS
6. ✅ H2: Configure Stripe webhook secret

**Deliverable**: Basic security foundation

### Phase 2: High Priority (THIS SPRINT)
**Goal**: Eliminate high-severity vulnerabilities

**Tasks**:
1. ✅ H3-H6: Fix remaining HIGH issues
2. ✅ M1-M2: Add input validation & security headers
3. ✅ Implement rate limiting
4. ✅ Add comprehensive error handling

**Deliverable**: Production-ready security baseline

### Phase 3: Medium Priority (NEXT SPRINT)
**Goal**: Implement audit & logging systems

**Tasks**:
1. ✅ M6: Implement complete logging
2. ✅ M7: Audit trail for all sensitive actions
3. ✅ Create security documentation
4. ✅ Security testing & QA

**Deliverable**: Audit trail & compliance ready

### Phase 4: Low Priority (BACKLOG)
**Goal**: Polish and hardening

**Tasks**:
1. ✅ Implement security.txt
2. ✅ Add SRI to external resources
3. ✅ Penetration testing
4. ✅ Security training for team

---

## DEFINITION OF DONE

A security fix is complete when:
- [ ] Code changes implemented and reviewed
- [ ] All tests passing
- [ ] No new security issues introduced
- [ ] Documented in changelog
- [ ] Updated SECURITY.md
- [ ] Verified in staging environment
- [ ] Audit log shows the change

---

## PRODUCTION CHECKLIST

✅ **DO NOT DEPLOY WITHOUT COMPLETING:**

- [ ] All CRITICAL issues fixed and tested
- [ ] All HIGH issues fixed and tested
- [ ] Security review completed
- [ ] Penetration test passed
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Webhook secret configured
- [ ] API keys rotated
- [ ] Admin users properly configured
- [ ] Logging system in place
- [ ] Security headers configured
- [ ] Stripe webhook verified
- [ ] Database RLS policies verified
- [ ] Error handling sanitized
- [ ] No hardcoded secrets
- [ ] .gitignore includes .env files
- [ ] Secret management system in place

---

## RESOURCES

- OWASP Top 10 2021: https://owasp.org/Top10/
- Stripe Security: https://stripe.com/docs/security
- Supabase Security: https://supabase.com/docs/security
- CWE List: https://cwe.mitre.org/
- NIST Cybersecurity: https://www.nist.gov/cyberframework

---

**Last Updated**: April 2026
**Created By**: Security Audit
**Status**: 🔴 CRITICAL - Requires immediate action before production deployment
