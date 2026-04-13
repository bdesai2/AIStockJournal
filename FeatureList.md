# Stock Journal - Feature List

## Milestone 1: Complete ✅

### Authentication & User Management
- **Google OAuth** - Sign in with Google via Supabase
- **User Profiles** - Create and manage user profiles on signup (auto-triggered via database trigger)
- **Profile Settings** - Configure:
  - Display name
  - Account size
  - Default risk percentage
  - Broker (text field)
  - Timezone (ET, CT, MT, PT, UTC)
- **Protected Routes** - Authenticated session management with loading state

---

## Trade Management (CRUD)

### Trade Logging
- **Create Trades** - Log new trades with comprehensive data entry
- **Edit Trades** - Modify existing trade details
- **Delete Trades** - Remove trades with confirmation
- **View Trade Details** - Full trade detail page with all information
- **Trade Status** - Track trades as Open, Closed, or Partial

### Asset Types Supported
- **Stocks** - Standard equity trades
- **Options** - Multi-leg option strategies with Greeks tracking
- **ETFs** - Exchange-traded funds
- **Crypto** - Digital assets with exchange specification

### Trade Direction
- **Long** - Buy and profit from price increases
- **Short** - Sell short and profit from price decreases

---

## Trade Data Tracking

### Core Trade Metrics
- **Entry & Exit Dates** - Date/time stamps with timezone support
- **Entry & Exit Prices** - Precise price tracking with 4 decimal places
- **Quantity** - Shares/units/contracts
- **Fees** - Transaction costs

### Risk Management
- **Stop Loss** - Price level to limit losses
- **Take Profit** - Price level to lock in gains
- **Initial Risk** - Dollar amount at risk
- **Risk Percentage** - % of account at risk
- **R-Multiple** - Risk-reward ratio calculated automatically

### Options-Specific
- **Option Legs** - Support for multi-leg strategies
  - Buy/Sell action per leg
  - Call/Put type
  - Strike price
  - Expiration date
  - Contracts (quantity)
  - Premium paid/received
  - Delta (optional)
  - Implied Volatility (optional)
- **Option Strategy Name** - Label the strategy (e.g., Bull Call Spread)
- **100x Multiplier** - Automatic calculation for options

### Crypto-Specific
- **Exchange** - Coinbase, Kraken, FTX, etc.

---

## Trade Categorization

### Strategy Tags
- Support for multiple pre-defined strategy tags
- Visual pill-style tags with primary color highlighting
- Fast filtering and search

### Market & Time Context
- **Timeframe** - 1m, 5m, 15m, 1h, 4h, Daily, Weekly
- **Duration** - Scalp, Swing, Long-term
- **Market Conditions** - Trending Up, Trending Down, Ranging, Volatile
- **Sector** - Predefined list with custom input
  - Auto-populated from Yahoo Finance API based on ticker
  - Manual override support

---

## Trade Journal & Notes

### Structured Journaling
- **Setup Notes** - Why did you take the trade? (Thesis and catalyst)
- **Entry Notes** - How was the entry executed?
- **Exit Notes** - Why did you exit?
- **Mistakes** - What would you do differently?
- **Lessons Learned** - Key takeaways

### Emotional Tracking
- **Emotional State** - Track mindset during trade:
  - Calm, FOMO, Fearful, Confident, Impulsive, Disciplined
- **Execution Quality** - Rate execution 1-5 stars

### Screenshots & Charts
- **Image Upload** - Attach multiple screenshots per trade
- **Secure Storage** - Supabase Storage with row-level security
- **Preview Thumbnails** - 24px × 24px image previews
- **Delete Capability** - Remove screenshots from trades

---

## Analytics & Dashboards

### Dashboard Overview
- **Stat Cards** - Key performance indicators:
  - Total P&L (with color-coded profit/loss)
  - Win Rate (winning vs losing trades)
  - Profit Factor (avg win / avg loss)
  - Avg R-Multiple (average risk-reward ratio)
  - Best Trade highlight

