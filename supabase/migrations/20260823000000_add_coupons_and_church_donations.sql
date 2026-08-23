-- ============================================================
-- Orah - Campus Meet 2026: Financial Management
-- Migration: 20260823000000_add_coupons_and_church_donations.sql
-- Description:
--   1. Creates `public.coupons` table for tracking coupon booklets.
--   2. Creates `public.church_donations` table for church & convent donations.
--   3. Adds sequential ID generators (CPN-XXXX, CHU-XXXX).
--   4. Configures Row Level Security (RLS) policies.
--   5. Sets up automatic bi-directional synchronization to `public.income`.
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

-- ============================================================
-- 1. COUPONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id               TEXT PRIMARY KEY,             -- CPN-XXXX
  contributor_name TEXT NOT NULL,
  mobile_number    TEXT,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  money_type       TEXT NOT NULL CHECK (money_type IN ('Cash', 'UPI')),
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  collected_by     TEXT,                         -- Volunteer name
  booklet_number   TEXT,                         -- Coupon Booklet Number
  notes            TEXT,
  screenshot_link  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read coupons"  ON public.coupons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert coupons" ON public.coupons FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update coupons" ON public.coupons FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete coupons" ON public.coupons FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 2. CHURCH & CONVENT DONATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.church_donations (
  id               TEXT PRIMARY KEY,             -- CHU-XXXX
  church_name      TEXT NOT NULL,
  contact_number   TEXT,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  collected_by     TEXT,                         -- Volunteer name
  money_type       TEXT NOT NULL CHECK (money_type IN ('Cash', 'UPI')),
  amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  notes            TEXT,
  screenshot_link  TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.church_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read church_donations"  ON public.church_donations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert church_donations" ON public.church_donations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update church_donations" ON public.church_donations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete church_donations" ON public.church_donations FOR DELETE USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. SEQUENTIAL ID GENERATORS
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_next_coupon_id()
RETURNS TEXT AS $$
DECLARE
  max_num INT := 0;
  cur_num INT;
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.coupons WHERE id ~* '^CPN-[0-9]+$' LOOP
    cur_num := SUBSTRING(rec.id FROM 5)::INT;
    IF cur_num > max_num THEN
      max_num := cur_num;
    END IF;
  END LOOP;
  RETURN 'CPN-' || LPAD((max_num + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_next_church_donation_id()
RETURNS TEXT AS $$
DECLARE
  max_num INT := 0;
  cur_num INT;
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.church_donations WHERE id ~* '^CHU-[0-9]+$' LOOP
    cur_num := SUBSTRING(rec.id FROM 5)::INT;
    IF cur_num > max_num THEN
      max_num := cur_num;
    END IF;
  END LOOP;
  RETURN 'CHU-' || LPAD((max_num + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. AUTOMATIC SYNCHRONIZATION: COUPONS -> INCOME
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_coupon_to_income()
RETURNS TRIGGER AS $$
DECLARE
  new_inc_id TEXT;
  desc_text TEXT;
  note_text TEXT;
BEGIN
  -- Prevent recursive trigger loops
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Build description
  desc_text := 'Coupon Collection' || CASE WHEN NEW.booklet_number IS NOT NULL AND NEW.booklet_number <> '' THEN ' (Booklet #' || NEW.booklet_number || ')' ELSE '' END;
  
  -- Build notes
  note_text := COALESCE(NEW.notes, '') || CASE WHEN NEW.collected_by IS NOT NULL AND NEW.collected_by <> '' THEN CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> '' THEN ' | ' ELSE '' END || 'Volunteer: ' || NEW.collected_by ELSE '' END;

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
      commitment_id
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
      NEW.id
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
      notes = NULLIF(note_text, '')
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

-- Attach trigger to coupons table
DROP TRIGGER IF EXISTS trigger_sync_coupon_to_income ON public.coupons;
CREATE TRIGGER trigger_sync_coupon_to_income
AFTER INSERT OR UPDATE OR DELETE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.sync_coupon_to_income();

-- ============================================================
-- 5. AUTOMATIC SYNCHRONIZATION: CHURCH DONATIONS -> INCOME
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_church_donation_to_income()
RETURNS TRIGGER AS $$
DECLARE
  new_inc_id TEXT;
  note_text TEXT;
BEGIN
  -- Prevent recursive trigger loops
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Build notes
  note_text := COALESCE(NEW.notes, '') || CASE WHEN NEW.collected_by IS NOT NULL AND NEW.collected_by <> '' THEN CASE WHEN NEW.notes IS NOT NULL AND NEW.notes <> '' THEN ' | ' ELSE '' END || 'Volunteer: ' || NEW.collected_by ELSE '' END;

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
      commitment_id
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
      NEW.id
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
      notes = NULLIF(note_text, '')
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

-- Attach trigger to church_donations table
DROP TRIGGER IF EXISTS trigger_sync_church_donation_to_income ON public.church_donations;
CREATE TRIGGER trigger_sync_church_donation_to_income
AFTER INSERT OR UPDATE OR DELETE ON public.church_donations
FOR EACH ROW EXECUTE FUNCTION public.sync_church_donation_to_income();
