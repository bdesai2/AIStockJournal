-- ============================================================
-- StonkJournal — Migration 007: Option Type
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Add option_type enum if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'option_type_enum') THEN
    CREATE TYPE option_type_enum AS ENUM ('call', 'put');
  END IF;
END;
$$;

-- Add option_type column to trades
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS option_type option_type_enum;
