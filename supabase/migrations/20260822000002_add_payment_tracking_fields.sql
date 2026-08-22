-- ============================================================
-- Orah - Campus Meet 2026: Financial Management
-- Migration: 20260822000002_add_payment_tracking_fields.sql
-- Description:
--   1. Adds caller_name (volunteer), money_type (Cash/UPI), and screenshot_link
--      columns to personal_commitments, finance_calls, and income tables.
--   2. Updates trigger functions to forward money_type and screenshot_link
--      when synchronizing commitments/calls to the income table.
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

-- 1. Schema Extensions
ALTER TABLE IF EXISTS public.personal_commitments
  ADD COLUMN IF NOT EXISTS caller_name TEXT,
  ADD COLUMN IF NOT EXISTS money_type TEXT DEFAULT 'UPI',
  ADD COLUMN IF NOT EXISTS screenshot_link TEXT;

ALTER TABLE IF EXISTS public.finance_calls
  ADD COLUMN IF NOT EXISTS money_type TEXT DEFAULT 'UPI',
  ADD COLUMN IF NOT EXISTS screenshot_link TEXT;

ALTER TABLE IF EXISTS public.income
  ADD COLUMN IF NOT EXISTS screenshot_link TEXT;

-- 2. Trigger function: Sync Personal Commitments -> Income (Updated with payment tracking)
CREATE OR REPLACE FUNCTION public.sync_personal_commitment_to_income()
RETURNS TRIGGER AS $$
DECLARE
  diff_amt NUMERIC;
  new_inc_id TEXT;
  existing_income_total NUMERIC;
  pay_mode TEXT;
BEGIN
  -- Prevent recursive trigger loops
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Cancelled commitments do not generate income
  IF NEW.status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

  -- Determine payment mode
  pay_mode := COALESCE(NEW.money_type, 'UPI');

  -- Calculate total existing income logged against this commitment
  SELECT COALESCE(SUM(amount), 0) INTO existing_income_total
  FROM public.income
  WHERE reference_id = NEW.id OR commitment_id = NEW.id;

  -- If received amount in commitment is greater than logged income, record difference
  IF NEW.received > existing_income_total THEN
    diff_amt := NEW.received - existing_income_total;
    new_inc_id := public.generate_next_income_id();

    INSERT INTO public.income (
      id,
      date,
      type,
      contributor,
      mobile_number,
      description,
      amount,
      money_type,
      screenshot_link,
      notes,
      reference_id,
      commitment_id
    ) VALUES (
      new_inc_id,
      CURRENT_DATE,
      'Personal Commitment',
      NEW.person_name,
      NEW.mobile_number,
      'Payment against ' || NEW.id,
      diff_amt,
      pay_mode,
      NEW.screenshot_link,
      COALESCE(NEW.notes, 'Auto-recorded from commitment ' || NEW.id),
      NEW.id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger function: Sync Finance Calls -> Income (Updated with payment tracking)
CREATE OR REPLACE FUNCTION public.sync_finance_call_to_income()
RETURNS TRIGGER AS $$
DECLARE
  diff_amt NUMERIC;
  new_inc_id TEXT;
  existing_income_total NUMERIC;
  pay_mode TEXT;
BEGIN
  -- Prevent recursive trigger loops
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Cancelled finance calls do not generate income
  IF NEW.status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

  -- Determine payment mode
  pay_mode := COALESCE(NEW.money_type, 'UPI');

  -- Calculate total existing income logged against this finance call
  SELECT COALESCE(SUM(amount), 0) INTO existing_income_total
  FROM public.income
  WHERE reference_id = NEW.id OR commitment_id = NEW.id;

  -- If received amount in call is greater than logged income, record difference
  IF NEW.received > existing_income_total THEN
    diff_amt := NEW.received - existing_income_total;
    new_inc_id := public.generate_next_income_id();

    INSERT INTO public.income (
      id,
      date,
      type,
      contributor,
      mobile_number,
      description,
      amount,
      money_type,
      screenshot_link,
      notes,
      reference_id,
      commitment_id
    ) VALUES (
      new_inc_id,
      CURRENT_DATE,
      'Finance Call',
      NEW.person_name,
      NEW.mobile_number,
      'Payment against ' || NEW.id,
      diff_amt,
      pay_mode,
      NEW.screenshot_link,
      COALESCE(NEW.notes, 'Auto-recorded from finance call ' || NEW.id),
      NEW.id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-attach Triggers on Personal Commitments and Finance Calls
DROP TRIGGER IF EXISTS trg_sync_personal_commitment_to_income ON public.personal_commitments;
CREATE TRIGGER trg_sync_personal_commitment_to_income
AFTER INSERT OR UPDATE OF received, person_name, mobile_number, status, caller_name, money_type, screenshot_link
ON public.personal_commitments
FOR EACH ROW
EXECUTE FUNCTION public.sync_personal_commitment_to_income();

DROP TRIGGER IF EXISTS trg_sync_finance_call_to_income ON public.finance_calls;
CREATE TRIGGER trg_sync_finance_call_to_income
AFTER INSERT OR UPDATE OF received, person_name, mobile_number, status, caller_name, money_type, screenshot_link
ON public.finance_calls
FOR EACH ROW
EXECUTE FUNCTION public.sync_finance_call_to_income();
