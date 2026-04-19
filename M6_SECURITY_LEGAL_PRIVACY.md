# M6: Security, Legal & Privacy Milestone Plan

## Overview
Comprehensive security hardening and legal compliance for Trade Reflection. Prioritized by compliance impact and implementation complexity.

---

## Phase 1: Legal Documents Foundation
**Goal:** Create legal documents required for regulatory compliance and user trust.
**Estimated Effort:** 2-3 hours (content creation, no code changes)

### 1.1 Privacy Policy Page
**Create:** `src/pages/PrivacyPolicyPage.tsx`

Content to cover:
- Data collection (user profile, trades, journal entries, IP address)
- Data usage (analytics, AI analysis, trade scoring)
- Third-party services (Supabase, Google OAuth, Claude API, Finnhub, Yahoo Finance)
- User rights (GDPR right to access, erasure, portability)
- Data retention policy
- Cookies and tracking
- Contact for privacy inquiries

**Route:** `/privacy` (public route, not protected)

### 1.2 Terms of Service Page
**Create:** `src/pages/TermsOfServicePage.tsx`

Content to cover:
- User eligibility and account requirements
- Acceptable use policy
- Intellectual property rights
- Limitation of liability
- Warranty disclaimers
- Service availability guarantees
- User responsibilities
- Governing law
- Changes to terms

**Route:** `/terms` (public route)

### 1.3 Disclaimers Page
**Create:** `src/pages/DisclaimersPage.tsx`

Content sections:
- **Trading Disclaimer:** "NOT investment advice. Past performance ≠ future results"
- **Risk Acknowledgment:** "Trading involves risk. You can lose money."
- **AI Analysis Disclaimer:** "Claude AI analysis is not investment advice"
- **Data Freshness:** "Price data may be delayed. Rely on broker data for trades"
- **Third-Party Data:** "Yahoo Finance data accuracy not guaranteed"

**Route:** `/disclaimers` (public)

### 1.4 Update Footer Component
**File:** `src/components/layout/Footer.tsx`

Add footer links to:
- Privacy Policy
- Terms of Service
- Disclaimers
- Security (SECURITY.md contact)
- GitHub (if applicable)

**Routes added to router.tsx:**
```typescript
{ path: 'privacy', element: <PrivacyPolicyPage /> },
{ path: 'terms', element: <TermsOfServicePage /> },
{ path: 'disclaimers', element: <DisclaimersPage /> },
```

---

## Phase 2: GDPR Compliance Features
**Goal:** Implement core GDPR rights: access, erasure, data portability.
**Estimated Effort:** 4-6 hours

### 2.1 Data Export Feature (Right to Access)
**Location:** Settings page → "Data & Privacy" section

**Functionality:**
- Export all user data as JSON:
  ```json
  {
    "profile": { ... },
    "accounts": [ ... ],
    "trades": [ ... ],
    "journal_entries": [ ... ]
  }
  ```
- Also export as CSV (trades table format for Excel)
- Button: "Download My Data"
- Trigger: Click button → generates file → downloads immediately
- No server-side storage needed

**Files to modify:**
- `src/pages/SettingsPage.tsx` — Add "Data & Privacy" section with export button
- `src/lib/dataExport.ts` — New utility functions:
  ```typescript
  export async function exportDataAsJson(userId: string): Promise<object>
  export async function exportTradesAsCsv(userId: string): Promise<string>
  export function downloadFile(content: string, filename: string, type: string)
  ```

**Implementation notes:**
- Query: user profile + all accounts + all trades + journal entries
- Filter by user_id (RLS handles this)
- Include created_at/updated_at timestamps
- Format cleanly for human readability

### 2.2 Full Account Deletion (Right to Erasure)
**Location:** Settings page → "Dangerous Zone" section

**Functionality:**
- Button: "Delete My Account"
- Modal confirmation: "This will permanently delete all data"
- Input field: Type "DELETE" to confirm
- On confirm:
  1. Delete all trades (cascades from account deletion)
  2. Delete all accounts
  3. Delete profile
  4. Sign out user
  5. Redirect to login with success message

