-- ============================================================
-- Orah - Campus Meet 2026: Financial Management
-- Migration: 20260823000002_add_expense_advances_and_settlements.sql
-- Description:
--   1. Adds advance and settlement tracking columns to public.expenses:
--      - advance_amount: Initial rough amount given to volunteer (e.g., ₹500)
--      - advance_money_type: Payment mode of initial handover ('Cash' or 'UPI')
--      - settlement_status: 'Direct' (standard), 'Advance Given' (pending bill), or 'Settled' (reconciled)
--      - balance_amount: Net difference between actual amount and advance (actual - advance).
--        Negative = refunded back to finance desk (e.g., -11 for 489 actual vs 500 advance).
--        Positive = extra paid to volunteer (e.g., +40 for 540 actual vs 500 advance).
--      - balance_money_type: Payment mode used for the balance refund or extra payment ('Cash' or 'UPI')
--      - settled_at: Timestamp when settlement was completed
--   2. Adds performance index on settlement_status.
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

-- 1. Schema Extensions for public.expenses
ALTER TABLE IF EXISTS public.expenses
  ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS advance_money_type TEXT CHECK (advance_money_type IN ('Cash', 'UPI')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'Direct' CHECK (settlement_status IN ('Direct', 'Advance Given', 'Settled')),
  ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS balance_money_type TEXT CHECK (balance_money_type IN ('Cash', 'UPI')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Index on settlement_status for quick filtering of active advances
CREATE INDEX IF NOT EXISTS idx_expenses_settlement_status
  ON public.expenses (settlement_status);