### Charts & Visualizations (Recharts)
- **Cumulative P&L Curve** - Line chart showing equity growth over time
- **Daily P&L Bars** - Last 30 days of daily profit/loss
- **P&L Activity Heatmap** - 52-week GitHub-style heatmap with intensity coloring
- **P&L by Strategy** - Horizontal bar chart with trade counts and win rates
- **P&L by Asset Type** - Relative bar widths showing performance by asset class

### Recent Trades Widget
- **Trade List** - 8 most recent trades with key metrics
- **Quick Navigation** - Click to view full trade details

---

## Trades List Page

### Search & Discovery
- **Full-Text Search** - Search by:
  - Ticker symbol
  - Strategy tags
  - Setup notes
- **Real-Time Filter** - Results update as you type

### Advanced Filtering
- **Asset Type Filter** - All Assets, Stock, Option, ETF, Crypto
- **Status Filter** - All Statuses, Open, Closed, Partial
- **Direction Filter** - All Directions, Long, Short
- **Grade Filter** - All Grades, A, B, C, D, F, Ungraded (–)

### Sorting Options
- **Entry Date** - Sort by trade entry date (ascending/descending)
- **Net P&L** - Sort by profit/loss amount
- **P&L %** - Sort by return percentage
- **R-Multiple** - Sort by risk-reward ratio
- **Ticker** - Alphabetical sorting

### Filter Persistence
- **Local Storage** - All filters and sort preferences saved to localStorage
- **Session Restoration** - Filters persist across page reloads

### Table Display
- **Responsive Design** - Mobile-friendly with column hiding on smaller screens
- **Detailed Rows** - Shows ticker, strategy, date, prices, qty, P&L, %, R

---

## Daily Journal Page

