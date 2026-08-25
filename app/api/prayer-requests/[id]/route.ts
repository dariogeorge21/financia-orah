import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PrayerStatus } from '@/lib/types';

// PATCH /api/prayer-requests/[id] - Update a prayer request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {};

    if (body.person_name !== undefined) updatePayload.person_name = body.person_name.trim();
    if (body.mobile_number !== undefined) updatePayload.mobile_number = body.mobile_number?.trim() || null;
    if (body.prayer_request !== undefined) updatePayload.prayer_request = body.prayer_request.trim();
    if (body.date !== undefined) updatePayload.date = body.date.trim();
    if (body.status !== undefined) updatePayload.status = body.status as PrayerStatus;
    if (body.notes !== undefined) updatePayload.notes = body.notes?.trim() || null;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update.' }, { status: 400 });
    }

    // If ID is a direct PR-XXXX
    if (id.startsWith('PR-')) {
      const { data, error } = await supabase
        .from('prayer_requests')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data,
        message: 'Prayer request updated successfully.',
      });
    }

    // If ID is from an income table (e.g. INC-PR-INC-0001 or PCOM-PR-PCOM-0001)
    if (id.startsWith('INC-PR-')) {
      const realId = id.replace('INC-PR-', '');
      const incomeUpdate: Record<string, unknown> = {};
      if (body.prayer_request !== undefined) incomeUpdate.prayer_request = body.prayer_request.trim();
      if (body.notes !== undefined) incomeUpdate.notes = body.notes?.trim() || null;

      const { data, error } = await supabase
        .from('income')
        .update(incomeUpdate)
        .eq('id', realId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data,
        message: 'Income prayer request updated.',
      });
    }

    if (id.startsWith('PCOM-PR-')) {
      const realId = id.replace('PCOM-PR-', '');
      const pcomUpdate: Record<string, unknown> = {};
      if (body.prayer_request !== undefined) pcomUpdate.prayer_request = body.prayer_request.trim();
      if (body.notes !== undefined) pcomUpdate.notes = body.notes?.trim() || null;

      const { data, error } = await supabase
        .from('personal_commitments')
        .update(pcomUpdate)
        .eq('id', realId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data,
        message: 'Commitment prayer request updated.',
      });
    }

    if (id.startsWith('FC-PR-')) {
      const realId = id.replace('FC-PR-', '');
      const fcUpdate: Record<string, unknown> = {};
      if (body.prayer_request !== undefined) fcUpdate.prayer_request = body.prayer_request.trim();
      if (body.notes !== undefined) fcUpdate.notes = body.notes?.trim() || null;

      const { data, error } = await supabase
        .from('finance_calls')
        .update(fcUpdate)
        .eq('id', realId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data,
        message: 'Finance call prayer request updated.',
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown record type' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/prayer-requests/[id] - Delete a prayer request
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (id.startsWith('PR-')) {
      const { error } = await supabase.from('prayer_requests').delete().eq('id', id);
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'Prayer request deleted.' });
    }

    // For income-linked prayer requests, clear the prayer_request field
    if (id.startsWith('INC-PR-')) {
      const realId = id.replace('INC-PR-', '');
      await supabase.from('income').update({ prayer_request: null }).eq('id', realId);
      return NextResponse.json({ success: true, message: 'Prayer request cleared from income.' });
    }

    if (id.startsWith('PCOM-PR-')) {
      const realId = id.replace('PCOM-PR-', '');
      await supabase.from('personal_commitments').update({ prayer_request: null }).eq('id', realId);
      return NextResponse.json({ success: true, message: 'Prayer request cleared from commitment.' });
    }

    if (id.startsWith('FC-PR-')) {
      const realId = id.replace('FC-PR-', '');
      await supabase.from('finance_calls').update({ prayer_request: null }).eq('id', realId);
      return NextResponse.json({ success: true, message: 'Prayer request cleared from finance call.' });
    }

    return NextResponse.json({ success: true, message: 'Deleted.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
