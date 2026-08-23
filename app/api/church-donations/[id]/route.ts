import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ChurchDonationRecord, MoneyType } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/church-donations/[id] - Fetch single church donation
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('church_donations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Donation record not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: data as ChurchDonationRecord });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH /api/church-donations/[id] - Update church donation record
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates: Partial<ChurchDonationRecord> = {};

    if (body.church_name !== undefined) updates.church_name = body.church_name.trim();
    if (body.contact_number !== undefined) updates.contact_number = body.contact_number ? body.contact_number.trim() : null;
    if (body.date !== undefined) updates.date = body.date.trim();
    if (body.money_type !== undefined) updates.money_type = body.money_type as MoneyType;
    if (body.amount !== undefined) updates.amount = Number(body.amount);
    if (body.collected_by !== undefined) updates.collected_by = body.collected_by ? body.collected_by.trim() : null;
    if (body.notes !== undefined) updates.notes = body.notes ? body.notes.trim() : null;
    if (body.screenshot_link !== undefined) updates.screenshot_link = body.screenshot_link ? body.screenshot_link.trim() : null;

    if (updates.amount !== undefined && (isNaN(updates.amount) || updates.amount <= 0)) {
      return NextResponse.json({ success: false, error: 'Amount must be greater than 0.' }, { status: 400 });
    }

    const { data: updatedDonation, error } = await supabase
      .from('church_donations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Also update corresponding income record if fallback is needed
    const { data: currentDonation } = await supabase
      .from('church_donations')
      .select('*')
      .eq('id', id)
      .single();

    if (currentDonation) {
      const combinedNotes = [currentDonation.notes, currentDonation.collected_by ? `Volunteer: ${currentDonation.collected_by}` : null]
        .filter(Boolean)
        .join(' | ');

      await supabase
        .from('income')
        .update({
          date: currentDonation.date,
          contributor: currentDonation.church_name,
          mobile_number: currentDonation.contact_number || null,
          description: 'Church & Convent Donation',
          amount: currentDonation.amount,
          money_type: currentDonation.money_type,
          screenshot_link: currentDonation.screenshot_link || null,
          notes: combinedNotes || null,
        })
        .or(`reference_id.eq.${id},commitment_id.eq.${id}`);
    }

    return NextResponse.json({
      success: true,
      data: updatedDonation,
      message: 'Church & Convent donation updated successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/church-donations/[id] - Delete church donation record
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Delete associated income record
    await supabase
      .from('income')
      .delete()
      .or(`reference_id.eq.${id},commitment_id.eq.${id}`);

    const { error } = await supabase
      .from('church_donations')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Church & Convent donation and associated income deleted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