### Calendar View
- **Monthly Calendar** - Navigate months with prev/next buttons
- **Day Selection** - Click any day to view/edit details
- **Visual Indicators**:
  - Profit days colored green (#00d4a1)
  - Loss days colored red (#ff4d6d)
  - Days with journal entries marked with a dot
  - Current day highlighted in bold

### Daily P&L Summary
- **Per-Day Totals** - Shows P&L and trade count for each day
- **Closed Trades Only** - Tracks exit date for P&L

### Journal Entry Form
- **Market Mood** - Bullish, Neutral, Bearish
- **Personal Mood** - Emoji-based 1-5 rating (😫 to 😄)
- **Pre-Market Notes** - Outlook and planned trades for the day
- **Post-Market Notes** - Daily debrief and key lessons
- **Daily Goals** - One goal per line (stored as array)
- **Reviewed Rules** - Checkbox to track rule review

### Day Detail Panel
- **Trades List** - All trades closed on selected day with clickable navigation
- **Inline Editing** - Form auto-populates when day selected
- **Save/Update** - One-click save with loading state

---

## P&L & Risk Calculations

### Automatic P&L Calculation
- **Real-Time Calculation** - P&L preview on forms (client-side)
- **Database Trigger** - Persistent P&L calculated on insert/update
- **Gross vs Net** - Fees subtracted to show net P&L
- **Options Support** - 100x multiplier automatically applied

### Derived Metrics
- **P&L Percentage** - Return as percentage of capital invested
- **R-Multiple** - Profit relative to initial risk
- **Profit Factor** - Average winning trade / Average losing trade
- **Win Rate** - % of profitable trades
- **Unrealized P&L** - For open positions (live stock prices)

### Live Price Integration
- **Yahoo Finance API** - Fetch current stock prices
- **Open Position Tracking** - Real-time unrealized P&L for non-crypto
- **Silent Failure** - Graceful degradation if price unavailable

---

## AI Features

### Weekly Digest (for 5+ closed trades)
- **Pattern Recognition** - Identifies what's working and what's not
- **Positive Patterns** - Key winning setups and behaviors
- **Areas to Improve** - Losing patterns and mistakes
- **Actionable Lesson** - One focused insight for the week
- **Manual Refresh** - Re-run analysis on demand

### Setup Validation (when logging trades)
- **R/R Rating** - Excellent, Good, Acceptable, Poor
- **Setup Quality** - Strong, Moderate, Weak
- **Risk/Reward Comments** - Detailed feedback on ratio
- **Setup Comments** - Technical quality assessment
- **Position Sizing Note** - Recommendations based on account
- **Warnings** - Red flags about the setup

### Trade Grading (for closed trades)
- **Grade Assigned** - A/B/C/D/F letter grade
- **Setup Score** - 0-100 numeric evaluation
- **Rationale** - Explanation of grade
- **Suggestions** - Actionable improvements (3-5 items)
- **Force Re-Grade** - Update grade with new analysis

### Open Trade Analysis (for open/partial)
- **Market Overview** - Current market context
- **Current Price Estimate** - AI's estimate vs actual
- **Est. P&L & Return** - Projected outcome
- **Bullish Factors** - Supporting analysis (3-5)
- **Bearish Factors** - Risk factors (3-5)
- **Technical Outlook** - Price action assessment
- **Recommendation** - Hold, Exit, Scale, Add
- **Confidence Level** - High, Medium, Low
- **Key Levels** - Next resistance and support

---

## Settings & Configuration

### Profile Management
- **Display Name** - User's trading alias
- **Account Size** - Total capital in account
- **Default Risk %** - Default risk per trade
- **Broker Name** - Trading platform used
- **Timezone** - For accurate trade time tracking

### Session Management
- **Auto-Load Profile** - Profile data fetched on app startup
- **Save Confirmation** - Visual feedback when settings saved

---

## User Interface & UX

### Design System
- **Color Scheme** - Dark theme with profit (#00d4a1) and loss (#ff4d6d) indicators
- **Typography** - Monospace for numeric data, system fonts for text
- **Components** - shadcn/ui primitives (buttons, inputs, selects, etc.)

### Navigation
- **React Router v6** - Client-side routing
- **Protected Routes** - Auth wrapper prevents unauthenticated access
- **Back Navigation** - Back button on detail pages
- **Quick Links** - Dashboard → Trades → Journal → Settings

### Responsiveness
- **Tailwind CSS** - Mobile-first responsive design
- **Grid Layouts** - Auto-responsive grids for cards
- **Mobile Optimizations** - Hidden columns on small screens, simplified forms
- **Viewport Meta** - Proper mobile viewport configuration

### Loading States
- **Spinners** - Loading indicators for async operations
- **Disabled States** - Buttons disabled during submission
- **Optimistic Updates** - Local state updates before server confirmation
- **Error Messages** - User-friendly error displays

### Data Persistence
- **Supabase PostgreSQL** - All data persisted to cloud database
- **Real-Time Sync** - Trade updates reflect immediately
- **RLS Policies** - Users only see their own data
- **Row-Level Security** - Database-enforced access control

---

## Technical Implementation

### Frontend Stack
- **React 18** - UI framework with hooks
- **TypeScript** - Type safety for all code
- **Vite** - Fast dev server and builds
- **Tailwind CSS** - Utility-first styling
- **React Router v6** - Client-side navigation
- **Zustand** - Lightweight state management (authStore, tradeStore, journalStore, aiStore)

### Form Handling
- **React Hook Form** - Efficient form control
- **Zod** - Runtime type validation
- **Schema Validation** - Client-side input validation with clear errors

### Data Visualization
- **Recharts** - React charting library
- - Area charts (cumulative P&L)
  - Bar charts (daily P&L, strategy breakdown)
  - Heatmaps (52-week activity)

### Backend & Database
- **Supabase** - Firebase alternative:
  - PostgreSQL database
  - Row-level security policies
  - Authentication (Google OAuth)
  - File storage (trade screenshots)
  - Real-time subscriptions (optional M2+)
- **Database Triggers** - Automatic P&L calculation on trade changes
- **Views** - Pre-aggregated stats for dashboard queries

### API Integration
- **Yahoo Finance API** - Stock sector lookup and live quotes
- **Claude API** - AI-powered analysis and grading (future: integrated)

### Security
- **HTTPS** - TLS encryption in transit
- **RLS Policies** - Database-enforced row-level security
- **OAuth Tokens** - Secure Google authentication
- **Storage Policies** - Private bucket with user folder isolation

### Deployment
- **Vercel** - Serverless hosting with auto-deploys
- **Environment Variables** - VITE_ prefixed config
- **SPA Routing** - vercel.json configured for React Router
- **Auto-HTTPS Redirect** - Secure by default

---

## Data Schema (Supabase)

### Tables
- `profiles` - User profile settings (display_name, account_size, default_risk_percent, broker, timezone)
- `trades` - Trade records with all details and computed P&L
- `trade_screenshots` - Image storage references for each trade
- `daily_journals` - Daily journal entries (M1 foundation)

### Computed Columns & Triggers
- `calculate_pnl` trigger - Auto-calculates P&L on insert/update
- `trade_stats_view` - Pre-aggregated stats for dashboard (optional)

---

## Known Limitations & Future Improvements

### Milestone 2 (In Backlog)
- [x] Calendar journal visualization (currently stubbed)
- [x] Daily journal monthly view enhancements
- [x] Real-time trade notifications
- Mobile app version

### Milestone 3
- [x] Claude API integration for AI grading and analysis
- [x] Enhanced pattern recognition
- Trade similarity matching

### Milestone 4
- Advanced heatmaps and correlation analysis
- Win rate by sector/timeframe
- Monthly/quarterly performance summaries

---

## Milestone 5: PWA & Mobile Polish ⬜ (In Planning)

### Progressive Web App (PWA) Core Features
- **Web App Manifest**
  - [x] Create manifest.json with app metadata
  - [x] Define app name, short name, description
  - [x] Set start URL and display mode (standalone)
  - [x] Configure app icons (192x192, 512x512, maskable icons)
  - [x] Set theme color and background color
  - [x] Define orientation (portrait-primary)
  - [x] Add manifest link to index.html

- **Service Worker Implementation**
  - [x] Register service worker on app startup
  - [x] Implement cache-first strategy for static assets
  - [x] Cache busting with version updates
  - [x] Handle service worker updates and skip waiting
  - [x] Implement proper error handling and fallbacks
  - [x] Network-first strategy for API calls
  - [x] Cache versioning strategy (v1, v2, etc.)

- **App Installation**
  - [ ] Implement install prompt triggering
  - [ ] Add "Install App" button on homepage
  - [ ] Display install instructions for different browsers
  - [ ] Handle beforeinstallprompt event
  - [ ] Track installation analytics
  - [ ] Add post-install welcome screen (optional)

### Offline-First Functionality
- **Data Synchronization**
  - [ ] Sync trades when connection restored
  - [ ] Sync journal entries when online
  - [ ] Queue offline API requests
  - [ ] Handle conflict resolution (server vs local)
  - [ ] Maintain optimistic updates for offline actions
  - [ ] Clear sync queue on successful sync
  - [ ] Display sync status indicator

- **Offline Data Storage**
  - [ ] Store trades in IndexedDB for offline access
  - [ ] Store journal entries offline
  - [ ] Cache trade screenshots locally
  - [ ] Implement storage quota management
  - [ ] Handle storage cleanup/archival
  - [ ] Sync IndexedDB with server on reconnect

- **Offline UI Indicators**
  - [ ] Show online/offline status indicator
  - [ ] Display "Offline Mode" banner when disconnected
  - [ ] Show sync pending badge on actionable items
  - [ ] Indicate last synced timestamp
  - [ ] Disable actions that require network (when appropriate)
  - [ ] Queue notifications for when network restores

### Mobile UI/UX Polish
- **Touch Interactions**
  - [ ] Implement touch-friendly button sizing (min 48x48px)
  - [ ] Add swipe gestures for navigation
  - [ ] Implement pull-to-refresh on main pages
  - [ ] Long-press context menus for trade actions
  - [ ] Touch feedback (ripple effects, haptics)
  - [ ] Avoid hover states on mobile

- **Mobile Navigation**
  - [ ] Bottom tab navigation for mobile (Dashboard, Trades, Journal, Settings)
  - [ ] Collapse sidebar on mobile devices
  - [ ] Mobile-friendly header with hamburger menu (if needed)
  - [ ] Sticky action buttons for forms
  - [ ] Back gesture support
  - [ ] Breadcrumb navigation for deep pages

- **Responsive Layout Improvements**
  - [ ] Full mobile layouts for all pages
  - [ ] Single-column layouts on small screens
  - [ ] Stack charts vertically on mobile
  - [ ] Responsive typography scaling
  - [ ] Mobile-optimized data tables (scrollable or compact)
  - [ ] Hide non-essential UI elements on mobile
  - [ ] Full-screen modals on mobile (no side panels)

- **Performance on Mobile**
  - [ ] Image optimization (WebP with fallbacks)
  - [ ] Lazy-load charts and visualizations
  - [ ] Limit initial API calls on mobile
  - [ ] Paginate large trade lists
  - [ ] Minimize bundle size analysis
  - [ ] Optimize font loading (system fonts preferred)

- **Mobile Form UX**
  - [ ] Auto-capitalize/lowercase inputs appropriately
  - [ ] Number input for numeric fields
  - [ ] Date picker for date fields
  - [ ] Minimize typing (use pickers, dropdowns)
  - [ ] Full-screen keyboard on mobile
  - [ ] Clear validation errors inline

### Export & Reporting Features
- **Trade Export**
  - [ ] Export selected trades to CSV
  - [ ] Export all trades to CSV with filtering options
  - [ ] Export trades to JSON (includes all metadata)
  - [ ] Export with date range picker
  - [ ] Include calculated metrics (P&L, R-Multiple, etc.)
  - [ ] Batch export multiple trade selections

- **Performance Reports**
  - [ ] Monthly performance summary PDF
  - [ ] Quarterly performance report
  - [ ] Year-to-date summary
  - [ ] By-strategy performance breakdown
  - [ ] By-asset-type performance breakdown
  - [ ] Win rate statistics
  - [ ] Drawdown analysis

- **Journal Export**
  - [ ] Export daily journal entries to PDF
  - [ ] Export date range of journal entries
  - [ ] Include associated trade details
  - [ ] Format as readable document (not just data dump)

- **Custom Reports**
  - [ ] Report builder UI
  - [ ] Select metrics to include
  - [ ] Choose date range
  - [ ] Filter by strategy, asset type, direction
  - [ ] Generate and download as PDF/CSV
  - [ ] Save report templates for recurring exports

- **Data Visualization Exports**
  - [ ] Export charts as PNG/SVG
  - [ ] Download heatmap visualizations
  - [ ] Export P&L curve as image
  - [ ] Share report links (public/private)

### Mobile-Specific Features
- **App Shortcuts (if possible)**
  - [ ] Quick action: New Trade
  - [ ] Quick action: View Dashboard
  - [ ] Quick action: Add Journal Entry
  - [ ] Keyboard shortcuts documentation

- **System Integration**
  - [ ] Share trade/report via mobile share sheet
  - [ ] Open in email for sharing reports
  - [ ] Home screen widgets (if framework allows)
  - [ ] Native app feel with transitions

- **Battery & Data Optimization**
  - [ ] Disable auto-refresh when backgrounded
  - [ ] Compress images before uploading
  - [ ] Reduce animation frequency on low-end devices
  - [ ] Data saver mode (reduce image quality)
  - [ ] Limit background sync frequency

### Testing & Validation
- **PWA Testing**
  - [ ] Test service worker installation
  - [ ] Test offline functionality (disable network)
  - [ ] Test cache updates and invalidation
  - [ ] Test sync queue on reconnect
  - [ ] Validate manifest.json
  - [ ] Test on multiple browsers (Chrome, Safari, Firefox)
  - [ ] Test on Android and iOS devices

- **Mobile Device Testing**
  - [ ] Test on iPhone (various sizes)
  - [ ] Test on Android phones (various sizes)
  - [ ] Test on tablets (iPad, Android tablets)
  - [ ] Test on various screen resolutions
  - [ ] Test touch interactions
  - [ ] Test performance on low-end devices
  - [ ] Test mobile Safari (iOS quirks)

- **Performance Testing**
  - [ ] Lighthouse score target: 90+
  - [ ] FCP (First Contentful Paint) under 2.5s
  - [ ] LCP (Largest Contentful Paint) under 4s
  - [ ] CLS (Cumulative Layout Shift) under 0.1
  - [ ] Time to Interactive under 5s on mobile
  - [ ] Offline performance testing

- **Export Testing**
  - [ ] Test CSV exports with large datasets
  - [ ] Test PDF generation and formatting
  - [ ] Test report accuracy with calculated metrics
  - [ ] Test date range filtering in exports
  - [ ] Verify data completeness in exports

---

## Milestone 6: Security, Legal & Privacy ⬜ (In Planning)

### Security Audit & Hardening

- **Code Security Audit**
  - [ ] Scan codebase for OWASP Top 10 vulnerabilities
  - [ ] Review input validation and sanitization
  - [ ] Audit authentication flows (OAuth, session handling)
  - [ ] Check for XSS, CSRF, SQL injection vulnerabilities
  - [ ] Review dependency vulnerabilities (npm audit)
  - [ ] Verify secure headers (CSP, X-Frame-Options, etc.)
- **Data Security**
  - [ ] Encrypt sensitive data at rest (if applicable)
  - [ ] Verify Supabase RLS policies are properly configured
  - [ ] Review storage permissions and access controls
  - [ ] Implement rate limiting on API endpoints
  - [ ] Add request validation and error handling
- **Frontend Security**
  - [ ] Implement Content Security Policy (CSP)
  - [ ] Add secure HTTP headers middleware
  - [ ] Sanitize user input on all forms
  - [ ] Implement CSRF token validation
  - [ ] Secure sensitive data in localStorage (tokens, etc.)

### Cookie Consent & Management
- **Cookie Consent Banner**
  - [ ] Implement cookie consent UI component
  - [ ] Categorize cookies (Essential, Analytics, Marketing)
  - [ ] Store user consent preferences in localStorage
  - [ ] Respect user choices before loading non-essential cookies
  - [ ] Allow users to manage cookie preferences anytime
  - [ ] Comply with GDPR/CCPA cookie requirements
- **Cookie Policy Page**
  - [ ] Create detailed cookie disclosure
  - [ ] List all cookies used by the app
  - [ ] Explain purpose of each cookie category
  - [ ] Link from footer and settings

### Privacy Policy & Terms of Service
- **Privacy Policy**
  - [ ] Data collection disclosure
  - [ ] How user data is used and stored
  - [ ] Third-party services (Supabase, Google OAuth, Yahoo Finance)
  - [ ] Data retention policies
  - [ ] User rights and data access
  - [ ] Compliance with GDPR, CCPA, and relevant regulations
  - [ ] Contact information for privacy inquiries
- **Terms of Service**
  - [ ] Usage rights and restrictions
  - [ ] Liability limitations
  - [ ] Dispute resolution
  - [ ] Service availability and uptime
  - [ ] Account termination policies
  - [ ] Intellectual property rights
- **Disclaimers Page**
  - [ ] Trading/Investment Disclaimer
  - [ ] Risk acknowledgment
  - [ ] Not financial advice disclaimer
  - [ ] Past performance ≠ future results
  - [ ] Limitation of liability

### AI-Specific Disclaimers & Limitations
- **AI Limitations Disclosure**
  - [ ] Create dedicated "About AI" info section
  - [ ] Document AI model capabilities and limitations
  - [ ] Explain what the AI can and cannot do
  - [ ] Disclose training data cutoff and knowledge limits
- **Price & Analysis Disclaimers**
  - [ ] Clearly mark AI-generated analysis as such
  - [ ] Disclose potential data delays (Yahoo Finance API)
  - [ ] Explain price accuracy limitations
  - [ ] Add disclaimers on AI trade grading (not investment advice)
  - [ ] Clarify AI recommendations are for educational purposes only
  - [ ] Add timestamps to price data with last-updated info
- **AI Disclaimers in UI**
  - [ ] Add info icons/tooltips on AI analysis cards
  - [ ] Include disclaimer banners on trade grading section
  - [ ] Display API data freshness/staleness warnings
  - [ ] Add "This is not financial advice" disclaimers
  - [ ] Document limitations of setup validation

### GDPR & Data Privacy Compliance
- **Right to Access**
  - [ ] Implement data export feature
  - [ ] Allow users to download all their data in machine-readable format (JSON/CSV)
  - [ ] Include trades, journal entries, screenshots
- **Right to Erasure (Right to be Forgotten)**
  - [ ] Implement full account deletion feature
  - [ ] Delete all user data from database
  - [ ] Delete all associated files (screenshots) from storage
  - [ ] Delete authentication records
  - [ ] Process deletion within 30 days compliance window
  - [ ] Provide account deletion confirmation email
- **Data Portability**
  - [ ] Export trades in standard formats (CSV, JSON)
  - [ ] Export journal entries
  - [ ] Bulk download all screenshots
- **User Consent Management**
  - [ ] Track and store user consent for data processing
  - [ ] Allow users to withdraw consent
  - [ ] Maintain consent audit trail
- **Privacy Settings Page**
  - [ ] Add section in Settings for privacy controls
  - [ ] Allow toggling of optional tracking/analytics
  - [ ] Download personal data option
  - [ ] Delete account option with confirmation
  - [ ] View consent history

### Additional Legal & Security Features
- **Rate Limiting & DDoS Protection**
  - [ ] Implement API rate limiting on backend
  - [ ] Add Cloudflare or similar DDoS protection
  - [ ] Monitor for suspicious activity
- **Audit Logging**
  - [ ] Log sensitive operations (login, data deletion, settings changes)
  - [ ] Maintain audit trail for compliance
  - [ ] Implement log retention policies
- **Security Headers**
  - [ ] Strict-Transport-Security (HSTS)
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] Referrer-Policy
  - [ ] Permissions-Policy
- **Two-Factor Authentication (2FA) - Optional**
  - [ ] Implement TOTP-based 2FA
  - [ ] Recovery codes for account recovery
  - [ ] Optional for users (not mandatory)
- **Session Security**
  - [ ] Implement session timeout after inactivity
  - [ ] Require re-authentication for sensitive operations
  - [ ] Clear sensitive data on logout
  - [ ] Prevent session fixation attacks
- **Dependency Security**
  - [ ] Keep dependencies up-to-date
  - [ ] Regular npm audit and vulnerability scanning
  - [ ] Use GitHub security scanning
  - [ ] Lock critical dependency versions

### Compliance & Documentation
- **Compliance Checklist**
  - [ ] GDPR compliance validation
  - [ ] CCPA compliance validation
  - [ ] HIPAA considerations (if handling health data)
  - [ ] SOC 2 readiness review
- **Security Documentation**
  - [ ] Create SECURITY.md with vulnerability reporting process
  - [ ] Document security best practices
  - [ ] Include incident response procedures
  - [ ] Security contact information
- **Legal Documentation Maintenance**
  - [ ] Review and update privacy policy annually
  - [ ] Track legal changes by region
  - [ ] Version control for all legal documents
  - [ ] Timestamp all policy updates

### Testing & Validation
- **Security Testing**
  - [ ] Penetration testing (optional/recommended)
  - [ ] Automated security scanning (npm audit, SAST)
  - [ ] Manual code review for security issues
  - [ ] Test XSS, CSRF protections
  - [ ] Validate RLS policies with edge cases
- **Compliance Testing**
  - [ ] Test GDPR deletion flow end-to-end
  - [ ] Verify data export completeness
  - [ ] Test cookie consent functionality
  - [ ] Validate legal document accessibility
  - [ ] Test account recovery flows

---

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ features required
- Minimum iOS Safari 14+

---

Generated: 2026-04-09
Version: Milestone 1-3 (Complete), M6 (In Planning)
