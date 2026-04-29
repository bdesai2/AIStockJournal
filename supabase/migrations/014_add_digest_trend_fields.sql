-- ============================================================
-- Add Trend Fields to Weekly Digests
-- ============================================================

alter table public.weekly_digests
  add column if not exists performance_trend text,
  add column if not exists trend_feedback text,
  add column if not exists increasing_mistakes jsonb,
  add column if not exists performance_drivers jsonb;
