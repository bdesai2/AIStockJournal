# StonkJournal — Milestone 1

AI-powered trading journal built with React 18 + Vite, Supabase, Tailwind CSS, and Recharts.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS + shadcn/ui primitives |
| State | Zustand |
| Routing | React Router v6 |
| Backend | Supabase (Auth + Postgres + Storage) |
| Charts | Recharts |
| Deployment | Vercel |

## Project Structure

```
src/
├── components/
│   ├── auth/         ProtectedRoute
│   ├── layout/       AppLayout, AuthLayout
│   └── trades/       TradeRow
├── hooks/            (custom hooks — M2+)
├── lib/
│   ├── supabase.ts   Client + typed helpers
│   ├── tradeUtils.ts P&L calc, formatters, stats
│   └── utils.ts      cn()
├── pages/
│   ├── LoginPage
│   ├── AuthCallbackPage
│   ├── DashboardPage
│   ├── TradesPage
│   ├── NewTradePage  (create + edit)
│   ├── TradeDetailPage
│   ├── JournalPage   (stub — M2)
│   └── SettingsPage
├── store/
│   ├── authStore.ts  User session + profile
│   └── tradeStore.ts Full trade CRUD
└── types/index.ts    All TypeScript types
supabase/
└── migrations/
    └── 001_initial_schema.sql
```

---

## Setup Instructions

### 1. Clone & Install

```bash
git clone <your-repo>
cd stonk-journal
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_POLYGON_API_KEY=your-polygon-key
```

### 3. Supabase Schema

Run the migration in your Supabase SQL Editor:

```
supabase/migrations/001_initial_schema.sql
```

This creates:
- `profiles` — auto-populated on signup via trigger
- `trades` — full trade journal with auto P&L calculation trigger
- `trade_screenshots` — linked to trades
- `daily_journals` — daily notes (used in M2)
- `trade_stats_view` — pre-aggregated stats for dashboards

### 4. Supabase Storage Bucket

In Supabase Dashboard → Storage:
1. Create bucket: `trade-screenshots`
2. Set to **private** (not public)
3. Add storage RLS policy:

```sql
CREATE POLICY "User owns screenshots" ON storage.objects FOR ALL
  USING (auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
```

### 5. Google OAuth

In Supabase Dashboard → Authentication → Providers → Google:
1. Enable Google provider
2. Add your Google OAuth Client ID + Secret
3. Set authorized redirect URIs in Google Console:
   - `https://your-project.supabase.co/auth/v1/callback`
   - `http://localhost:5173/auth/callback` (dev)
   - `https://your-vercel-domain.vercel.app/auth/callback` (prod)

### 6. Run Locally

```bash
npm run dev
```

Visit `http://localhost:5173`

---

## Deploy to Vercel

```bash
npm run build   # verify build passes first
```

In Vercel:
1. Import the repo
2. Set environment variables (same as `.env`)
3. Deploy

The `vercel.json` handles SPA client-side routing.

After deploy, add your Vercel URL to:
- Supabase → Authentication → URL Configuration → Site URL
- Google OAuth → Authorized Redirect URIs

---

## Key Design Decisions

### P&L Calculation
P&L is calculated in two places:
- **Database trigger** (`calculate_pnl`) on insert/update — stored for fast queries
- **Client-side** (`tradeUtils.ts`) — used for real-time previews in forms

Options trades use a 100× multiplier automatically.

### RLS Policy
All tables use Row Level Security — users can only access their own data. The `profiles` trigger runs as `security definer` so it can create the profile row on signup.

### Auth Flow
1. `initAuth()` in `main.tsx` bootstraps the Supabase session listener before React renders
2. `ProtectedRoute` shows a spinner until `initialized = true`
3. Google OAuth redirects through `/auth/callback` → `AuthCallbackPage`

---

## Milestone Roadmap

| Milestone | Status |
|---|---|
| M1: Foundation + Auth + CRUD | ✅ Complete |
| M2: Analytics dashboard + Calendar journal | ⬜ Next |
| M3: AI trade grading (Claude API) | ⬜ |
| M4: Advanced analytics + heatmaps | ⬜ |
| M5: PWA + mobile polish | ⬜ |
