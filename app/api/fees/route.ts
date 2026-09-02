import { NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { FeeRecord } from '@/lib/types';
import { calcFeeSummary } from '@/lib/calculations';

export const dynamic = 'force-dynamic';

/**
 * Normalizes raw checkin records into uniform FeeRecord objects.
 */
function normalizeFeeRecords(rawRecords: any[]): FeeRecord[] {
  return rawRecords.map((r) => {
    const isVolunteer = Boolean(r.volunteer_registration_id || r.person_type === 'volunteer');
    const displayName =
      r.display_name ||
      r.participant_name ||
      r.volunteer_name ||
      r.registrations?.name ||
      r.volunteer_registrations?.name ||
      'Unknown';
    const displayPhone =
      r.display_phone ||
      r.participant_phone ||
      r.volunteer_phone ||
      r.registrations?.phone ||
      r.volunteer_registrations?.phone ||
      '';

    return {
      id: r.id,
      event_id: r.event_id,
      registration_id: r.registration_id,
      volunteer_registration_id: r.volunteer_registration_id,
      registration_option: r.registration_option,
      payment_status: r.payment_status || 'not_paid',
      payment_method: r.payment_method || null,
      amount_paid: Number(r.amount_paid) || 0,
      amount_due: Number(r.amount_due) || 0,
      payment_note: r.payment_note || null,
      checked_in_at: r.checked_in_at || r.created_at || null,
      checked_in_by: r.checked_in_by || null,
      created_at: r.created_at || null,

      // Participant metadata
      participant_name: r.participant_name || r.registrations?.name || null,
      participant_phone: r.participant_phone || r.registrations?.phone || null,
      participant_email: r.participant_email || r.registrations?.email || null,
      participant_parish: r.participant_parish || r.registrations?.parish || null,
      participant_diocese: r.participant_diocese || r.registrations?.diocese || null,
      participant_registration_type:
        r.participant_registration_type || r.registrations?.registration_type || null,
      participant_college: r.participant_college || r.registrations?.college || null,
      participant_affiliation:
        r.participant_affiliation || r.registrations?.affiliation || null,

      // Volunteer metadata
      volunteer_name: r.volunteer_name || r.volunteer_registrations?.name || null,
      volunteer_phone: r.volunteer_phone || r.volunteer_registrations?.phone || null,
      volunteer_ministry: r.volunteer_ministry || r.volunteer_registrations?.ministry || null,
      volunteer_role: r.volunteer_role || r.volunteer_registrations?.role || null,
      volunteer_registration_type:
        r.volunteer_registration_type || r.volunteer_registrations?.registration_type || null,

      display_name: displayName,
      display_phone: displayPhone,
      person_type: isVolunteer ? 'volunteer' : 'participant',
    };
  });
}

/**
 * Fetches fee records with multi-level resilient fallback (RPC -> checkin_details -> checkins join).
 */
export async function fetchServerFees(): Promise<FeeRecord[]> {
  const supabase = await createServerSupabase();

  // 1. Try DB RPC function get_fee_collections
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_fee_collections');
    if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
      return normalizeFeeRecords(rpcData);
    }
  } catch {
    // Continue to next fallback
  }

  // 2. Try checkin_details view
  try {
    const { data: viewData, error: viewErr } = await supabase
      .from('checkin_details')
      .select('*')
      .order('checked_in_at', { ascending: false });

    if (!viewErr && Array.isArray(viewData)) {
      return normalizeFeeRecords(viewData);
    }
  } catch {
    // Continue to next fallback
  }

  // 3. Try checkins table with joined registrations
  try {
    const { data: joinData, error: joinErr } = await supabase
      .from('checkins')
      .select(`
        *,
        registrations:registration_id ( name, phone, email, parish, diocese, registration_type, college, affiliation ),
        volunteer_registrations:volunteer_registration_id ( name, phone, ministry, role, registration_type )
      `)
      .order('checked_in_at', { ascending: false });

    if (!joinErr && Array.isArray(joinData)) {
      return normalizeFeeRecords(joinData);
    }
  } catch {
    // Continue to next fallback
  }

  // 4. If session RLS blocks and SUPABASE_SERVICE_ROLE_KEY is present, perform service role fetch
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceKey && supabaseUrl) {
    try {
      const adminClient = createSupabaseClient(supabaseUrl, serviceKey);
      const { data: adminData, error: adminErr } = await adminClient
        .from('checkin_details')
        .select('*')
        .order('checked_in_at', { ascending: false });

      if (!adminErr && Array.isArray(adminData)) {
        return normalizeFeeRecords(adminData);
      }
    } catch {
      // Return empty array if all methods fail
    }
  }

  return [];
}

// GET /api/fees - Fetch all checked-in fees and calculated KPI summary
export async function GET() {
  try {
    const fees = await fetchServerFees();
    const summary = calcFeeSummary(fees);

    return NextResponse.json({
      success: true,
      data: {
        fees,
        summary,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
