-- Add strengths, weaknesses, and likelihood_of_success to strategies

alter table public.strategies
  add column if not exists strengths text,
  add column if not exists weaknesses text,
  add column if not exists likelihood_of_success smallint check (likelihood_of_success between 0 and 100);