**Database Flow:**
```
User initiates delete
  ↓
api_delete_user_account() function (Supabase SQL)
  ├─ DELETE FROM trades WHERE user_id = ?
  ├─ DELETE FROM accounts WHERE user_id = ?
  └─ DELETE FROM profiles WHERE id = ?
  ↓
Auth sign out
```

**Files to create:**
- `src/lib/accountDeletion.ts`:
  ```typescript
  export async function deleteUserAccount(userId: string): Promise<void>
  ```

**Files to modify:**
- `src/pages/SettingsPage.tsx` — Add "Dangerous Zone" section
- Supabase: Create `api_delete_user_account()` function that cascades deletes

### 2.3 Data Portability (Right to Data Portability)
**Reuse:** Export JSON from 2.1 covers this
**Difference:** Make it clear in UI that exported data can be used elsewhere

---

## Phase 3: Cookie Consent & Management
**Goal:** Implement cookie banner and consent tracking.
**Estimated Effort:** 3-4 hours

### 3.1 Cookie Consent Banner Component
**Create:** `src/components/layout/CookieConsent.tsx`

Shows on first visit, persists in localStorage.

**Categories:**
- ✅ Essential (always on) — Auth, session management
- Analytics (toggle) — Google Analytics, event tracking
- Marketing (toggle) — Future ad platforms

**localStorage key:** `cookie_consent`
```json
{
  "essential": true,
  "analytics": false,
  "marketing": false,
  "timestamp": "2024-04-17T..."
}
```

**Preferences:**
- "Accept All" button
- "Reject All" button
- "Customize" link → Opens preference modal

### 3.2 Cookie Policy Page
**Create:** `src/pages/CookiePolicyPage.tsx`

Details what cookies are set and why:
- Session cookie (Supabase)
- localStorage (theme, account selection, consent)
- Analytics (if enabled)

**Route:** `/cookie-policy`

### 3.3 Consent Tracking
**File:** `src/lib/consentManager.ts`

Functions:
```typescript
export function getConsent(): CookieConsent
export function setConsent(consent: CookieConsent): void
export function hasUserConsented(): boolean
export function isAnaylicsEnabled(): boolean
```

---

## Phase 4: AI-Specific Disclaimers & Transparency
**Goal:** Clear disclosures about AI limitations and data freshness.
**Estimated Effort:** 2-3 hours

### 4.1 AI Disclaimers throughout UI

**Dashboard:** (on AI analysis cards)
```
ℹ️ "This analysis is not investment advice.
   Claude score is experimental and may be inaccurate."
```

**Trade Detail Page:** (on AI scoring)
- Show model version (Claude Sonnet 4.6)
- Show generated timestamp
- Tooltip: "Learn more about AI limitations"

**New Trade Page:** (when calculating stop/risk)
- If auto-calculated: "⚠️ Verify stop loss before submitting"

### 4.2 "About AI" Information Page
**Create:** `src/pages/AboutAIPage.tsx`

Sections:
- **What Claude Does**
  - Analyzes trade setups
  - Scores news items
  - Generates summaries

- **What Claude Can't Do**
  - Predict future prices
  - Guarantee accuracy
  - Replace human judgment

- **Limitations**
  - Data freshness (API delays)
  - Model hallucinations possible
  - Trained on historical data only

- **Transparency**
  - Using Claude Sonnet 4.6 model
  - Prompts available in SECURITY.md
  - No trade data stored in Claude

**Route:** `/about-ai` (public)

### 4.3 Tooltip Components
**Create:** `src/components/ui/DisclosureTooltip.tsx`

Reusable component for info icons:
```typescript
<DisclosureTooltip text="AI analysis limitations and data sources" />
```

---

## Phase 5: Security Hardening
**Goal:** Strengthen authentication, audit trails, and API security.
**Estimated Effort:** 6-8 hours

### 5.1 Session Management & Timeout
**File:** `src/lib/sessionManager.ts`

