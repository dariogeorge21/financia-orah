-- ============================================================
-- Orah - Campus Meet 2026: Financial Management
-- Migration: 20260822000001_sync_commitments_and_income.sql
-- Description: Automatically synchronizes received funds from
--              personal commitments & finance calls into the income table,
--              and updates commitment received totals when income is logged.
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

-- 1. Helper function: Generate next sequential Income ID (INC-XXXX)
CREATE OR REPLACE FUNCTION public.generate_next_income_id()
RETURNS TEXT AS $$
DECLARE
  max_num INT := 0;
  cur_num INT;
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.income WHERE id ~* '^INC-[0-9]+$' LOOP
    cur_num := SUBSTRING(rec.id FROM 5)::INT;
    IF cur_num > max_num THEN
      max_num := cur_num;
    END IF;
  END LOOP;
  RETURN 'INC-' || LPAD((max_num + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger function: Sync Personal Commitments -> Income
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
      'UPI',
      COALESCE(NEW.notes, 'Auto-recorded from commitment ' || NEW.id),
      NEW.id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger function: Sync Finance Calls -> Income
CREATE OR REPLACE FUNCTION public.sync_finance_call_to_income()
RETURNS TRIGGER AS $$
DECLARE
  diff_amt NUMERIC;
  new_inc_id TEXT;
  existing_income_total NUMERIC;
BEGIN
  -- Prevent recursive trigger loops
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Cancelled finance calls do not generate income
  IF NEW.status = 'Cancelled' THEN
    RETURN NEW;
  END IF;

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
      'UPI',
      COALESCE(NEW.notes, 'Auto-recorded from finance call ' || NEW.id),
      NEW.id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger function: Sync Income -> Personal Commitments & Finance Calls
CREATE OR REPLACE FUNCTION public.sync_income_to_commitments()
RETURNS TRIGGER AS $$
DECLARE
  target_ref TEXT;
  total_rec NUMERIC;
  target_promised NUMERIC;
  target_status TEXT;
BEGIN
  -- Prevent recursive trigger loops
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  target_ref := COALESCE(
    CASE WHEN NEW IS NOT NULL THEN COALESCE(NEW.reference_id, NEW.commitment_id) ELSE NULL END,
    CASE WHEN OLD IS NOT NULL THEN COALESCE(OLD.reference_id, OLD.commitment_id) ELSE NULL END
  );

  IF target_ref IS NOT NULL THEN
    -- Match Personal Commitment: PCOM-XXXX
    IF target_ref ~* '^PCOM-' THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_rec
      FROM public.income
      WHERE reference_id = target_ref OR commitment_id = target_ref;

      SELECT promised, status INTO target_promised, target_status
      FROM public.personal_commitments
      WHERE id = target_ref;

      IF FOUND AND target_status <> 'Cancelled' THEN
        UPDATE public.personal_commitments
        SET
          received = total_rec,
          status = CASE
            WHEN total_rec >= promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END
        WHERE id = target_ref;
      END IF;

    -- Match Finance Call: FC-XXXX
    ELSIF target_ref ~* '^FC-' THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_rec
      FROM public.income
      WHERE reference_id = target_ref OR commitment_id = target_ref;

      SELECT promised, status INTO target_promised, target_status
      FROM public.finance_calls
      WHERE id = target_ref;

      IF FOUND AND target_status <> 'Cancelled' THEN
        UPDATE public.finance_calls
        SET
          received = total_rec,
          status = CASE
            WHEN total_rec >= promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END
        WHERE id = target_ref;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 5. Attach Triggers to Tables
DROP TRIGGER IF EXISTS trg_sync_personal_commitment_to_income ON public.personal_commitments;
CREATE TRIGGER trg_sync_personal_commitment_to_income
AFTER INSERT OR UPDATE OF received, person_name, mobile_number, status
ON public.personal_commitments
FOR EACH ROW
EXECUTE FUNCTION public.sync_personal_commitment_to_income();

DROP TRIGGER IF EXISTS trg_sync_finance_call_to_income ON public.finance_calls;
CREATE TRIGGER trg_sync_finance_call_to_income
AFTER INSERT OR UPDATE OF received, person_name, mobile_number, status
ON public.finance_calls
FOR EACH ROW
EXECUTE FUNCTION public.sync_finance_call_to_income();

DROP TRIGGER IF EXISTS trg_sync_income_to_commitments ON public.income;
CREATE TRIGGER trg_sync_income_to_commitments
AFTER INSERT OR UPDATE OR DELETE
ON public.income
FOR EACH ROW
EXECUTE FUNCTION public.sync_income_to_commitments();

-- 6. One-time Reconciliation: Backfill missing income rows for existing received amounts
DO $$
DECLARE
  rec RECORD;
  existing_total NUMERIC;
  diff NUMERIC;
  next_id TEXT;
BEGIN
  -- Reconcile Personal Commitments
  FOR rec IN SELECT * FROM public.personal_commitments WHERE received > 0 AND status <> 'Cancelled' LOOP
    SELECT COALESCE(SUM(amount), 0) INTO existing_total
    FROM public.income
    WHERE reference_id = rec.id OR commitment_id = rec.id;

    IF rec.received > existing_total THEN
      diff := rec.received - existing_total;
      next_id := public.generate_next_income_id();

      INSERT INTO public.income (
        id, date, type, contributor, mobile_number, description, amount, money_type, notes, reference_id, commitment_id
      ) VALUES (
        next_id, CURRENT_DATE, 'Personal Commitment', rec.person_name, rec.mobile_number,
        'Payment against ' || rec.id, diff, 'UPI', 'Reconciliation entry for ' || rec.id, rec.id, rec.id
      );
    END IF;
  END LOOP;

  -- Reconcile Finance Calls
  FOR rec IN SELECT * FROM public.finance_calls WHERE received > 0 AND status <> 'Cancelled' LOOP
    SELECT COALESCE(SUM(amount), 0) INTO existing_total
    FROM public.income
    WHERE reference_id = rec.id OR commitment_id = rec.id;

    IF rec.received > existing_total THEN
      diff := rec.received - existing_total;
      next_id := public.generate_next_income_id();

      INSERT INTO public.income (
        id, date, type, contributor, mobile_number, description, amount, money_type, notes, reference_id, commitment_id
      ) VALUES (
        next_id, CURRENT_DATE, 'Finance Call', rec.person_name, rec.mobile_number,
        'Payment against ' || rec.id, diff, 'UPI', 'Reconciliation entry for ' || rec.id, rec.id, rec.id
      );
    END IF;
  END LOOP;
END;
$$;
