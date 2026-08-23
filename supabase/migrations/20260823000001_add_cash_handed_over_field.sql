-- ============================================================
-- Orah - Campus Meet 2026: Financial Management
-- Migration: 20260823000001_add_cash_handed_over_field.sql
-- Description:
--   1. Adds `is_handed_over` boolean column to all cash income tables:
--      - `income` (defaults to TRUE for existing/UPI, tracks whether cash has been received by finance team)
--      - `coupons` (tracks whether volunteer has handed over cash)
--      - `church_donations` (tracks whether volunteer has handed over cash)
--      - `personal_commitments` (tracks whether volunteer has handed over cash)
--      - `finance_calls` (tracks whether volunteer has handed over cash)
--   2. Updates trigger functions to synchronize `is_handed_over` into `public.income`.
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

-- 1. Schema Extensions
ALTER TABLE IF EXISTS public.income
  ADD COLUMN IF NOT EXISTS is_handed_over BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE IF EXISTS public.coupons
  ADD COLUMN IF NOT EXISTS is_handed_over BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS public.church_donations
  ADD COLUMN IF NOT EXISTS is_handed_over BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS public.personal_commitments
  ADD COLUMN IF NOT EXISTS is_handed_over BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE IF EXISTS public.finance_calls
  ADD COLUMN IF NOT EXISTS is_handed_over BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Trigger: Sync Coupons -> Income
CREATE OR REPLACE FUNCTION public.sync_coupon_to_income()
RETURNS TRIGGER AS $$
DECLARE
  new_inc_id TEXT;
  desc_text TEXT;
  note_text TEXT;
  handed_over_val BOOLEAN;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  desc_text := 'Coupon Collection' || CASE WHEN NEW.booklet_number IS NOT NULL AND NEW.booklet_number <> '' THEN ' (Booklet #' || NEW.booklet_number || ')' ELSE '' END;
  note_text := COALESCE(NEW.notes, '') || CASE WHEN NEW.collected_by IS NOT NULL AND NEW.collected_by <> '' THEN CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> '' THEN ' | ' ELSE '' END || 'Volunteer: ' || NEW.collected_by ELSE '' END;
  handed_over_val := CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE COALESCE(NEW.is_handed_over, FALSE) END;

  IF TG_OP = 'INSERT' THEN
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
      commitment_id,
      is_handed_over
    ) VALUES (
      new_inc_id,
      NEW.date,
      'Coupon',
      NEW.contributor_name,
      NEW.mobile_number,
      desc_text,
      NEW.amount,
      NEW.money_type,
      NEW.screenshot_link,
      NULLIF(note_text, ''),
      NEW.id,
      NEW.id,
      handed_over_val
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.income
    SET
      date = NEW.date,
      contributor = NEW.contributor_name,
      mobile_number = NEW.mobile_number,
      description = desc_text,
      amount = NEW.amount,
      money_type = NEW.money_type,
      screenshot_link = NEW.screenshot_link,
      notes = NULLIF(note_text, ''),
      is_handed_over = handed_over_val
    WHERE reference_id = NEW.id OR commitment_id = NEW.id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.income
    WHERE reference_id = OLD.id OR commitment_id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger: Sync Church & Convent Donations -> Income
CREATE OR REPLACE FUNCTION public.sync_church_donation_to_income()
RETURNS TRIGGER AS $$
DECLARE
  new_inc_id TEXT;
  note_text TEXT;
  handed_over_val BOOLEAN;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  note_text := COALESCE(NEW.notes, '') || CASE WHEN NEW.collected_by IS NOT NULL AND NEW.collected_by <> '' THEN CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> '' THEN ' | ' ELSE '' END || 'Volunteer: ' || NEW.collected_by ELSE '' END;
  handed_over_val := CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE COALESCE(NEW.is_handed_over, FALSE) END;

  IF TG_OP = 'INSERT' THEN
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
      commitment_id,
      is_handed_over
    ) VALUES (
      new_inc_id,
      NEW.date,
      'Church',
      NEW.church_name,
      NEW.contact_number,
      'Church & Convent Donation',
      NEW.amount,
      NEW.money_type,
      NEW.screenshot_link,
      NULLIF(note_text, ''),
      NEW.id,
      NEW.id,
      handed_over_val
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.income
    SET
      date = NEW.date,
      contributor = NEW.church_name,
      mobile_number = NEW.contact_number,
      amount = NEW.amount,
      money_type = NEW.money_type,
      screenshot_link = NEW.screenshot_link,
      notes = NULLIF(note_text, ''),
      is_handed_over = handed_over_val
    WHERE reference_id = NEW.id OR commitment_id = NEW.id;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.income
    WHERE reference_id = OLD.id OR commitment_id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger: Sync Personal Commitments -> Income
CREATE OR REPLACE FUNCTION public.sync_personal_commitment_to_income()
RETURNS TRIGGER AS $$
DECLARE
  diff_amt NUMERIC;
  new_inc_id TEXT;
  existing_income_total NUMERIC;
  pay_mode TEXT;
  handed_over_val BOOLEAN;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

  pay_mode := COALESCE(NEW.money_type, 'UPI');
  handed_over_val := CASE WHEN pay_mode = 'UPI' THEN TRUE ELSE COALESCE(NEW.is_handed_over, FALSE) END;

  SELECT COALESCE(SUM(amount), 0) INTO existing_income_total
  FROM public.income
  WHERE reference_id = NEW.id OR commitment_id = NEW.id;

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
      commitment_id,
      is_handed_over
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
      NEW.id,
      handed_over_val
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger: Sync Finance Calls -> Income
CREATE OR REPLACE FUNCTION public.sync_finance_call_to_income()
RETURNS TRIGGER AS $$
DECLARE
  diff_amt NUMERIC;
  new_inc_id TEXT;
  existing_income_total NUMERIC;
  pay_mode TEXT;
  handed_over_val BOOLEAN;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

  pay_mode := COALESCE(NEW.money_type, 'UPI');
  handed_over_val := CASE WHEN pay_mode = 'UPI' THEN TRUE ELSE COALESCE(NEW.is_handed_over, FALSE) END;

  SELECT COALESCE(SUM(amount), 0) INTO existing_income_total
  FROM public.income
  WHERE reference_id = NEW.id OR commitment_id = NEW.id;

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
      commitment_id,
      is_handed_over
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
      NEW.id,
      handed_over_val
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
