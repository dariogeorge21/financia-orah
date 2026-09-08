-- ============================================================
-- Orah - Campus Meet 2026: Financial Management
-- Migration: 20260908000000_add_cash_plus_upi_to_coupons.sql
-- Description:
--   1. Adds cash_amount and upi_amount columns to public.coupons for split collections.
--   2. Updates money_type check constraint on public.coupons to allow 'Cash + UPI'.
--   3. Updates sync_coupon_to_income() trigger to synchronize split payments as
--      distinct Cash and UPI entries in public.income so cash-in-hand and digital
--      balances remain 100% mathematically accurate.
-- Apply via: Supabase Dashboard > SQL Editor, or `npx supabase db push`
-- ============================================================

-- 1. Schema Extensions for public.coupons
ALTER TABLE IF EXISTS public.coupons
  ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS upi_amount NUMERIC(12,2) DEFAULT NULL;

-- 2. Update money_type constraint on public.coupons
ALTER TABLE IF EXISTS public.coupons
  DROP CONSTRAINT IF EXISTS coupons_money_type_check;

ALTER TABLE IF EXISTS public.coupons
  ADD CONSTRAINT coupons_money_type_check
  CHECK (money_type IN ('Cash', 'UPI', 'Cash + UPI'));

-- 3. Update sync_coupon_to_income Trigger Function
CREATE OR REPLACE FUNCTION public.sync_coupon_to_income()
RETURNS TRIGGER AS $$
DECLARE
  base_inc_id TEXT;
  desc_text TEXT;
  note_text TEXT;
  c_amt NUMERIC(12,2);
  u_amt NUMERIC(12,2);
  handed_over_val BOOLEAN;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  desc_text := 'Coupon Collection' || CASE WHEN NEW.booklet_number IS NOT NULL AND NEW.booklet_number <> '' THEN ' (Booklet #' || NEW.booklet_number || ')' ELSE '' END;
  note_text := COALESCE(NEW.notes, '') || CASE WHEN NEW.collected_by IS NOT NULL AND NEW.collected_by <> '' THEN CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> '' THEN ' | ' ELSE '' END || 'Volunteer: ' || NEW.collected_by ELSE '' END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.money_type = 'Cash + UPI' THEN
      c_amt := COALESCE(NEW.cash_amount, 0);
      u_amt := COALESCE(NEW.upi_amount, 0);
      handed_over_val := COALESCE(NEW.is_handed_over, FALSE);

      -- Insert Cash Portion if > 0
      IF c_amt > 0 THEN
        base_inc_id := public.generate_next_income_id();
        INSERT INTO public.income (
          id, date, type, contributor, mobile_number, description, amount, money_type,
          screenshot_link, notes, reference_id, commitment_id, is_handed_over
        ) VALUES (
          base_inc_id, NEW.date, 'Coupon', NEW.contributor_name, NEW.mobile_number,
          desc_text || ' (Cash)', c_amt, 'Cash', NULL,
          NULLIF(note_text || ' | Split payment: Cash portion', ' | Split payment: Cash portion'),
          NEW.id || '-CASH', NEW.id, handed_over_val
        );
      END IF;

      -- Insert UPI Portion if > 0
      IF u_amt > 0 THEN
        base_inc_id := public.generate_next_income_id();
        INSERT INTO public.income (
          id, date, type, contributor, mobile_number, description, amount, money_type,
          screenshot_link, notes, reference_id, commitment_id, is_handed_over
        ) VALUES (
          base_inc_id, NEW.date, 'Coupon', NEW.contributor_name, NEW.mobile_number,
          desc_text || ' (UPI)', u_amt, 'UPI', NEW.screenshot_link,
          NULLIF(note_text || ' | Split payment: UPI portion', ' | Split payment: UPI portion'),
          NEW.id || '-UPI', NEW.id, TRUE
        );
      END IF;

    ELSE
      -- Standard single mode (Cash or UPI)
      handed_over_val := CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE COALESCE(NEW.is_handed_over, FALSE) END;
      base_inc_id := public.generate_next_income_id();
      INSERT INTO public.income (
        id, date, type, contributor, mobile_number, description, amount, money_type,
        screenshot_link, notes, reference_id, commitment_id, is_handed_over
      ) VALUES (
        base_inc_id, NEW.date, 'Coupon', NEW.contributor_name, NEW.mobile_number,
        desc_text, NEW.amount, NEW.money_type, NEW.screenshot_link,
        NULLIF(note_text, ''), NEW.id, NEW.id, handed_over_val
      );
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.money_type = 'Cash + UPI' THEN
      c_amt := COALESCE(NEW.cash_amount, 0);
      u_amt := COALESCE(NEW.upi_amount, 0);
      handed_over_val := COALESCE(NEW.is_handed_over, FALSE);

      -- Remove any legacy single record if switched from single to split
      DELETE FROM public.income WHERE reference_id = NEW.id;

      -- Upsert / Update Cash portion
      IF EXISTS (SELECT 1 FROM public.income WHERE reference_id = NEW.id || '-CASH') THEN
        UPDATE public.income
        SET
          date = NEW.date,
          contributor = NEW.contributor_name,
          mobile_number = NEW.mobile_number,
          description = desc_text || ' (Cash)',
          amount = c_amt,
          money_type = 'Cash',
          notes = NULLIF(note_text || ' | Split payment: Cash portion', ' | Split payment: Cash portion'),
          is_handed_over = handed_over_val
        WHERE reference_id = NEW.id || '-CASH';
      ELSIF c_amt > 0 THEN
        base_inc_id := public.generate_next_income_id();
        INSERT INTO public.income (
          id, date, type, contributor, mobile_number, description, amount, money_type,
          screenshot_link, notes, reference_id, commitment_id, is_handed_over
        ) VALUES (
          base_inc_id, NEW.date, 'Coupon', NEW.contributor_name, NEW.mobile_number,
          desc_text || ' (Cash)', c_amt, 'Cash', NULL,
          NULLIF(note_text || ' | Split payment: Cash portion', ' | Split payment: Cash portion'),
          NEW.id || '-CASH', NEW.id, handed_over_val
        );
      END IF;

      -- Upsert / Update UPI portion
      IF EXISTS (SELECT 1 FROM public.income WHERE reference_id = NEW.id || '-UPI') THEN
        UPDATE public.income
        SET
          date = NEW.date,
          contributor = NEW.contributor_name,
          mobile_number = NEW.mobile_number,
          description = desc_text || ' (UPI)',
          amount = u_amt,
          money_type = 'UPI',
          screenshot_link = NEW.screenshot_link,
          notes = NULLIF(note_text || ' | Split payment: UPI portion', ' | Split payment: UPI portion'),
          is_handed_over = TRUE
        WHERE reference_id = NEW.id || '-UPI';
      ELSIF u_amt > 0 THEN
        base_inc_id := public.generate_next_income_id();
        INSERT INTO public.income (
          id, date, type, contributor, mobile_number, description, amount, money_type,
          screenshot_link, notes, reference_id, commitment_id, is_handed_over
        ) VALUES (
          base_inc_id, NEW.date, 'Coupon', NEW.contributor_name, NEW.mobile_number,
          desc_text || ' (UPI)', u_amt, 'UPI', NEW.screenshot_link,
          NULLIF(note_text || ' | Split payment: UPI portion', ' | Split payment: UPI portion'),
          NEW.id || '-UPI', NEW.id, TRUE
        );
      END IF;

    ELSE
      -- Switched to or kept as single mode (Cash or UPI)
      -- Clean up any split records if existed
      DELETE FROM public.income WHERE reference_id IN (NEW.id || '-CASH', NEW.id || '-UPI');

      handed_over_val := CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE COALESCE(NEW.is_handed_over, FALSE) END;

      IF EXISTS (SELECT 1 FROM public.income WHERE reference_id = NEW.id) THEN
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
        WHERE reference_id = NEW.id;
      ELSE
        base_inc_id := public.generate_next_income_id();
        INSERT INTO public.income (
          id, date, type, contributor, mobile_number, description, amount, money_type,
          screenshot_link, notes, reference_id, commitment_id, is_handed_over
        ) VALUES (
          base_inc_id, NEW.date, 'Coupon', NEW.contributor_name, NEW.mobile_number,
          desc_text, NEW.amount, NEW.money_type, NEW.screenshot_link,
          NULLIF(note_text, ''), NEW.id, NEW.id, handed_over_val
        );
      END IF;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.income
    WHERE reference_id IN (OLD.id, OLD.id || '-CASH', OLD.id || '-UPI')
       OR commitment_id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
