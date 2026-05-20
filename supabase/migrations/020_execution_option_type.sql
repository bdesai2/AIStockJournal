-- ============================================================
-- StonkJournal — Migration 020: Execution Option Type
-- Add contract type to each option execution so FIFO matching is per call/put.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'option_type_enum') THEN
    CREATE TYPE option_type_enum AS ENUM ('call', 'put');
  END IF;
END;
$$;

ALTER TABLE public.trade_executions
  ADD COLUMN IF NOT EXISTS option_type option_type_enum;

COMMENT ON COLUMN public.trade_executions.option_type IS
  'call/put contract type for option executions';

-- Backfill execution option type from the parent trade where available.
UPDATE public.trade_executions e
SET option_type = t.option_type
FROM public.trades t
WHERE e.trade_id = t.id
  AND e.option_type IS NULL
  AND t.asset_type = 'option'
  AND t.option_type IS NOT NULL;
