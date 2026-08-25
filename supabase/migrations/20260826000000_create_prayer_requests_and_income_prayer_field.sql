-- ============================================================
-- Orah - Campus Meet 2026: Financial Management & Intercession
-- Migration: 20260826000000_create_prayer_requests_and_income_prayer_field.sql
-- Description:
--   1. Adds optional `prayer_request` column to all income-related tables:
--      - public.income
--      - public.personal_commitments
--      - public.finance_calls
--      - public.coupons
--      - public.church_donations
--   2. Creates `public.prayer_requests` table for dedicated prayer requests.
--   3. Configures RLS policies and sequential ID generation (PR-XXXX).
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

-- 1. ADD PRAYER REQUEST COLUMN TO EXISTING INCOME TABLES
ALTER TABLE public.income 
  ADD COLUMN IF NOT EXISTS prayer_request TEXT;

ALTER TABLE public.personal_commitments 
  ADD COLUMN IF NOT EXISTS prayer_request TEXT;

ALTER TABLE public.finance_calls 
  ADD COLUMN IF NOT EXISTS prayer_request TEXT;

ALTER TABLE public.coupons 
  ADD COLUMN IF NOT EXISTS prayer_request TEXT;

ALTER TABLE public.church_donations 
  ADD COLUMN IF NOT EXISTS prayer_request TEXT;

-- 2. CREATE DEDICATED PRAYER REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id             TEXT PRIMARY KEY,             -- PR-XXXX
  person_name    TEXT NOT NULL,
  mobile_number  TEXT,
  prayer_request TEXT NOT NULL,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  status         TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Answered', 'Archived')),
  source         TEXT DEFAULT 'Direct',        -- 'Direct', 'Donation', 'Personal Commitment', etc.
  reference_id   TEXT,                         -- INC-XXXX, PCOM-XXXX, FC-XXXX, etc.
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read prayer_requests"  ON public.prayer_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert prayer_requests" ON public.prayer_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update prayer_requests" ON public.prayer_requests FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete prayer_requests" ON public.prayer_requests FOR DELETE USING (auth.role() = 'authenticated');

-- 3. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_prayer_requests_date ON public.prayer_requests (date DESC);
CREATE INDEX IF NOT EXISTS idx_prayer_requests_status ON public.prayer_requests (status);
