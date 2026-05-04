-- Persist open-trade AI analysis responses on the trades table
alter table public.trades
  add column if not exists open_trade_analysis jsonb,
  add column if not exists open_trade_analyzed_at timestamptz,
  add column if not exists open_trade_model_version text;

comment on column public.trades.open_trade_analysis is 'Latest AI open-trade analysis payload (json)';
comment on column public.trades.open_trade_analyzed_at is 'Timestamp of latest open-trade AI analysis run';
comment on column public.trades.open_trade_model_version is 'Model/version tag used for open-trade analysis';