Features:
- Track last user activity (click, scroll, input)
- Auto-logout after 30 minutes inactivity
- Show warning modal at 25 minutes
- Re-authenticate before sensitive ops (delete account, export data)

```typescript
export function useSessionTimeout(timeoutMs: number = 30 * 60 * 1000)
export function extendSession(): void
export function requireReauth(action: string): Promise<void>
```

### 5.2 Rate Limiting on Sensitive Endpoints
**Location:** Supabase RLS policies + API rate limits

**Sensitive operations:**
- Trade deletion
- Account deletion
- Data export
- Profile updates

**Implementation:**
- Add `last_batch_call` to profiles table
- Check rate limit in RLS policies
- Max 5 trade deletes per minute per user
- Max 1 account delete per account per day

### 5.3 Audit Logging
**File:** `src/lib/auditLog.ts`

Log sensitive actions:
```typescript
export async function logAudit(
  userId: string,
  action: 'ACCOUNT_DELETE' | 'DATA_EXPORT' | 'TRADE_DELETE' | 'PROFILE_UPDATE',
  details: object
): Promise<void>
```

**Create table:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  ip_address INET
)
```

### 5.4 RLS Policy Audit
**File:** `SECURITY_AUDIT.md`

Document:
- All RLS policies and what they protect
- Cross-account data isolation tests
- Trade ownership verification
- Account ownership verification

**Test scenarios:**
- User A can't see User B's trades ✓
- User A can't see User B's accounts ✓
- Account A's trades don't mix with Account B ✓
- Delete account deletes all trades (cascade) ✓

### 5.5 SECURITY.md File
**Create:** `SECURITY.md` in project root

Include:
- Vulnerability reporting process
- Security best practices
- Data encryption at rest/transit
- Third-party security audits
- Dependencies update policy
- AI prompt injection mitigation
- Contact for security issues (security@example.com)

---

## Phase 6: Enhanced Settings Page
**Goal:** Consolidate all privacy/security controls in one place.
**Estimated Effort:** 2-3 hours

**Update:** `src/pages/SettingsPage.tsx`

New sections:
1. **Trading Accounts** (already exists)
   - Create, edit, delete accounts

2. **Profile Settings** (already exists)
   - Display name, broker, timezone, risk %

3. **Data & Privacy** (NEW)
   - 📥 Download My Data (JSON)
   - 📥 Export Trades (CSV)
   - 🔗 Privacy Policy link
   - 🔗 Data Portability info

4. **Privacy Preferences** (NEW)
   - Cookie preferences
   - Analytics opt-out
   - Consent history view

5. **Security** (NEW)
   - ⏱️ Session timeout: 30 minutes (display only)
   - 🚨 2FA (future feature)
   - 📜 View audit log (future feature)

6. **Dangerous Zone** (NEW)
   - ⚠️ Delete My Account button
   - Warning: "This cannot be undone"

---

## Implementation Timeline

### Week 1: Foundation
- **Day 1:** Phase 1 (Legal documents) — 2-3 hrs
- **Day 2:** Phase 2.1 (Data export) — 2 hrs
- **Day 3:** Phase 2.2 (Account deletion) — 3 hrs
- **Day 4:** Phase 3 (Cookie consent) — 3 hrs
- **Day 5:** Phase 4 (AI disclaimers) — 3 hrs

### Week 2: Hardening
- **Day 6:** Phase 5.1-5.2 (Session management, rate limiting) — 4 hrs
- **Day 7:** Phase 5.3-5.5 (Audit logs, SECURITY.md) — 3 hrs
- **Day 8:** Phase 6 (Settings consolidation) — 2 hrs
- **Day 9:** Testing & bug fixes — 3 hrs
- **Day 10:** Deployment & documentation — 2 hrs

**Total Effort:** ~30 hours

---

## Database Changes Required

### New Tables
```sql
-- Audit logging
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW(),
  ip_address INET
);

-- Consent tracking (optional, if persisting server-side)
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  essential BOOLEAN DEFAULT TRUE,
  analytics BOOLEAN DEFAULT FALSE,
  marketing BOOLEAN DEFAULT FALSE,
  given_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, given_at)
);

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

