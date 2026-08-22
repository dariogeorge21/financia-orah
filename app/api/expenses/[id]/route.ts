import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ExpenseStatus, PaymentSource, MoneyType } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/expenses/[id] - Update an existing expense record
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const expenseId = id.trim();

    if (!expenseId) {
      return NextResponse.json({ success: false, error: 'Expense ID is required.' }, { status: 400 });
    }

    const body = await request.json();
    const updatePayload: Record<string, unknown> = {};

    if (typeof body.category === 'string') {
      const category = body.category.trim();
      if (!category) {
        return NextResponse.json({ success: false, error: 'Category cannot be empty.' }, { status: 400 });
      }
      updatePayload.category = category;
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

    if (typeof body.paid_by === 'string') {
      const paidBy = body.paid_by.trim();
      if (!paidBy) {
        return NextResponse.json({ success: false, error: 'Paid by cannot be empty.' }, { status: 400 });
      }
      updatePayload.paid_by = paidBy;
    }

    if (body.mobile_number !== undefined) {
      updatePayload.mobile_number =
        typeof body.mobile_number === 'string' && body.mobile_number.trim().length > 0
          ? body.mobile_number.trim()
          : null;
    }

    if (body.payment_source !== undefined) {
      if (!['Personal', 'Event', 'Personal Money', 'Event Money'].includes(body.payment_source)) {
        return NextResponse.json({ success: false, error: 'Invalid payment source.' }, { status: 400 });
      }
      updatePayload.payment_source = body.payment_source as PaymentSource;
    }

    if (body.status !== undefined) {
      if (!['Pending', 'Approved', 'Rejected'].includes(body.status)) {
        return NextResponse.json({ success: false, error: 'Invalid expense status.' }, { status: 400 });
      }
      updatePayload.status = body.status as ExpenseStatus;
    }

    if (body.has_receipt !== undefined) {
      updatePayload.has_receipt = Boolean(body.has_receipt);
    }

    if (body.receipt_link !== undefined) {
      updatePayload.receipt_link =
        typeof body.receipt_link === 'string' && body.receipt_link.trim().length > 0
          ? body.receipt_link.trim()
          : null;
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

    const { data: updatedExpense, error: updateError } = await supabase
      .from('expenses')
      .update(updatePayload)
      .eq('id', expenseId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    if (!updatedExpense) {
      return NextResponse.json({ success: false, error: 'Expense record not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updatedExpense,
      message: 'Expense updated successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/expenses/[id] - Delete an expense record
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const expenseId = id.trim();

    if (!expenseId) {
      return NextResponse.json({ success: false, error: 'Expense ID is required.' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (deleteError) {
      return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Expense deleted successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
