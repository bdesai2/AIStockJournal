# M6 Security Implementation Checklist

## Phase 1: Legal Documents ✅

- [x] Privacy Policy page (`/privacy`)
- [x] Terms of Service page (`/terms`)
- [x] Disclaimers page (`/disclaimers`)
- [x] Cookie Policy page (`/cookie-policy`)
- [x] Footer with legal links
- [x] All pages accessible from authenticated routes

## Phase 2: GDPR Compliance ✅

- [x] Data Export (JSON) — Full user data backup
- [x] Data Export (CSV) — Trades in portable format
- [x] Account Deletion — Cascading delete of all associated data
- [x] Audit Logging — Track all sensitive actions
- [x] Audit Log Viewer — View activity in Settings
- [x] 30-day backup retention period documented
- [x] Privacy Settings Section in Settings page
- [x] Audit log retention policies documented

## Phase 3: Cookie Management ✅

- [x] Cookie Consent Banner — First-visit disclosure
- [x] Cookie Preferences Modal — Granular controls
- [x] Essential Cookies (always on) — Authentication, CSRF
- [x] Analytics Cookies (opt-in) — Google Analytics
- [x] Marketing Cookies (opt-in, disabled) — Future feature
- [x] Cookie Preferences Hook — React component integration
- [x] Cookie Settings Section — Settings page integration
- [x] localStorage persistence — Preferences saved
- [x] GDPR compliance — Explicit consent before tracking

## Phase 4: Security Hardening ✅

### Input Validation & Sanitization
- [x] XSS protection — React escaping + manual sanitization
- [x] SQL injection detection — Parameterized queries + detection util
- [x] CSRF protection — Supabase automatic tokens
- [x] Input validation schemas — Zod validation for all forms
  - [x] Email validation
  - [x] Password strength (8+ chars, mixed case, number, special char)
  - [x] Ticker symbol format
  - [x] URL validation
  - [x] Numeric field validation
  - [x] Percentage validation
  - [x] Date validation
  - [x] Trade form validation

### Session Management
- [x] Inactivity timeout — 30 minutes
- [x] Timeout warning — 5 minutes before logout
- [x] Activity tracking — Mouse, keyboard, scroll, touch, click
- [x] Session Timeout Warning modal
- [x] Extendable session — "Stay Logged In" button
- [x] Auto-logout — Redirects to login on timeout

### Rate Limiting
- [x] Client-side rate limiting — RateLimiter class
- [x] Login rate limiting — 5 attempts / 15 minutes
- [x] Export rate limiting — 1 per hour
- [x] Delete rate limiting — 1 per 24 hours
- [x] Server-side rate limiting — Via Supabase (to configure)

### Code Security
- [x] TypeScript strict mode — Catches type errors
- [x] No dangerous HTML rendering — No dangerouslySetInnerHTML
- [x] Parameterized queries — Via Supabase client
- [x] Environment variable management — .env.example created
- [x] Secret handling — Documented best practices

### HTTP Security Headers
- [x] CSP (Content Security Policy) — Configuration template
- [x] X-Content-Type-Options — MIME sniffing prevention
- [x] X-Frame-Options — Clickjacking prevention
- [x] X-XSS-Protection — Legacy XSS protection
- [x] Referrer-Policy — Referrer control
- [x] Permissions-Policy — Feature restrictions
- [x] HSTS — HTTPS enforcement (template)
- [x] Configuration samples — For Vercel, Netlify, Nginx

### Documentation
- [x] SECURITY.md — Security policy & vulnerability reporting
- [x] .env.example — Environment variable guide
- [x] securityHeaders.ts — HTTP headers configuration
- [x] validation.ts — Input validation utilities
- [x] useSessionTimeout.ts — Session timeout hook

## Before Production Deployment

### Required Actions
- [ ] **Configure HTTP Security Headers** — Set up via hosting provider
  - [ ] Vercel: Update vercel.json
  - [ ] Netlify: Update netlify.toml
  - [ ] Other: Configure via provider dashboard
- [ ] **Enable HTTPS** — Enforce SSL/TLS 1.3+
- [ ] **Configure HSTS** — Set Strict-Transport-Security header
- [ ] **Set up Rate Limiting** — Configure server-side limits (Supabase)
- [ ] **Enable CORS** — Restrict to your domain only
- [ ] **Review RLS Policies** — Verify Supabase row-level security
- [ ] **Set up Audit Logging** — Database triggers for sensitive operations
- [ ] **Configure Backups** — Database backup retention policies
- [ ] **Enable Database Encryption** — At-rest encryption via Supabase
- [ ] **Set up Monitoring** — Error tracking, performance monitoring
- [ ] **Configure CDN** — If using Cloudflare or similar

### Recommended Actions
- [ ] **2FA Implementation** — TOTP-based two-factor authentication
- [ ] **Penetration Testing** — Third-party security audit
- [ ] **Dependency Scanning** — Regular npm audit checks
- [ ] **Log Monitoring** — Set up alerts for suspicious activity
- [ ] **Incident Response Plan** — Document security incident procedures
- [ ] **Security Training** — Team awareness of OWASP Top 10
- [ ] **Regular Security Reviews** — Quarterly security assessments

### Testing Checklist
- [ ] **XSS Testing** — Inject scripts into form fields
- [ ] **SQL Injection Testing** — Test with SQL commands in inputs
- [ ] **CSRF Testing** — Verify CSRF token validation
- [ ] **Session Timeout Testing** — Verify auto-logout works
- [ ] **Rate Limiting Testing** — Test limits on login/export/delete
- [ ] **GDPR Testing** — Test data export and account deletion
- [ ] **Cookie Testing** — Verify consent management works
- [ ] **Header Testing** — Use securityheaders.com to verify headers
- [ ] **HTTPS Testing** — Verify all connections use HTTPS
- [ ] **Authentication Testing** — Test login, logout, session handling

## Post-Deployment Monitoring

- [ ] Monitor error logs for security issues
- [ ] Review audit logs weekly
- [ ] Check dependency vulnerabilities monthly
- [ ] Perform security reviews quarterly
- [ ] Update this checklist as new features are added
- [ ] Track and resolve CVEs promptly

## Notes

### Supabase Configuration
- Row-level security (RLS) enabled for all tables
- Audit logs table created with 1-year retention
- Cascading deletes configured for account deletion
- Backups configured via Supabase dashboard

### Third-Party Security
- All third-party services reviewed for security certifications
- API keys stored securely in environment variables
- No credentials logged or exposed in error messages

### Compliance
- GDPR — Right to access, erasure, portability implemented
- CCPA — Privacy policy and opt-out mechanisms in place
- OWASP Top 10 — Awareness and mitigation strategies documented

---

## Sign-Off

- [ ] Security review completed by: ________________
- [ ] All required actions completed by: ________________
- [ ] Production deployment approved by: ________________
- [ ] Date: ________________

This checklist should be reviewed and updated as new features are added or security concerns emerge.
