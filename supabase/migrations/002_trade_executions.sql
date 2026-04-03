-- ============================================================
-- StonkJournal — Migration 002: Trade Executions
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add has_executions flag to trades (skips trigger when true)
alter table public.trades add column if not exists has_executions boolean default false;

-- Modify calculate_pnl trigger to skip when executions drive P&L
create or replace function public.calculate_pnl()
returns trigger as $$
begin
  -- Skip automatic P&L calculation when executions table drives the numbers
  if new.has_executions = true then
    new.updated_at := now();
    return new;
  end if;

  -- Only calculate when we have entry + exit
  if new.exit_price is not null and new.entry_price is not null then
    if new.asset_type = 'option' then
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
    new.pnl_percent := ((new.net_pnl) / (new.entry_price * new.quantity)) * 100;

    if new.initial_risk is not null and new.initial_risk != 0 then
      new.r_multiple := new.net_pnl / new.initial_risk;
    end if;

    if new.exit_date is not null then
      new.holding_period_days := extract(epoch from (new.exit_date - new.entry_date)) / 86400;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- ─── TRADE EXECUTIONS ───────────────────────────────────────

create table if not exists public.trade_executions (
  id          uuid default uuid_generate_v4() primary key,
  trade_id    uuid references public.trades(id) on delete cascade not null,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  action      text not null check (action in ('buy', 'sell')),
  datetime    timestamptz not null,
  quantity    numeric(14,6) not null check (quantity > 0),
  price       numeric(14,6) not null check (price > 0),
  fee         numeric(10,2) default 0,
  created_at  timestamptz default now() not null
);

create index if not exists executions_trade_id_idx on public.trade_executions(trade_id);
create index if not exists executions_user_id_idx on public.trade_executions(user_id);

alter table public.trade_executions enable row level security;

create policy "Users can CRUD own executions" on public.trade_executions
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
