# Security Policy

## Overview

Trade Reflection takes security and privacy seriously. This document outlines our security practices and how to report vulnerabilities.

## Security Measures

### 1. Authentication & Authorization
- **OAuth 2.0 via Google** — Industry-standard authentication
- **Session Management** — Sessions expire after 30 minutes of inactivity
- **Session Timeout Warning** — 5-minute warning before auto-logout
- **HTTPS Only** — All communication encrypted in transit
- **Supabase RLS Policies** — Row-level security ensures users can only access their own data

### 2. Input Validation & Sanitization

#### XSS Protection
- React's built-in XSS protection (automatic escaping of JSX)
- Manual sanitization of user inputs using `sanitizeInput()`
- Content Security Policy (CSP) headers (server-side configuration)
- No `dangerouslySetInnerHTML` usage without explicit review

#### SQL Injection Protection
- Parameterized queries via Supabase client (prevents SQL injection)
- SQL injection detection utility in `validation.ts`
- Server-side validation on all API endpoints

#### CSRF Protection
- Supabase handles CSRF tokens automatically
- Same-site cookie policy enforced
- POST/PUT/DELETE requests require authentication

#### Input Validation
- Zod schema validation on all forms:
  - Email format validation
  - Password strength requirements (8+ chars, uppercase, lowercase, number, special char)
  - Ticker symbol format (4-5 alphanumeric, uppercase)
  - Numeric field validation (prices, quantities)
  - Date format validation
- Maximum length limits on all text inputs
- Type safety via TypeScript strict mode

### 3. Data Security

#### Encryption
- **In Transit** — HTTPS/TLS 1.3+
- **At Rest** — Supabase database encryption
- **Passwords** — Bcrypt hashing via Supabase Auth

#### Data Access
- **Row-Level Security (RLS)** — Database policies verify `user_id` before returning data
- **Account Scoping** — Trades filtered by `account_id` (user cannot access other accounts)
- **No Credentials Stored** — Passwords, API keys never logged or stored

#### Data Retention
- **Active Accounts** — Data retained indefinitely
- **Deleted Accounts** — Permanently removed within 30 days
- **Audit Logs** — Retained for 1 year for compliance
- **Backups** — May contain data for up to 90 days

### 4. Rate Limiting

#### Client-Side Rate Limiting
- Login attempts: 5 per 15 minutes
- Data exports: 1 per hour
- Account deletions: 1 per 24 hours

#### Server-Side Rate Limiting
- Supabase Auth rate limiting on login/signup
- API function execution limits
- Should be configured via Supabase dashboard

### 5. Session Security

#### Inactivity Timeout
- Auto-logout after 30 minutes of inactivity
- Warning notification 5 minutes before logout
- Activity tracked via: mouse, keyboard, scroll, touch, click events
- User can extend session by clicking "Stay Logged In"

#### Session Invalidation
- Logout invalidates session immediately
- Signing out from one device does not affect other sessions
- For security-sensitive ops (data export, account deletion): re-authentication recommended

### 6. Third-Party Services

#### Trusted Integrations
- **Supabase** — Database, authentication, storage (SOC 2 certified)
- **Google OAuth** — Authentication provider (Google Trust Services)
- **Claude AI (Anthropic)** — Trade analysis (no data retained)
- **Yahoo Finance** — Market data (read-only API)
- **Finnhub** — Market data (read-only API)

#### Data Shared
- **Supabase**: All user data
- **Google OAuth**: Email only (no other Google data accessed)
- **Claude AI**: Trade data for analysis (not retained by Anthropic)
- **Yahoo Finance/Finnhub**: Only ticker symbols (no personal info)

### 7. Cookie Security

#### Secure Cookies
- `samesite=Strict` — CSRF protection
- `secure=true` — HTTPS only
- `httponly` — JavaScript cannot access (prevents XSS theft)

#### Cookie Types
- **Essential** (Always On): Supabase session, CSRF token
- **Analytics** (Opt-In): Google Analytics (anonymized)
- **Marketing** (Opt-In): Currently disabled

See `Cookie Policy` for full details.

### 8. GDPR & Privacy Compliance

#### User Rights
- ✅ Right to Access — Export all data in JSON format
- ✅ Right to Portability — CSV export for data portability
- ✅ Right to Erasure — Delete account and all associated data
- ✅ Right to Object — Opt-out of analytics cookies

#### Audit Trail
- All sensitive actions logged (exports, deletions, logins)
- Logs include timestamp, action, user agent
- Retained per legal requirements (recent: 90 days, sensitive: 1 year)

See `Privacy Policy` for full details.

### 9. Code Security

#### Dependency Management
- Regular `npm audit` checks
- Automatic security updates via Dependabot
- Critical vulnerabilities addressed immediately
- Lock file (`package-lock.json`) ensures reproducible builds

#### TypeScript Strict Mode
- `strict: true` in `tsconfig.json`
- Catches null/undefined errors at compile time
- Type-safe code reduces runtime vulnerabilities

#### Code Review
- All changes reviewed before deployment
- Security checklist for PRs
- Automated linting (ESLint) and type checking (TypeScript)

## Reporting Vulnerabilities

### Responsible Disclosure

If you discover a security vulnerability, **please do not open a public GitHub issue**. Instead:

1. **Email**: bdesai2@gmail.com
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any proof-of-concept (optional)
3. **Wait**: We will respond within 48 hours and work with you to resolve

### Disclosure Timeline
- **48 hours**: Initial response
- **7 days**: Assessment and fix plan
- **30 days**: Security patch released (if verified)
- **90 days**: Public disclosure (if no fix available)

### Non-Vulnerability Inquiries
For security questions or advice (not a specific vulnerability):
- Email: bdesai2@gmail.com
- Include context and details

## Best Practices for Users

### Protect Your Account
- ✅ Use a **strong, unique password** (8+ chars, mixed case, numbers, symbols)
- ✅ **Never share your session link** with others
- ✅ **Log out** when done, especially on shared devices
- ✅ **Review activity log** in Settings → Privacy & Data

### Safe Usage
- ✅ Use **HTTPS only** (should be automatic)
- ✅ **Don't paste sensitive data** into notes (stop losses, account balances)
- ✅ **Be careful with screenshots** — they may contain sensitive info
- ✅ **Keep browser updated** with latest security patches

### Report Suspicious Activity
- If you suspect unauthorized access:
  1. Change your password immediately
  2. Sign out all sessions (if available)
  3. Contact support: bdesai2@gmail.com

## Compliance

### Standards & Certifications
- OWASP Top 10 — Awareness of common vulnerabilities
- GDPR — Data protection compliance
- CCPA — California privacy rights
- SOC 2 — Via Supabase infrastructure

### Audit Readiness
- Logging for accountability
- Data encryption in transit and at rest
- Access controls and RLS policies
- Regular security updates

## Changes to This Policy

This Security Policy may be updated periodically. Significant changes will be communicated via:
- Email to registered users
- Notification in the app
- Updated `security.md` in repository

Last Updated: April 17, 2026

---

**Questions?** Contact bdesai2@gmail.com
