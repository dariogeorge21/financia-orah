import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ReimbursementStatus, MoneyType } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/reimbursements/[id] - Update an existing reimbursement record
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const reimbursementId = id.trim();

    if (!reimbursementId) {
      return NextResponse.json({ success: false, error: 'Reimbursement ID is required.' }, { status: 400 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.date === 'string' && body.date.trim()) {
      updatePayload.date = body.date.trim();
    }

    if (typeof body.person === 'string') {
      const person = body.person.trim();
      if (!person) {
        return NextResponse.json({ success: false, error: 'Person name cannot be empty.' }, { status: 400 });
      }
      updatePayload.person = person;
    }

    if (body.mobile_number !== undefined) {
      updatePayload.mobile_number =
        typeof body.mobile_number === 'string' && body.mobile_number.trim().length > 0
          ? body.mobile_number.trim()
          : null;
    }

    if (typeof body.expense_id === 'string') {
      const expId = body.expense_id.trim();
      if (!expId) {
        return NextResponse.json({ success: false, error: 'Expense ID cannot be empty.' }, { status: 400 });
      }
      updatePayload.expense_id = expId;
    }

    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ success: false, error: 'Amount must be greater than 0.' }, { status: 400 });
      }
      updatePayload.amount = amount;
    }

    if (body.status !== undefined) {
      if (!['Pending', 'Paid'].includes(body.status)) {
        return NextResponse.json({ success: false, error: 'Status must be Pending or Paid.' }, { status: 400 });
      }
      updatePayload.status = body.status as ReimbursementStatus;
    }

    if (body.money_type_paid !== undefined) {
      if (body.money_type_paid && !['Cash', 'UPI'].includes(body.money_type_paid)) {
        return NextResponse.json({ success: false, error: 'Payment mode must be Cash or UPI.' }, { status: 400 });
      }
      updatePayload.money_type_paid = body.money_type_paid ? (body.money_type_paid as MoneyType) : null;
    }

    if (body.notes !== undefined) {
      updatePayload.notes =
        typeof body.notes === 'string' && body.notes.trim().length > 0
          ? body.notes.trim()
          : null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields provided for update.' }, { status: 400 });
    }

    const { data: updatedReimbursement, error: updateError } = await supabase
      .from('reimbursements')
      .update(updatePayload)
      .eq('id', reimbursementId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updatedReimbursement) {
      return NextResponse.json({ success: false, error: 'Reimbursement record not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updatedReimbursement,
      message: 'Reimbursement updated successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/reimbursements/[id] - Delete a reimbursement record
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const reimbursementId = id.trim();

    if (!reimbursementId) {
      return NextResponse.json({ success: false, error: 'Reimbursement ID is required.' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('reimbursements')
      .delete()
      .eq('id', reimbursementId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Reimbursement record deleted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
