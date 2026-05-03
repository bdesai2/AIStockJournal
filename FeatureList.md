# Trade Reflection - Central Feature Registry

Last updated: 2026-05-03
Purpose: This is the canonical feature inventory and milestone status for the stock-journal app.

## Milestone Status Snapshot

- [x] M1: Foundation, auth, trade CRUD
- [x] M2: Dashboard analytics and calendar journal
- [x] M3: AI-assisted trade analysis
- [x] M4: Advanced analytics views and insights
- [x] M5 (core): PWA foundation and offline-first data flow
- [x] M6.5: Subscription system (Free/Pro), Stripe, admin management
- [x] M6 (majority): Legal pages, privacy controls, cookie consent, data export, session timeout, audit visibility
- [ ] M5 (remaining polish): mobile/performance/report-export backlog items
- [ ] M6 (remaining production hardening): deployment checklist and compliance verification tasks
- [ ] M7 (remaining hardening): unresolved security audit items and validation tasks

---

## Implemented Features

### 1) Authentication and Access

- [x] Google OAuth sign-in via Supabase
- [x] Protected routes for authenticated app access
- [x] Auth callback flow
- [x] Session bootstrap on app startup
- [x] Sign-out flow with redirect

### 2) Profile and Account Management

- [x] User profile settings (display name, default risk percent, broker, timezone)
- [x] Multi-account model (per-account starting balance)
- [x] Account selector in app navigation
- [x] Create account
- [x] Edit account
- [x] Delete account
- [x] Persist selected account in localStorage
- [x] Account-scoped balances and stats

### 3) Trade Lifecycle (Core CRUD)

- [x] Create trade
- [x] Edit trade
- [x] Delete trade
- [x] View trade details
- [x] Track trade status (open, closed, partial)
- [x] Asset types (stock, option, ETF, crypto)
- [x] Direction support (long, short)
- [x] Executions tracking support
- [x] Screenshot attachments with secure storage policies

### 4) Trade Data and Risk Tracking

- [x] Entry and exit timestamps
- [x] Entry and exit pricing
- [x] Position sizing (quantity/contracts)
- [x] Fees and net PnL tracking
- [x] Stop-loss and take-profit fields
- [x] Initial risk and risk percent tracking
- [x] R-multiple calculations
- [x] Option-specific fields (legs/strategy context)
- [x] Automatic options multiplier handling

### 5) Search, Filters, and Trades Table UX

- [x] Trades search
- [x] Multi-filter support (asset, status, direction, grade)
- [x] Sorting options (date, PnL, PnL percent, R, ticker)
- [x] Filter persistence in localStorage
- [x] Responsive trade table behavior

### 6) Journal and Reflection

- [x] Monthly calendar journal view
- [x] Select day and edit day details
- [x] Daily market mood and personal mood capture
- [x] Pre-market and post-market notes
- [x] Daily goals and rules-reviewed tracking
- [x] Day-level PnL/trade summary integration

### 7) Dashboard and Analytics

- [x] KPI cards (PnL, win rate, profit factor, avg R, best trade)
- [x] Cumulative PnL curve
- [x] Daily PnL bars
- [x] PnL heatmap
- [x] PnL by strategy view
- [x] PnL by asset-type view
- [x] Recent trades widget with navigation

### 8) AI Features

- [x] Trade grading
- [x] Setup validation
- [x] Weekly digest generation
- [x] Open trade analysis
- [x] Potential trade evaluation
- [x] AI route auth middleware and protected server endpoints

### 9) Strategy Library

- [x] Strategy management page
- [x] Pro-gated strategy feature access

### 10) Subscription and Billing (M6.5)

- [x] Free tier and Pro tier model
- [x] Pricing page with feature comparison
- [x] Stripe checkout session integration
- [x] Stripe billing portal integration
- [x] Trial start flow
- [x] Cancel subscription flow
- [x] Subscription state in auth store
- [x] Pro badges, lock overlays, and upgrade modal
- [x] Feature-gate framework for core vs pro access

### 11) Admin Controls

- [x] Admin dashboard page
- [x] Backend admin check endpoint
- [x] Admin-only search users endpoint
- [x] Admin grant Pro endpoint
- [x] Admin revoke Pro endpoint
- [x] Database RPC admin guards for subscription admin functions

### 12) Legal, Privacy, and Cookie Controls

- [x] Privacy Policy page
- [x] Terms of Service page
- [x] Disclaimers page
- [x] Cookie Policy page
- [x] Legal links in footer
- [x] Cookie consent banner
- [x] Cookie preferences modal
- [x] Cookie preferences settings section
- [x] Data export UI (JSON/CSV)
- [x] Privacy settings section
- [x] Account deletion UI flow
- [x] Audit log viewer in settings

### 13) Security and Session Controls

- [x] API CORS restriction configuration
- [x] API rate limiting middleware (general and AI)
- [x] Request body size limits by route type
- [x] Global server error handler
- [x] Session timeout hook with warning/extend flow
- [x] Session timeout warning component in app layout
- [x] Validation utility module
- [x] Security headers config template

### 14) PWA, Offline, and Realtime

- [x] Manifest and app icons
- [x] Service worker registration (production)
- [x] Service worker file for caching/offline behavior
- [x] Install prompt hook and install UX
- [x] Offline queue utilities
- [x] Offline cache utilities
- [x] Online/offline status indicators
- [x] Realtime status hook
- [x] Realtime subscriptions for trades/executions/screenshots/journals
- [x] Sync notifications and pending/failure indicators

### 15) Navigation and UX Foundation

- [x] Desktop sidebar navigation
- [x] Mobile bottom navigation
- [x] Breadcrumbs for deep routes
- [x] Notification toaster integration
- [x] App footer with legal and compliance links


## Not Yet Completed (Tracked Backlog)

### M5 Mobile and Reporting Polish

- [x] Full-screen modal behavior on mobile for account management
- [x] Additional mobile form UX refinements
- [x] Lazy rendering for heavy dashboard visualizations
- [x] Additional mobile performance optimizations (bundle, image strategy)
- [x] Report/PDF export suite (monthly/quarterly/journal docs)
- [x] Trades export with date-range scope
- [x] Batch-selected trades export
- [x] Chart export (PNG/SVG) for dashboard Recharts visualizations
- [x] Extended cross-device and lighthouse validation checklist

### M6 Finalization and Production Readiness

- [x] Confirm production deployment headers and HSTS at hosting layer
- [x] Verify server-side enforcement for all privacy operation rate limits
- [x] End-to-end verification for full right-to-erasure scope (including auth-layer deletion)
- [x] Compliance and legal review sign-off process
- [x] Final security checklist sign-off ownership/date

### M7 Security Hardening Residuals

- [ ] Reconcile M7 audit document with current implemented fixes
- [ ] Complete unresolved high/medium checklist items still open
- [ ] Run and document retest evidence for fixed vulnerabilities
- [ ] Final production security review and approval gate

---

## Notes

- Account-level balance replaced the old single profile account-size model.
- M5 cross-device/lighthouse validation checklist is documented in docs/M5_VALIDATION_CHECKLIST.md.
- M6 compliance and sign-off workflow is documented in docs/M6_PRODUCTION_SIGNOFF.md.
- This file intentionally tracks implementation state in source code, not only planning docs.
- Update this file whenever a feature is shipped, changed, or deprecated.
