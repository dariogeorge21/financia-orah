-- ============================================================
-- Migration: 20260830000000_add_due_date_to_personal_commitments.sql
-- Description:
--   Adds due_date column to personal_commitments table for tracking
--   follow-up / reminder dates to collect promised money.
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

ALTER TABLE IF EXISTS public.personal_commitments
  ADD COLUMN IF NOT EXISTS due_date DATE;
