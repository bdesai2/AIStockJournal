-- Add execution_notes column to trades

alter table public.trades
  add column if not exists execution_notes text;
