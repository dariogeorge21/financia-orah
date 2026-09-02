-- ============================================================
-- Migration: 20260902000000_fee_collection_view_and_rpc.sql
-- Description: Provides helper functions and views for reading checked-in fee collections and dues.
-- Manual Push: Apply via Supabase Dashboard > SQL Editor or Supabase CLI if needed.
-- ============================================================

-- 1. Ensure checkin_details view is up to date and exposes all necessary fee fields
DROP VIEW IF EXISTS public.checkin_details;
CREATE OR REPLACE VIEW public.checkin_details AS
SELECT
  c.id,
  c.event_id,
  c.registration_id,
  c.volunteer_registration_id,
  c.registration_option,
  c.payment_status,
  c.payment_method,
  c.amount_paid,
  c.amount_due,
  c.payment_note,
  c.checked_in_at,
  c.checked_in_by,
  c.created_at,
  c.updated_at,
  -- Participant fields
  r.name AS participant_name,
  r.phone AS participant_phone,
  r.email AS participant_email,
  r.parish AS participant_parish,
  r.diocese AS participant_diocese,
  r.registration_type AS participant_registration_type,
  r.college AS participant_college,
  r.affiliation AS participant_affiliation,
  -- Volunteer fields
  vr.name AS volunteer_name,
  vr.phone AS volunteer_phone,
  vr.ministry AS volunteer_ministry,
  vr.role AS volunteer_role,
  vr.registration_type AS volunteer_registration_type,
  -- Unified helpers
  COALESCE(r.name, vr.name, 'Unknown') AS display_name,
  COALESCE(r.phone, vr.phone, '') AS display_phone,
  CASE
    WHEN c.volunteer_registration_id IS NOT NULL THEN 'volunteer'
    ELSE 'participant'
  END AS person_type
FROM public.checkins c
LEFT JOIN public.registrations r ON r.id = c.registration_id
LEFT JOIN public.volunteer_registrations vr ON vr.id = c.volunteer_registration_id
WHERE c.id IS NOT NULL;

-- 2. Secure RPC function: get_fee_collections
-- Returns all checked-in fee records with joined participant/volunteer details
CREATE OR REPLACE FUNCTION public.get_fee_collections()
RETURNS TABLE (
  id UUID,
  event_id UUID,
  registration_id UUID,
  volunteer_registration_id UUID,
  registration_option TEXT,
  payment_status TEXT,
  payment_method TEXT,
  amount_paid NUMERIC,
  amount_due NUMERIC,
  payment_note TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  participant_name TEXT,
  participant_phone TEXT,
  participant_email TEXT,
  participant_parish TEXT,
  participant_diocese TEXT,
  participant_registration_type TEXT,
  participant_college TEXT,
  participant_affiliation TEXT,
  volunteer_name TEXT,
  volunteer_phone TEXT,
  volunteer_ministry TEXT,
  volunteer_role TEXT,
  volunteer_registration_type TEXT,
  display_name TEXT,
  display_phone TEXT,
  person_type TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    c.id,
    c.event_id,
    c.registration_id,
    c.volunteer_registration_id,
    c.registration_option::TEXT,
    c.payment_status::TEXT,
    c.payment_method::TEXT,
    COALESCE(c.amount_paid, 0)::NUMERIC,
    COALESCE(c.amount_due, 0)::NUMERIC,
    c.payment_note,
    c.checked_in_at,
    c.created_at,
    r.name AS participant_name,
    r.phone AS participant_phone,
    r.email AS participant_email,
    r.parish AS participant_parish,
    r.diocese AS participant_diocese,
    r.registration_type::TEXT AS participant_registration_type,
    r.college AS participant_college,
    r.affiliation AS participant_affiliation,
    vr.name AS volunteer_name,
    vr.phone AS volunteer_phone,
    vr.ministry AS volunteer_ministry,
    vr.role AS volunteer_role,
    vr.registration_type::TEXT AS volunteer_registration_type,
    COALESCE(r.name, vr.name, 'Unknown') AS display_name,
    COALESCE(r.phone, vr.phone, '') AS display_phone,
    CASE
      WHEN c.volunteer_registration_id IS NOT NULL THEN 'volunteer'
      ELSE 'participant'
    END AS person_type
  FROM public.checkins c
  LEFT JOIN public.registrations r ON r.id = c.registration_id
  LEFT JOIN public.volunteer_registrations vr ON vr.id = c.volunteer_registration_id
  WHERE c.id IS NOT NULL
  ORDER BY c.checked_in_at DESC NULLS LAST, c.created_at DESC;
$$;

-- 3. Secure RPC function: get_fee_summary
-- Computes aggregated KPIs directly inside Postgres
CREATE OR REPLACE FUNCTION public.get_fee_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalCollected', COALESCE(SUM(c.amount_paid), 0),
    'cashCollected', COALESCE(SUM(CASE WHEN c.payment_method::TEXT = 'CASH' THEN c.amount_paid ELSE 0 END), 0),
    'cashCount', COALESCE(COUNT(CASE WHEN c.payment_method::TEXT = 'CASH' THEN 1 END), 0),
    'upiCollected', COALESCE(SUM(CASE WHEN c.payment_method::TEXT = 'UPI' THEN c.amount_paid ELSE 0 END), 0),
    'upiCount', COALESCE(COUNT(CASE WHEN c.payment_method::TEXT = 'UPI' THEN 1 END), 0),
    'totalDue', COALESCE(SUM(c.amount_due), 0),
    'totalExpected', COALESCE(SUM(COALESCE(c.amount_paid, 0) + COALESCE(c.amount_due, 0)), 0),
    'checkedInCount', COUNT(c.id),
    'fullyPaidCount', COALESCE(COUNT(CASE WHEN c.payment_status::TEXT IN ('paid', 'fully_paid') THEN 1 END), 0),
    'fullyPaidAmount', COALESCE(SUM(CASE WHEN c.payment_status::TEXT IN ('paid', 'fully_paid') THEN c.amount_paid ELSE 0 END), 0),
    'partiallyPaidCount', COALESCE(COUNT(CASE WHEN c.payment_status::TEXT IN ('partially_paid', 'half_paid') THEN 1 END), 0),
    'partiallyPaidAmount', COALESCE(SUM(CASE WHEN c.payment_status::TEXT IN ('partially_paid', 'half_paid') THEN c.amount_paid ELSE 0 END), 0),
    'partiallyPaidDue', COALESCE(SUM(CASE WHEN c.payment_status::TEXT IN ('partially_paid', 'half_paid') THEN c.amount_due ELSE 0 END), 0),
    'laterPayCount', COALESCE(COUNT(CASE WHEN c.payment_status::TEXT IN ('later_pay', 'pay_later') THEN 1 END), 0),
    'laterPayDue', COALESCE(SUM(CASE WHEN c.payment_status::TEXT IN ('later_pay', 'pay_later') THEN c.amount_due ELSE 0 END), 0),
    'notPaidCount', COALESCE(COUNT(CASE WHEN c.payment_status::TEXT IN ('not_paid', 'no_pay') THEN 1 END), 0),
    'notPaidDue', COALESCE(SUM(CASE WHEN c.payment_status::TEXT IN ('not_paid', 'no_pay') THEN c.amount_due ELSE 0 END), 0)
  ) INTO result
  FROM public.checkins c;

  RETURN result;
END;
$$;

-- Grant SELECT / EXECUTE permissions
GRANT SELECT ON public.checkin_details TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_fee_collections() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_fee_summary() TO authenticated, service_role, anon;
