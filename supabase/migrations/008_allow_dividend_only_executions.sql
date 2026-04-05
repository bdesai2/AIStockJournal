-- ============================================================
-- StonkJournal — Migration 008: Allow Dividend-Only Executions
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Drop the old constraints that require quantity > 0 and price > 0
-- This allows dividend-only executions with quantity=0 and price=0

ALTER TABLE public.trade_executions
DROP CONSTRAINT IF EXISTS trade_executions_quantity_check;

ALTER TABLE public.trade_executions
DROP CONSTRAINT IF EXISTS trade_executions_price_check;

-- Add new constraints that allow 0 values
-- At least one of quantity/price or dividend must be set

ALTER TABLE public.trade_executions
ADD CONSTRAINT quantity_non_negative CHECK (quantity >= 0),
ADD CONSTRAINT price_non_negative CHECK (price >= 0);
