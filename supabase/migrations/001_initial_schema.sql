-- ============================================================
-- StonkJournal — Supabase Schema (Migration 001)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled on Supabase)
create extension if not exists "uuid-ossp";

-- ─── ENUMS ──────────────────────────────────────────────────

create type asset_type as enum ('stock', 'option', 'etf', 'crypto');
create type trade_direction as enum ('long', 'short');
create type trade_status as enum ('open', 'closed', 'partial');
create type option_type as enum ('call', 'put');
create type option_action as enum ('buy', 'sell');
create type emotional_state as enum ('calm', 'fomo', 'fearful', 'confident', 'impulsive', 'disciplined');
create type market_conditions as enum ('trending_up', 'trending_down', 'ranging', 'volatile');
create type market_mood as enum ('bullish', 'bearish', 'neutral');
create type timeframe as enum ('1m', '5m', '15m', '1h', '4h', 'D', 'W');

-- ─── USER PROFILES ──────────────────────────────────────────

create table public.profiles (
  id                    uuid references auth.users(id) on delete cascade primary key,
  email                 text not null,
  display_name          text,
  avatar_url            text,
  account_size          numeric(14,2),       -- starting $ value for risk calculations
  default_risk_percent  numeric(5,2),        -- e.g. 1.5 for 1.5%
  preferred_timeframe   text,
  broker                text,
  timezone              text default 'America/New_York',
  created_at            timestamptz default now() not null,
  updated_at            timestamptz default now() not null
);

-- RLS
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── TRADES ─────────────────────────────────────────────────

create table public.trades (
  id                    uuid default uuid_generate_v4() primary key,
  user_id               uuid references public.profiles(id) on delete cascade not null,

  -- Identification
  ticker                text not null,
  asset_type            asset_type not null,
  direction             trade_direction not null,
  status                trade_status not null default 'open',

  -- Timing
  entry_date            timestamptz not null,
  exit_date             timestamptz,
  holding_period_days   numeric(8,2),

  -- Pricing
  entry_price           numeric(14,6) not null,
  exit_price            numeric(14,6),
  quantity              numeric(14,6) not null,  -- shares, contracts, or crypto units
  fees                  numeric(10,2) default 0,

  -- P&L (stored for dashboard query performance)
  gross_pnl             numeric(14,2),
  net_pnl               numeric(14,2),
  pnl_percent           numeric(10,4),
  r_multiple            numeric(8,4),

  -- Risk Management
  stop_loss             numeric(14,6),
  take_profit           numeric(14,6),
  initial_risk          numeric(14,2),       -- $ risked
  risk_percent          numeric(6,4),        -- % of account

  -- Options
  option_legs           jsonb,               -- array of OptionLeg objects
  option_strategy       text,               -- e.g. "Bull Call Spread"

  -- Crypto
  exchange              text,

  -- Journal Text
  setup_notes           text,
  entry_notes           text,
  exit_notes            text,
  mistakes              text,
  lessons               text,
  emotional_state       emotional_state,
  execution_quality     smallint check (execution_quality between 1 and 5),

  -- Categorization
  strategy_tags         text[] default '{}',
  custom_tags           text[] default '{}',
  sector                text,
  market_conditions     market_conditions,
  timeframe             timeframe,

  -- AI (populated in Milestone 3)
  ai_grade              text,
  ai_grade_rationale    text,
  ai_setup_score        smallint check (ai_setup_score between 0 and 100),
  ai_suggestions        text[],

  -- Metadata
  created_at            timestamptz default now() not null,
  updated_at            timestamptz default now() not null
);

-- Indexes for common query patterns
create index trades_user_id_idx on public.trades(user_id);
create index trades_entry_date_idx on public.trades(entry_date desc);
create index trades_ticker_idx on public.trades(ticker);
create index trades_status_idx on public.trades(status);
create index trades_asset_type_idx on public.trades(asset_type);
create index trades_user_date_idx on public.trades(user_id, entry_date desc);