### New Functions
```sql
-- Cascade delete user
CREATE OR REPLACE FUNCTION api_delete_user_account(user_id UUID)
RETURNS void AS $$
BEGIN
  -- Log the deletion
  INSERT INTO audit_logs (user_id, action, details)
  VALUES (user_id, 'ACCOUNT_DELETE', json_build_object('deleted_at', NOW()));

  -- Delete all trades
  DELETE FROM trades WHERE user_id = user_id;

  -- Delete all accounts
  DELETE FROM accounts WHERE user_id = user_id;

  -- Delete profile
  DELETE FROM profiles WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### RLS Updates
```sql
-- Existing tables need audit log access
GRANT SELECT ON audit_logs TO authenticated;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  USING (user_id = auth.uid());
```

---

## UI Components to Create

### New Pages
- `PrivacyPolicyPage.tsx` — Legal document
- `TermsOfServicePage.tsx` — Legal document
- `DisclaimersPage.tsx` — Risk disclaimers
- `CookiePolicyPage.tsx` — Cookie documentation
- `AboutAIPage.tsx` — AI transparency

### New Components
- `CookieConsent.tsx` — Banner shown on first visit
- `DisclosureTooltip.tsx` — Info icon with hover tooltip
- `SessionWarningModal.tsx` — "You will be logged out soon" warning

### Updated Components
- `Footer.tsx` — Add legal links
- `SettingsPage.tsx` — Add all new sections
- Trade detail cards — Add AI disclaimers

---

## Testing Checklist

### Legal & Compliance
- [ ] Privacy policy is accessible at `/privacy`
- [ ] Terms of Service is accessible at `/terms`
- [ ] All legal links work from footer
- [ ] GDPR/CCPA implications documented

### GDPR Compliance
- [ ] Data export includes all user data
- [ ] CSV export formats trades correctly
- [ ] Account deletion removes all associated data
- [ ] Account deletion is irreversible
- [ ] User is signed out after deletion

### Cookies & Consent
- [ ] Banner shows on first visit
- [ ] Consent persists across sessions
- [ ] User can change preference anytime
- [ ] Essential cookies work even if consent rejected

### AI Transparency
- [ ] AI risk disclaimers appear on relevant cards
- [ ] "About AI" page explains capabilities/limits
- [ ] Tooltips provide context
- [ ] Claude model version is disclosed

### Security
- [ ] Session timeout works at 30 minutes
- [ ] User gets warning at 25 minutes
- [ ] Audit log records sensitive actions
- [ ] Rate limiting prevents abuse

---

## RLS & Security Validation

### Cross-Account Tests
```sql
-- User A shouldn't see User B's data
SELECT * FROM trades WHERE user_id != auth.uid(); -- Should return 0 rows

-- Account isolation
SELECT * FROM trades t
WHERE t.account_id NOT IN (
  SELECT id FROM accounts WHERE user_id = auth.uid()
); -- Should return 0 rows
```

### Cascade Delete Test
```sql
DELETE FROM accounts WHERE id = ?; -- Should cascade delete all trades
SELECT COUNT(*) FROM trades
WHERE account_id = ? AND user_id = ?; -- Should be 0
```

---

## Success Criteria

✅ **Phase 1:** All legal pages accessible and readable
✅ **Phase 2:** User can export data and delete account
✅ **Phase 3:** Cookie consent banner works and persists
✅ **Phase 4:** AI disclaimers visible on relevant UI
✅ **Phase 5:** Session timeout, audit logs, rate limiting active
✅ **Phase 6:** Settings page consolidates all controls
✅ **Security:** No RLS bypasses, data properly isolated
✅ **Testing:** All scenarios pass manual testing

---

## Sign-Off & Deployment

- [ ] All phases complete
- [ ] TypeScript compiles without errors
- [ ] No console warnings/errors
- [ ] Manual testing passed
- [ ] Legal review by counsel (if needed)
- [ ] Deployed to production
- [ ] Privacy policy link in footer active

Date: ______________
Implementer: ______________
