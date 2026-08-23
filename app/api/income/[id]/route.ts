import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { IncomeType, MoneyType } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/income/[id] - Update an existing income record
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const incomeId = id.trim();

    if (!incomeId) {
      return NextResponse.json({ success: false, error: 'Income ID is required.' }, { status: 400 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.date === 'string' && body.date.trim()) {
      updatePayload.date = body.date.trim();
    }

    if (body.type !== undefined) {
      updatePayload.type = body.type as IncomeType;
    }

    if (typeof body.contributor === 'string') {
      const contributor = body.contributor.trim();
      if (!contributor) {
        return NextResponse.json({ success: false, error: 'Contributor name cannot be empty.' }, { status: 400 });
      }
      updatePayload.contributor = contributor;
    }

    if (body.mobile_number !== undefined) {
      updatePayload.mobile_number =
        typeof body.mobile_number === 'string' && body.mobile_number.trim().length > 0
          ? body.mobile_number.trim()
          : null;
    }

    if (typeof body.description === 'string') {
      const description = body.description.trim();
      if (!description) {
        return NextResponse.json({ success: false, error: 'Description cannot be empty.' }, { status: 400 });
      }
      updatePayload.description = description;
    }

    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ success: false, error: 'Amount must be greater than 0.' }, { status: 400 });
      }
      updatePayload.amount = amount;
    }

    if (body.money_type !== undefined) {
      if (!['Cash', 'UPI'].includes(body.money_type)) {
        return NextResponse.json({ success: false, error: 'Money type must be Cash or UPI.' }, { status: 400 });
      }
      updatePayload.money_type = body.money_type as MoneyType;
    }

    if (body.notes !== undefined) {
      updatePayload.notes =
        typeof body.notes === 'string' && body.notes.trim().length > 0
          ? body.notes.trim()
          : null;
    }

    if (body.is_handed_over !== undefined) {
      updatePayload.is_handed_over = Boolean(body.is_handed_over);
    }

    if (body.screenshot_link !== undefined) {
      updatePayload.screenshot_link =
        typeof body.screenshot_link === 'string' && body.screenshot_link.trim().length > 0
          ? body.screenshot_link.trim()
          : null;
    }

    if (body.reference_id !== undefined) {
      const ref =
        typeof body.reference_id === 'string' && body.reference_id.trim().length > 0
          ? body.reference_id.trim()
          : null;
      updatePayload.reference_id = ref;
      updatePayload.commitment_id = ref;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields provided for update.' }, { status: 400 });
    }

    const { data: updatedIncome, error: updateError } = await supabase
      .from('income')
      .update(updatePayload)
      .eq('id', incomeId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updatedIncome) {
      return NextResponse.json({ success: false, error: 'Income record not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updatedIncome,
      message: 'Income record updated successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/income/[id] - Delete an income record
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const incomeId = id.trim();

    if (!incomeId) {
      return NextResponse.json({ success: false, error: 'Income ID is required.' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('income')
      .delete()
      .eq('id', incomeId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Income record deleted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
