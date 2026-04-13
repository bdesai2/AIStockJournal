-- Add primary_strategy_name to trades so we can show
-- the playbook strategy used on each trade detail page.

alter table public.trades
  add column if not exists primary_strategy_name text;
