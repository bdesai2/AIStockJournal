-- Persist portfolio-level open position AI analysis by user/account
create table if not exists public.open_position_analyses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete cascade not null,
  signature text not null,
  analysis jsonb not null,
  generated_at timestamptz default now() not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index if not exists open_position_analyses_user_account_uniq
  on public.open_position_analyses(user_id, account_id);

create index if not exists open_position_analyses_user_generated_idx
  on public.open_position_analyses(user_id, generated_at desc);

alter table public.open_position_analyses enable row level security;

drop policy if exists "Users can CRUD own open position analyses" on public.open_position_analyses;
create policy "Users can CRUD own open position analyses" on public.open_position_analyses
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.open_position_analyses is 'Latest portfolio-level open-positions AI analysis per user/account';
comment on column public.open_position_analyses.signature is 'Hash/signature of open trades snapshot used for the analysis';
comment on column public.open_position_analyses.analysis is 'AI response payload for open-positions portfolio analysis';
