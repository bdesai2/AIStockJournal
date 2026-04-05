-- Migration 005: Add AI expiration column to trades

alter table public.trades
  add column if not exists ai_expires_at timestamptz;

comment on column public.trades.ai_expires_at is 'Timestamp after which cached AI grade should be regenerated (typically 7 days after grading).';
