-- Add tags array to strategies for categorization (e.g. breakout, swing)

alter table public.strategies
  add column if not exists tags text[] default '{}'::text[];
