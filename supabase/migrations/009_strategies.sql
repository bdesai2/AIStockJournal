-- Strategies - user-defined playbook entries

create table public.strategies (
  id                uuid default uuid_generate_v4() primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  name              text not null,
  description       text,
  setup_rules       text,
  entry_conditions  text,
  exit_conditions   text,
  confidence_level  smallint check (confidence_level between 1 and 5),
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null
);

alter table public.strategies enable row level security;
create policy "Users can CRUD own strategies" on public.strategies
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index strategies_user_id_idx on public.strategies(user_id);
create index strategies_name_idx on public.strategies(user_id, name);

-- Screenshots attached to strategies (reuse trade-screenshots storage bucket)

create table public.strategy_screenshots (
  id            uuid default uuid_generate_v4() primary key,
  strategy_id   uuid references public.strategies(id) on delete cascade not null,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  storage_path  text not null,
  url           text not null,
  label         text,
  created_at    timestamptz default now() not null
);

alter table public.strategy_screenshots enable row level security;
create policy "Users can CRUD own strategy screenshots" on public.strategy_screenshots
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index strategy_screenshots_strategy_id_idx on public.strategy_screenshots(strategy_id);
