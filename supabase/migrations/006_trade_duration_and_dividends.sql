-- ============================================================
-- StonkJournal — Migration 006: Trade Duration & Dividends
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add trade_duration enum if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'trade_duration') THEN
    CREATE TYPE trade_duration AS ENUM ('scalp', 'swing', 'long_term');
  END IF;
END;
$$;

-- Add duration column to trades
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS duration trade_duration;

-- Add dividend column to trade_executions
ALTER TABLE public.trade_executions
  ADD COLUMN IF NOT EXISTS dividend numeric(14,2) DEFAULT 0;
