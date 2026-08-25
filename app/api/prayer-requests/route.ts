import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PrayerRequestRecord, PrayerStatus } from '@/lib/types';
import { groupPrayerRequestsByDate, extractDateKey, getTodayDateString } from '@/lib/calculations';

// GET /api/prayer-requests - Fetch all prayer requests (from prayer_requests table + income sources)
export async function GET() {
  try {
    const supabase = await createClient();

    // 1. Fetch from dedicated prayer_requests table
    const { data: directData, error: directError } = await supabase
      .from('prayer_requests')
      .select('*')
      .order('date', { ascending: false });

    if (directError && directError.code !== '42P01') {
      // 42P01 is table not existing yet (before migration applied)
      console.warn('prayer_requests table error:', directError.message);
    }

    const directRequests: PrayerRequestRecord[] = (directData ?? []).map((r) => ({
      ...r,
      date: extractDateKey(r.date || r.created_at),
      isDirect: true,
    }));

    // 2. Fetch from income records that have prayer_request
    const { data: incomeData } = await supabase
      .from('income')
      .select('*')
      .not('prayer_request', 'is', null)
      .neq('prayer_request', '');

    const incomeRequests: PrayerRequestRecord[] = (incomeData ?? []).map((inc) => ({
      id: `INC-PR-${inc.id}`,
      person_name: inc.contributor,
      mobile_number: inc.mobile_number || null,
      prayer_request: inc.prayer_request || '',
      date: extractDateKey(inc.date || inc.created_at),
      status: 'Active' as PrayerStatus,
      source: `Income (${inc.type})`,
      reference_id: inc.id,
      notes: inc.notes || null,
      amount: Number(inc.amount),
      created_at: inc.created_at,
      isDirect: false,
    }));

    // 3. Fetch from personal commitments that have prayer_request
    const { data: pcomData } = await supabase
      .from('personal_commitments')
      .select('*')
      .not('prayer_request', 'is', null)
      .neq('prayer_request', '');

    const pcomRequests: PrayerRequestRecord[] = (pcomData ?? []).map((c) => ({
      id: `PCOM-PR-${c.id}`,
      person_name: c.person_name,
      mobile_number: c.mobile_number || null,
      prayer_request: c.prayer_request || '',
      date: extractDateKey(c.date || c.created_at),
      status: 'Active' as PrayerStatus,
      source: 'Personal Commitment',
      reference_id: c.id,
      notes: c.notes || null,
      amount: Number(c.promised),
      created_at: c.created_at,
      isDirect: false,
    }));

    // 4. Fetch from finance calls that have prayer_request
    const { data: fcData } = await supabase
      .from('finance_calls')
      .select('*')
      .not('prayer_request', 'is', null)
      .neq('prayer_request', '');

    const fcRequests: PrayerRequestRecord[] = (fcData ?? []).map((c) => ({
      id: `FC-PR-${c.id}`,
      person_name: c.person_name,
      mobile_number: c.mobile_number || null,
      prayer_request: c.prayer_request || '',
      date: extractDateKey(c.date || c.created_at),
      status: 'Active' as PrayerStatus,
      source: 'Finance Call',
      reference_id: c.id,
      notes: c.notes || null,
      amount: Number(c.promised),
      created_at: c.created_at,
      isDirect: false,
    }));

    // 5. Fetch from coupons that have prayer_request
    const { data: couponData } = await supabase
      .from('coupons')
      .select('*')
      .not('prayer_request', 'is', null)
      .neq('prayer_request', '');

    const couponRequests: PrayerRequestRecord[] = (couponData ?? []).map((c) => ({
      id: `CPN-PR-${c.id}`,
      person_name: c.contributor_name,
      mobile_number: c.mobile_number || null,
      prayer_request: c.prayer_request || '',
      date: extractDateKey(c.date || c.created_at),
      status: 'Active' as PrayerStatus,
      source: c.booklet_number ? `Coupon (#${c.booklet_number})` : 'Coupon',
      reference_id: c.id,
      notes: [c.notes, c.collected_by ? `Volunteer: ${c.collected_by}` : null].filter(Boolean).join(' | ') || null,
      amount: Number(c.amount),
      created_at: c.created_at,
      isDirect: false,
    }));

    // 6. Fetch from church and convent donations that have prayer_request
    const { data: churchData } = await supabase
      .from('church_donations')
      .select('*')
      .not('prayer_request', 'is', null)
      .neq('prayer_request', '');

    const churchRequests: PrayerRequestRecord[] = (churchData ?? []).map((c) => ({
      id: `CHU-PR-${c.id}`,
      person_name: c.church_name,
      mobile_number: c.contact_number || null,
      prayer_request: c.prayer_request || '',
      date: extractDateKey(c.date || c.created_at),
      status: 'Active' as PrayerStatus,
      source: 'Church & Convent',
      reference_id: c.id,
      notes: [c.notes, c.collected_by ? `Volunteer: ${c.collected_by}` : null].filter(Boolean).join(' | ') || null,
      amount: Number(c.amount),
      created_at: c.created_at,
      isDirect: false,
    }));

    // Combine all and remove duplicate reference IDs
    const seenRefs = new Set<string>();
    const allRequests: PrayerRequestRecord[] = [];

    // Direct prayer requests
    for (const req of directRequests) {
      allRequests.push(req);
      if (req.reference_id) seenRefs.add(req.reference_id);
    }

    // Specific module sources (Commitments, Calls, Coupons, Church)
    for (const req of [...pcomRequests, ...fcRequests, ...couponRequests, ...churchRequests]) {
      const refKey = req.reference_id || req.id;
      if (seenRefs.has(refKey)) continue;
      seenRefs.add(refKey);
      allRequests.push(req);
    }

    // General income sources (ignore if already added via specific source reference)
    for (const req of incomeRequests) {
      if (req.reference_id && seenRefs.has(req.reference_id)) continue;
      if (seenRefs.has(req.id)) continue;
      allRequests.push(req);
      if (req.reference_id) seenRefs.add(req.reference_id);
    }

    // Sort by date descending
    allRequests.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const { groups, summary } = groupPrayerRequestsByDate(allRequests);

    return NextResponse.json({
      success: true,
      data: {
        requests: allRequests,
        groups,
        summary,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/prayer-requests - Create a new dedicated prayer request
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const personName = typeof body.person_name === 'string' ? body.person_name.trim() : '';
    const mobileNumber = typeof body.mobile_number === 'string' ? body.mobile_number.trim() : null;
    const prayerRequest = typeof body.prayer_request === 'string' ? body.prayer_request.trim() : '';
    const date = typeof body.date === 'string' && body.date.trim() ? extractDateKey(body.date) : getTodayDateString();
    const status = (body.status as PrayerStatus) || 'Active';
    const source = typeof body.source === 'string' ? body.source.trim() : 'Direct';
    const referenceId = typeof body.reference_id === 'string' ? body.reference_id.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;

    if (!personName) {
      return NextResponse.json({ success: false, error: 'Person name is required.' }, { status: 400 });
    }

    if (!prayerRequest) {
      return NextResponse.json({ success: false, error: 'Prayer request / intention is required.' }, { status: 400 });
    }

    // Generate sequential PR-XXXX ID
    const { data: allIds } = await supabase.from('prayer_requests').select('id');
    let maxNum = 0;
    if (allIds) {
      for (const item of allIds) {
        const match = item.id?.match(/^PR-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }
    const nextId = `PR-${String(maxNum + 1).padStart(4, '0')}`;

    const { data: newRecord, error: insertError } = await supabase
      .from('prayer_requests')
      .insert({
        id: nextId,
        person_name: personName,
        mobile_number: mobileNumber || null,
        prayer_request: prayerRequest,
        date,
        status,
        source,
        reference_id: referenceId || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        data: newRecord,
        message: 'Prayer request created successfully.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
