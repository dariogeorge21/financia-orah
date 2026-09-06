-- ============================================================
-- Orah - Campus Meet 2026: Financial Management
-- Migration: 20260906000000_allow_custom_income_types_and_bidirectional_sync.sql
-- Description:
--   1. Relaxes check constraint on `public.income.type` so custom
--      categories entered via "Other" or "Church/Convent" are allowed.
--   2. Adds sequential ID generators for Finance Calls (FC-XXXX) and
--      Personal Commitments (PCOM-XXXX).
--   3. Adds BEFORE INSERT trigger on `public.income` to automatically
--      generate source records (finance_calls, personal_commitments,
--      coupons, church_donations) when an income record of that type
--      is created, and link `reference_id` / `commitment_id`.
--   4. Updates `trg_sync_income_to_sources` to run AFTER INSERT, UPDATE,
--      or DELETE to ensure received totals and statuses are kept in sync.
--   5. Adds DELETE triggers on source tables to clean up related income rows.
--   6. Performs one-time reconciliation to backfill existing orphaned records.
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

-- ============================================================
-- 1. RELAX INCOME TYPE CHECK CONSTRAINT
-- ============================================================
ALTER TABLE public.income DROP CONSTRAINT IF EXISTS income_type_check;

-- Ensure type is a non-empty trimmed string, allowing any standard or custom category
ALTER TABLE public.income ADD CONSTRAINT income_type_check CHECK (length(trim(type)) > 0);

