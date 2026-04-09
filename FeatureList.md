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
- Calendar journal visualization (currently stubbed)
- Daily journal monthly view enhancements
- Real-time trade notifications
- Mobile app version

### Milestone 3
- Claude API integration for AI grading and analysis
- Enhanced pattern recognition
- Trade similarity matching

### Milestone 4
- Advanced heatmaps and correlation analysis
- Win rate by sector/timeframe
- Monthly/quarterly performance summaries

### Milestone 5
- PWA capabilities
- Offline-first sync
- Mobile app polish
- Export/reporting features

---

## Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ features required
- Minimum iOS Safari 14+

---

Generated: 2026-04-09
Version: Milestone 1 (Complete)
