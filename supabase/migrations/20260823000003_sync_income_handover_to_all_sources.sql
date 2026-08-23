-- ============================================================
-- Orah - Campus Meet 2026: Financial Management
-- Migration: 20260823000003_sync_income_handover_to_all_sources.sql
-- Description:
--   1. Implements bi-directional synchronization from `public.income`
--      back to all source tables whenever `is_handed_over`, `money_type`,
--      `amount`, `date`, or `contributor` are updated in `public.income`:
--      - `public.church_donations` (Church & Convent Donations)
--      - `public.coupons` (Coupon Booklets)
--      - `public.personal_commitments` (Personal Commitments)
--      - `public.finance_calls` (Finance Calls)
--   2. Ensures trigger depth safety (prevents recursion loops).
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
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

  -- 1. Handling Updates from Income
  IF TG_OP = 'UPDATE' THEN
    -- Match Church Donations: CHU-XXXX or CDON-XXXX or Type = 'Church'
    IF target_id ~* '^(CHU|CDON)-' OR NEW.type = 'Church' THEN
      UPDATE public.church_donations
      SET
        is_handed_over = CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE NEW.is_handed_over END,
        money_type = NEW.money_type,
        amount = NEW.amount,
        date = NEW.date,
        church_name = NEW.contributor,
        contact_number = NEW.mobile_number
      WHERE id = target_id;

    -- Match Coupons: CPN-XXXX or COUP-XXXX or Type = 'Coupon'
    ELSIF target_id ~* '^(CPN|COUP)-' OR NEW.type = 'Coupon' THEN
      UPDATE public.coupons
      SET
        is_handed_over = CASE WHEN NEW.money_type = 'UPI' THEN TRUE ELSE NEW.is_handed_over END,
        money_type = NEW.money_type,
        amount = NEW.amount,
        date = NEW.date,
        contributor_name = NEW.contributor,
        mobile_number = NEW.mobile_number
      WHERE id = target_id;

    -- Match Personal Commitments: PCOM-XXXX or Type = 'Personal Commitment'
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
            WHEN total_rec >= promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END
        WHERE id = target_id;
      END IF;

    -- Match Finance Calls: FC-XXXX or Type = 'Finance Call'
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
            WHEN total_rec >= promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END
        WHERE id = target_id;
      END IF;
    END IF;

    RETURN NEW;

  -- 2. Handling Deletions from Income
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
            WHEN total_rec >= promised THEN 'Fully Received'
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
            WHEN total_rec >= promised THEN 'Fully Received'
            WHEN total_rec > 0 THEN 'Partially Received'
            ELSE 'Pending'
          END
        WHERE id = target_id;
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Replace old commitment-only trigger with unified trigger
DROP TRIGGER IF EXISTS trg_sync_income_to_commitments ON public.income;
DROP TRIGGER IF EXISTS trg_sync_income_to_sources ON public.income;

CREATE TRIGGER trg_sync_income_to_sources
AFTER UPDATE OR DELETE
ON public.income
FOR EACH ROW
EXECUTE FUNCTION public.sync_income_to_sources();