-- ============================================================
-- 2. SEQUENTIAL ID GENERATORS FOR FINANCE CALLS & COMMITMENTS
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_next_finance_call_id()
RETURNS TEXT AS $$
DECLARE
  max_num INT := 0;
  cur_num INT;
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.finance_calls WHERE id ~* '^FC-[0-9]+$' LOOP
    cur_num := SUBSTRING(rec.id FROM 4)::INT;
    IF cur_num > max_num THEN
      max_num := cur_num;
    END IF;
  END LOOP;
  RETURN 'FC-' || LPAD((max_num + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.generate_next_personal_commitment_id()
RETURNS TEXT AS $$
DECLARE
  max_num INT := 0;
  cur_num INT;
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.personal_commitments WHERE id ~* '^PCOM-[0-9]+$' LOOP
    cur_num := SUBSTRING(rec.id FROM 6)::INT;
    IF cur_num > max_num THEN
      max_num := cur_num;
    END IF;
  END LOOP;
  RETURN 'PCOM-' || LPAD((max_num + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. TRIGGER: SYNC INCOME BEFORE INSERT (AUTO-CREATE SOURCE ROW)
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_income_before_insert()
RETURNS TRIGGER AS $$
DECLARE
  new_target_id TEXT;
  existing_count INT;
  handover_val BOOLEAN;
BEGIN
  -- Prevent recursive trigger loops
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  handover_val := CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE COALESCE(NEW.is_handed_over, FALSE) END;

  -- 1. FINANCE CALL
  IF NEW.type = 'Finance Call' THEN
    -- Check if reference_id points to an existing finance call
    IF NEW.reference_id IS NOT NULL AND NEW.reference_id <> '' THEN
      SELECT COUNT(*) INTO existing_count FROM public.finance_calls WHERE id = NEW.reference_id;
      IF existing_count > 0 THEN
        IF NEW.commitment_id IS NULL OR NEW.commitment_id = '' THEN
          NEW.commitment_id := NEW.reference_id;
        END IF;
        RETURN NEW;
      END IF;
    END IF;

    -- Check if commitment_id points to an existing finance call
    IF NEW.commitment_id IS NOT NULL AND NEW.commitment_id <> '' THEN
      SELECT COUNT(*) INTO existing_count FROM public.finance_calls WHERE id = NEW.commitment_id;
      IF existing_count > 0 THEN
        IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
          NEW.reference_id := NEW.commitment_id;
        END IF;
        RETURN NEW;
      END IF;
    END IF;

    -- Create new finance call record
    new_target_id := public.generate_next_finance_call_id();
    INSERT INTO public.finance_calls (
      id,
      person_name,
      mobile_number,
      promised,
      received,
      status,
      money_type,
      is_handed_over,
      screenshot_link,
      notes,
      prayer_request,
      created_at
    ) VALUES (
      new_target_id,
      NEW.contributor,
      NEW.mobile_number,
      NEW.amount,
      NEW.amount,
      'Fully Received',
      NEW.money_type,
      handover_val,
      NEW.screenshot_link,
      NEW.notes,
      NEW.prayer_request,
      COALESCE(NEW.created_at, NOW())
    );

    NEW.reference_id := new_target_id;
    NEW.commitment_id := new_target_id;

  -- 2. PERSONAL COMMITMENT
  ELSIF NEW.type IN ('Personal Commitment', 'Commitment') THEN
    IF NEW.reference_id IS NOT NULL AND NEW.reference_id <> '' THEN
      SELECT COUNT(*) INTO existing_count FROM public.personal_commitments WHERE id = NEW.reference_id;
      IF existing_count > 0 THEN
        IF NEW.commitment_id IS NULL OR NEW.commitment_id = '' THEN
          NEW.commitment_id := NEW.reference_id;
        END IF;
        RETURN NEW;
      END IF;
    END IF;

    IF NEW.commitment_id IS NOT NULL AND NEW.commitment_id <> '' THEN
      SELECT COUNT(*) INTO existing_count FROM public.personal_commitments WHERE id = NEW.commitment_id;
      IF existing_count > 0 THEN
        IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
          NEW.reference_id := NEW.commitment_id;
        END IF;
        RETURN NEW;
      END IF;
    END IF;

    new_target_id := public.generate_next_personal_commitment_id();
    INSERT INTO public.personal_commitments (
      id,
      person_name,
      mobile_number,
      promised,
      received,
      status,
      money_type,
      is_handed_over,
      screenshot_link,
      notes,
      prayer_request,
      created_at
    ) VALUES (
      new_target_id,
      NEW.contributor,
      NEW.mobile_number,
      NEW.amount,
      NEW.amount,
      'Fully Received',
      NEW.money_type,
      handover_val,
      NEW.screenshot_link,
      NEW.notes,
      NEW.prayer_request,
      COALESCE(NEW.created_at, NOW())
    );

    NEW.reference_id := new_target_id;
    NEW.commitment_id := new_target_id;

  -- 3. COUPONS
  ELSIF NEW.type = 'Coupon' THEN
    IF NEW.reference_id IS NOT NULL AND NEW.reference_id <> '' THEN
      SELECT COUNT(*) INTO existing_count FROM public.coupons WHERE id = NEW.reference_id;
      IF existing_count > 0 THEN
        IF NEW.commitment_id IS NULL OR NEW.commitment_id = '' THEN
          NEW.commitment_id := NEW.reference_id;
        END IF;
        RETURN NEW;
      END IF;
    END IF;

    IF NEW.commitment_id IS NOT NULL AND NEW.commitment_id <> '' THEN
      SELECT COUNT(*) INTO existing_count FROM public.coupons WHERE id = NEW.commitment_id;
      IF existing_count > 0 THEN
        IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
          NEW.reference_id := NEW.commitment_id;
        END IF;
        RETURN NEW;
      END IF;
    END IF;

    new_target_id := public.generate_next_coupon_id();
    INSERT INTO public.coupons (
      id,
      contributor_name,
      mobile_number,
      date,
      money_type,
      amount,
      is_handed_over,
      notes,
      prayer_request,
      screenshot_link,
      created_at
    ) VALUES (
      new_target_id,
      NEW.contributor,
      NEW.mobile_number,
      NEW.date,
      NEW.money_type,
      NEW.amount,
      handover_val,
      NEW.notes,
      NEW.prayer_request,
      NEW.screenshot_link,
      COALESCE(NEW.created_at, NOW())
    );

    NEW.reference_id := new_target_id;
    NEW.commitment_id := new_target_id;

  -- 4. CHURCH & CONVENT DONATIONS
  ELSIF NEW.type IN ('Church', 'Church/Convent') THEN
    IF NEW.reference_id IS NOT NULL AND NEW.reference_id <> '' THEN
      SELECT COUNT(*) INTO existing_count FROM public.church_donations WHERE id = NEW.reference_id;
      IF existing_count > 0 THEN
        IF NEW.commitment_id IS NULL OR NEW.commitment_id = '' THEN
          NEW.commitment_id := NEW.reference_id;
        END IF;
        RETURN NEW;
      END IF;
    END IF;

    IF NEW.commitment_id IS NOT NULL AND NEW.commitment_id <> '' THEN
      SELECT COUNT(*) INTO existing_count FROM public.church_donations WHERE id = NEW.commitment_id;
      IF existing_count > 0 THEN
        IF NEW.reference_id IS NULL OR NEW.reference_id = '' THEN
          NEW.reference_id := NEW.commitment_id;
        END IF;
        RETURN NEW;
      END IF;
    END IF;

    new_target_id := public.generate_next_church_donation_id();
    INSERT INTO public.church_donations (
      id,
      church_name,
      contact_number,
      date,
      money_type,
      amount,
      is_handed_over,
      notes,
      prayer_request,
      screenshot_link,
      created_at
    ) VALUES (
      new_target_id,
      NEW.contributor,
      NEW.mobile_number,
      NEW.date,
      NEW.money_type,
      NEW.amount,
      handover_val,
      NEW.notes,
      NEW.prayer_request,
      NEW.screenshot_link,
      COALESCE(NEW.created_at, NOW())
    );

    NEW.reference_id := new_target_id;
    NEW.commitment_id := new_target_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_income_before_insert ON public.income;
CREATE TRIGGER trg_sync_income_before_insert
BEFORE INSERT ON public.income
FOR EACH ROW
EXECUTE FUNCTION public.sync_income_before_insert();

-- ============================================================
-- 4. TRIGGER: SYNC INCOME AFTER INSERT OR UPDATE OR DELETE
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_income_to_sources()
RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
  total_rec NUMERIC;
  target_promised NUMERIC;
  target_status TEXT;
BEGIN
  -- Prevent recursive trigger loops
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  target_id := COALESCE(
    CASE WHEN NEW IS NOT NULL THEN COALESCE(NEW.reference_id, NEW.commitment_id) ELSE NULL END,
    CASE WHEN OLD IS NOT NULL THEN COALESCE(OLD.reference_id, OLD.commitment_id) ELSE NULL END
  );

  IF target_id IS NULL OR target_id = '' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- 1. Handling INSERT from Income (Update totals on existing source pledge)
  IF TG_OP = 'INSERT' THEN
    IF target_id ~* '^FC-' OR NEW.type = 'Finance Call' THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_rec
      FROM public.income
      WHERE reference_id = target_id OR commitment_id = target_id;

      SELECT promised, status INTO target_promised, target_status
      FROM public.finance_calls
      WHERE id = target_id;

      IF FOUND AND target_status <> 'Cancelled' THEN
        UPDATE public.finance_calls
        SET
          received = total_rec,
          status = CASE
            WHEN total_rec >= target_promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END,
          is_handed_over = CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE NEW.is_handed_over END,
          money_type = NEW.money_type
        WHERE id = target_id;
      END IF;

    ELSIF target_id ~* '^PCOM-' OR NEW.type IN ('Personal Commitment', 'Commitment') THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_rec
      FROM public.income
      WHERE reference_id = target_id OR commitment_id = target_id;

      SELECT promised, status INTO target_promised, target_status
      FROM public.personal_commitments
      WHERE id = target_id;

      IF FOUND AND target_status <> 'Cancelled' THEN
        UPDATE public.personal_commitments
        SET
          received = total_rec,
          status = CASE
            WHEN total_rec >= target_promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END,
          is_handed_over = CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE NEW.is_handed_over END,
          money_type = NEW.money_type
        WHERE id = target_id;
      END IF;
    END IF;

    RETURN NEW;

  -- 2. Handling UPDATE from Income
  ELSIF TG_OP = 'UPDATE' THEN
    -- Match Church Donations
    IF target_id ~* '^(CHU|CDON)-' OR NEW.type IN ('Church', 'Church/Convent') THEN
      UPDATE public.church_donations
      SET
        is_handed_over = CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE NEW.is_handed_over END,
        money_type = NEW.money_type,
        amount = NEW.amount,
        date = NEW.date,
        church_name = NEW.contributor,
        contact_number = NEW.mobile_number,
        notes = NEW.notes,
        prayer_request = NEW.prayer_request,
        screenshot_link = NEW.screenshot_link
      WHERE id = target_id;

    -- Match Coupons
    ELSIF target_id ~* '^(CPN|COUP)-' OR NEW.type = 'Coupon' THEN
      UPDATE public.coupons
      SET
        is_handed_over = CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE NEW.is_handed_over END,
        money_type = NEW.money_type,
        amount = NEW.amount,
        date = NEW.date,
        contributor_name = NEW.contributor,
        mobile_number = NEW.mobile_number,
        notes = NEW.notes,
        prayer_request = NEW.prayer_request,
        screenshot_link = NEW.screenshot_link
      WHERE id = target_id;

    -- Match Personal Commitments
    ELSIF target_id ~* '^PCOM-' OR NEW.type IN ('Personal Commitment', 'Commitment') THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_rec
      FROM public.income
      WHERE reference_id = target_id OR commitment_id = target_id;

      SELECT promised, status INTO target_promised, target_status
      FROM public.personal_commitments
      WHERE id = target_id;

      IF FOUND AND target_status <> 'Cancelled' THEN
        UPDATE public.personal_commitments
        SET
          is_handed_over = CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE NEW.is_handed_over END,
          money_type = NEW.money_type,
          received = total_rec,
          status = CASE
            WHEN total_rec >= target_promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END
        WHERE id = target_id;
      END IF;

    -- Match Finance Calls
    ELSIF target_id ~* '^FC-' OR NEW.type = 'Finance Call' THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_rec
      FROM public.income
      WHERE reference_id = target_id OR commitment_id = target_id;

      SELECT promised, status INTO target_promised, target_status
      FROM public.finance_calls
      WHERE id = target_id;

      IF FOUND AND target_status <> 'Cancelled' THEN
        UPDATE public.finance_calls
        SET
          is_handed_over = CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE NEW.is_handed_over END,
          money_type = NEW.money_type,
          received = total_rec,
          status = CASE
            WHEN total_rec >= target_promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END
        WHERE id = target_id;
      END IF;
    END IF;

    RETURN NEW;

  -- 3. Handling DELETE from Income
  ELSIF TG_OP = 'DELETE' THEN
    IF target_id ~* '^PCOM-' OR OLD.type IN ('Personal Commitment', 'Commitment') THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_rec
      FROM public.income
      WHERE reference_id = target_id OR commitment_id = target_id;

      SELECT promised, status INTO target_promised, target_status
      FROM public.personal_commitments
      WHERE id = target_id;

      IF FOUND AND target_status <> 'Cancelled' THEN
        UPDATE public.personal_commitments
        SET
          received = total_rec,
          status = CASE
            WHEN total_rec >= target_promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END
        WHERE id = target_id;
      END IF;

    ELSIF target_id ~* '^FC-' OR OLD.type = 'Finance Call' THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_rec
      FROM public.income
      WHERE reference_id = target_id OR commitment_id = target_id;

      SELECT promised, status INTO target_promised, target_status
      FROM public.finance_calls
      WHERE id = target_id;

      IF FOUND AND target_status <> 'Cancelled' THEN
        UPDATE public.finance_calls
        SET
          received = total_rec,
          status = CASE
            WHEN total_rec >= target_promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END
        WHERE id = target_id;
      END IF;

    ELSIF target_id ~* '^(CPN|COUP)-' OR OLD.type = 'Coupon' THEN
      DELETE FROM public.coupons WHERE id = target_id;

    ELSIF target_id ~* '^(CHU|CDON)-' OR OLD.type IN ('Church', 'Church/Convent') THEN
      DELETE FROM public.church_donations WHERE id = target_id;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Replace existing update/delete trigger with comprehensive insert/update/delete trigger
DROP TRIGGER IF EXISTS trg_sync_income_to_sources ON public.income;
CREATE TRIGGER trg_sync_income_to_sources
AFTER INSERT OR UPDATE OR DELETE
ON public.income
FOR EACH ROW
EXECUTE FUNCTION public.sync_income_to_sources();

-- ============================================================
-- 5. CASCADE DELETES FROM SOURCE TABLES TO INCOME
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_source_delete_to_income()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  DELETE FROM public.income
  WHERE reference_id = OLD.id OR commitment_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_delete_finance_call_to_income ON public.finance_calls;
CREATE TRIGGER trg_sync_delete_finance_call_to_income
AFTER DELETE ON public.finance_calls
FOR EACH ROW EXECUTE FUNCTION public.sync_source_delete_to_income();

DROP TRIGGER IF EXISTS trg_sync_delete_personal_commitment_to_income ON public.personal_commitments;
CREATE TRIGGER trg_sync_delete_personal_commitment_to_income
AFTER DELETE ON public.personal_commitments
FOR EACH ROW EXECUTE FUNCTION public.sync_source_delete_to_income();

-- ============================================================
-- 6. ONE-TIME RECONCILIATION & HISTORICAL BACKFILL
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  new_id TEXT;
  handover_val BOOLEAN;
BEGIN
  -- 1. Backfill orphaned Finance Calls from Income
  FOR rec IN 
    SELECT * FROM public.income 
    WHERE type = 'Finance Call' 
      AND (
        reference_id IS NULL 
        OR reference_id = '' 
        OR NOT EXISTS (SELECT 1 FROM public.finance_calls WHERE id = income.reference_id)
      )
  LOOP
    new_id := public.generate_next_finance_call_id();
    handover_val := CASE WHEN rec.money_type = 'UPI' THEN TRUE ELSE COALESCE(rec.is_handed_over, FALSE) END;

    INSERT INTO public.finance_calls (
      id, person_name, mobile_number, promised, received,
      status, money_type, is_handed_over, screenshot_link,
      notes, prayer_request, created_at
    ) VALUES (
      new_id, rec.contributor, rec.mobile_number, rec.amount, rec.amount,
      'Fully Received', rec.money_type, handover_val, rec.screenshot_link,
      rec.notes, rec.prayer_request, COALESCE(rec.created_at, NOW())
    );

    UPDATE public.income 
    SET reference_id = new_id, commitment_id = new_id 
    WHERE id = rec.id;
  END LOOP;

  -- 2. Backfill orphaned Personal Commitments from Income
  FOR rec IN 
    SELECT * FROM public.income 
    WHERE type IN ('Personal Commitment', 'Commitment')
      AND (
        reference_id IS NULL 
        OR reference_id = '' 
        OR NOT EXISTS (SELECT 1 FROM public.personal_commitments WHERE id = income.reference_id)
      )
  LOOP
    new_id := public.generate_next_personal_commitment_id();
    handover_val := CASE WHEN rec.money_type = 'UPI' THEN TRUE ELSE COALESCE(rec.is_handed_over, FALSE) END;

    INSERT INTO public.personal_commitments (
      id, person_name, mobile_number, promised, received,
      status, money_type, is_handed_over, screenshot_link,
      notes, prayer_request, created_at
    ) VALUES (
      new_id, rec.contributor, rec.mobile_number, rec.amount, rec.amount,
      'Fully Received', rec.money_type, handover_val, rec.screenshot_link,
      rec.notes, rec.prayer_request, COALESCE(rec.created_at, NOW())
    );

    UPDATE public.income 
    SET reference_id = new_id, commitment_id = new_id 
    WHERE id = rec.id;
  END LOOP;

  -- 3. Backfill orphaned Coupons from Income
  FOR rec IN 
    SELECT * FROM public.income 
    WHERE type = 'Coupon'
      AND (
        reference_id IS NULL 
        OR reference_id = '' 
        OR NOT EXISTS (SELECT 1 FROM public.coupons WHERE id = income.reference_id)
      )
  LOOP
    new_id := public.generate_next_coupon_id();
    handover_val := CASE WHEN rec.money_type = 'UPI' THEN TRUE ELSE COALESCE(rec.is_handed_over, FALSE) END;

    INSERT INTO public.coupons (
      id, contributor_name, mobile_number, date, money_type,
      amount, is_handed_over, notes, prayer_request, screenshot_link, created_at
    ) VALUES (
      new_id, rec.contributor, rec.mobile_number, rec.date, rec.money_type,
      rec.amount, handover_val, rec.notes, rec.prayer_request, rec.screenshot_link, COALESCE(rec.created_at, NOW())
    );

    UPDATE public.income 
    SET reference_id = new_id, commitment_id = new_id 
    WHERE id = rec.id;
  END LOOP;

  -- 4. Backfill orphaned Church Donations from Income
  FOR rec IN 
    SELECT * FROM public.income 
    WHERE type IN ('Church', 'Church/Convent')
      AND (
        reference_id IS NULL 
        OR reference_id = '' 
        OR NOT EXISTS (SELECT 1 FROM public.church_donations WHERE id = income.reference_id)
      )
  LOOP
    new_id := public.generate_next_church_donation_id();
    handover_val := CASE WHEN rec.money_type = 'UPI' THEN TRUE ELSE COALESCE(rec.is_handed_over, FALSE) END;

    INSERT INTO public.church_donations (
      id, church_name, contact_number, date, money_type,
      amount, is_handed_over, notes, prayer_request, screenshot_link, created_at
    ) VALUES (
      new_id, rec.contributor, rec.mobile_number, rec.date, rec.money_type,
      rec.amount, handover_val, rec.notes, rec.prayer_request, rec.screenshot_link, COALESCE(rec.created_at, NOW())
    );

    UPDATE public.income 
    SET reference_id = new_id, commitment_id = new_id 
    WHERE id = rec.id;
  END LOOP;
END;
$$;
