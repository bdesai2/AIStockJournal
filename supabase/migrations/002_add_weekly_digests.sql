-- ============================================================
-- Add Weekly Digests Table
-- ============================================================

create table public.weekly_digests (
  id                    uuid default uuid_generate_v4() primary key,
  user_id               uuid references public.profiles(id) on delete cascade not null,

  -- Digest content
  positive_patterns     jsonb not null,         -- array of { pattern, detail }
  negative_patterns     jsonb not null,         -- array of { pattern, detail }
  actionable_lesson     text not null,

  -- Metadata
  generated_at          timestamptz default now() not null,
  trade_count           integer,                -- number of closed trades analyzed

  created_at            timestamptz default now() not null,
  updated_at            timestamptz default now() not null,

  unique (user_id, generated_at)
);

-- Index for common query patterns
create index weekly_digests_user_id_idx on public.weekly_digests(user_id);
create index weekly_digests_user_generated_idx on public.weekly_digests(user_id, generated_at desc);

-- RLS
alter table public.weekly_digests enable row level security;
create policy "Users can CRUD own digests" on public.weekly_digests
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
