-- User-defined setup library

create table if not exists public.setups (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  name          text not null,
  ticker        text not null,
  direction     trade_direction not null,
  status        text not null default 'open' check (status in ('open', 'closed')),
  close_outcome text check (close_outcome in ('successful', 'cancelled', 'failed')),
  closed_at     timestamptz,
  strategy_id   uuid references public.strategies(id) on delete set null,
  reasons       text,
  entry_price   numeric(12, 4) not null,
  take_profit   numeric(12, 4) not null,
  stop_loss     numeric(12, 4) not null,
  probability   text not null default 'medium' check (probability in ('low', 'medium', 'high')),
  tags          text[] not null default '{}',
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

alter table public.setups enable row level security;

create policy "Users can CRUD own setups" on public.setups
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists setups_user_id_idx on public.setups(user_id);
create index if not exists setups_name_idx on public.setups(user_id, name);
create index if not exists setups_ticker_idx on public.setups(user_id, ticker);
create index if not exists setups_status_idx on public.setups(user_id, status);
create index if not exists setups_strategy_idx on public.setups(strategy_id);

create table if not exists public.setup_screenshots (
  id            uuid default uuid_generate_v4() primary key,
  setup_id      uuid references public.setups(id) on delete cascade not null,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  storage_path  text not null,
  url           text not null,
  label         text,
  created_at    timestamptz default now() not null
);

alter table public.setup_screenshots enable row level security;

create policy "Users can CRUD own setup screenshots" on public.setup_screenshots
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists setup_screenshots_setup_id_idx on public.setup_screenshots(setup_id);
