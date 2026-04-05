-- Migration 004: Add AI tracking columns to trades
-- ai_grade, ai_grade_rationale, ai_setup_score, ai_suggestions already exist from migration 001
-- Adding the two tracking columns for audit and model versioning

alter table public.trades
  add column if not exists ai_analyzed_at   timestamptz,
  add column if not exists ai_model_version text;

comment on column public.trades.ai_analyzed_at   is 'Timestamp of last AI grade run';
comment on column public.trades.ai_model_version is 'Claude model version used for grading, e.g. claude-haiku-4-5-20251001';