-- RLS
alter table public.trades enable row level security;
create policy "Users can CRUD own trades" on public.trades
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-calculate P&L on insert/update
create or replace function public.calculate_pnl()
returns trigger as $$
begin
  -- Only calculate when we have entry + exit
  if new.exit_price is not null and new.entry_price is not null then
    -- Gross P&L
    if new.asset_type = 'option' then
      -- Options: per-contract, 100 multiplier
      if new.direction = 'long' then
        new.gross_pnl := (new.exit_price - new.entry_price) * new.quantity * 100;
      else
        new.gross_pnl := (new.entry_price - new.exit_price) * new.quantity * 100;
      end if;
    else
      if new.direction = 'long' then
        new.gross_pnl := (new.exit_price - new.entry_price) * new.quantity;
      else
        new.gross_pnl := (new.entry_price - new.exit_price) * new.quantity;
      end if;
    end if;

    new.net_pnl := new.gross_pnl - coalesce(new.fees, 0);

    -- P&L %
    new.pnl_percent := ((new.net_pnl) / (new.entry_price * new.quantity)) * 100;

    -- R-multiple
    if new.initial_risk is not null and new.initial_risk != 0 then
      new.r_multiple := new.net_pnl / new.initial_risk;
    end if;

    -- Holding period
    if new.exit_date is not null then
      new.holding_period_days := extract(epoch from (new.exit_date - new.entry_date)) / 86400;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger calculate_trade_pnl
  before insert or update on public.trades
  for each row execute function public.calculate_pnl();

-- ─── TRADE SCREENSHOTS ──────────────────────────────────────

create table public.trade_screenshots (
  id            uuid default uuid_generate_v4() primary key,
  trade_id      uuid references public.trades(id) on delete cascade not null,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  storage_path  text not null,              -- Supabase Storage path
  url           text not null,              -- Public/signed URL
  label         text,                       -- "Entry chart", "Exit chart", etc.
  created_at    timestamptz default now() not null
);

create index screenshots_trade_id_idx on public.trade_screenshots(trade_id);
alter table public.trade_screenshots enable row level security;
create policy "Users can CRUD own screenshots" on public.trade_screenshots
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── DAILY JOURNAL ──────────────────────────────────────────

create table public.daily_journals (
  id                  uuid default uuid_generate_v4() primary key,
  user_id             uuid references public.profiles(id) on delete cascade not null,
  date                date not null,
  pre_market_notes    text,
  post_market_notes   text,
  market_mood         market_mood,
  personal_mood       smallint check (personal_mood between 1 and 5),
  goals               text[] default '{}',
  reviewed_rules      boolean default false,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null,
  unique (user_id, date)
);

create index journals_user_date_idx on public.daily_journals(user_id, date desc);
alter table public.daily_journals enable row level security;
create policy "Users can CRUD own journals" on public.daily_journals
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── STORAGE BUCKET ─────────────────────────────────────────

-- Run this separately in Supabase Dashboard → Storage, or via CLI:
-- insert into storage.buckets (id, name, public) values ('trade-screenshots', 'trade-screenshots', false);
--
-- Storage RLS policy (paste in Storage → Policies):
-- CREATE POLICY "User owns screenshots" ON storage.objects FOR ALL
--   USING (auth.uid()::text = (storage.foldername(name))[1])
--   WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- ─── HELPER VIEWS ───────────────────────────────────────────

-- Closed trades with computed stats for dashboard queries
create or replace view public.trade_stats_view as
select
  user_id,
  count(*) filter (where status = 'closed') as total_closed,
  count(*) filter (where status = 'closed' and net_pnl > 0) as winning_trades,
  count(*) filter (where status = 'closed' and net_pnl < 0) as losing_trades,
  count(*) filter (where status = 'open') as open_trades,
  coalesce(sum(net_pnl) filter (where status = 'closed'), 0) as total_pnl,
  coalesce(avg(net_pnl) filter (where status = 'closed' and net_pnl > 0), 0) as avg_win,
  coalesce(avg(net_pnl) filter (where status = 'closed' and net_pnl < 0), 0) as avg_loss,
  coalesce(avg(r_multiple) filter (where status = 'closed'), 0) as avg_r_multiple,
  coalesce(max(net_pnl) filter (where status = 'closed'), 0) as best_trade,
  coalesce(min(net_pnl) filter (where status = 'closed'), 0) as worst_trade
from public.trades
group by user_id;
