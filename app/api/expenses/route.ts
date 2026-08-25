import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ExpenseRecord, ExpenseStatus, PaymentSource, MoneyType } from '@/lib/types';
import { isEventExpense } from '@/lib/calculations';

// GET /api/expenses - Fetch all expense records and computed summary statistics
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const expenses = (data ?? []) as ExpenseRecord[];

    const totalApproved = expenses
      .filter((e) => e.status === 'Approved')
      .reduce((s, e) => s + Number(e.amount), 0);

    const totalPending = expenses
      .filter((e) => e.status === 'Pending')
      .reduce((s, e) => s + Number(e.amount), 0);

    const totalRejected = expenses
      .filter((e) => e.status === 'Rejected')
      .reduce((s, e) => s + Number(e.amount), 0);

    const eventDirectApproved = expenses
      .filter((e) => isEventExpense(e.payment_source) && e.status === 'Approved')
      .reduce((s, e) => s + Number(e.amount), 0);

    const personalApproved = expenses
      .filter((e) => !isEventExpense(e.payment_source) && e.status === 'Approved')
      .reduce((s, e) => s + Number(e.amount), 0);

    const activeAdvances = expenses.filter(
      (e) => e.settlement_status === 'Advance Given' && e.status !== 'Rejected'
    );
    const activeAdvancesCount = activeAdvances.length;
    const totalAdvancesPending = activeAdvances.reduce(
      (s, e) => s + Number(e.advance_amount ?? e.amount),
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        expenses,
        summary: {
          totalApproved,
          totalPending,
          totalRejected,
          eventDirectApproved,
          personalApproved,
          totalCount: expenses.length,
          approvedCount: expenses.filter((e) => e.status === 'Approved').length,
          pendingCount: expenses.filter((e) => e.status === 'Pending').length,
          rejectedCount: expenses.filter((e) => e.status === 'Rejected').length,
          activeAdvancesCount,
          totalAdvancesPending,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/expenses - Create a new expense record
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const amount = Number(body.amount);
    const moneyType = body.money_type as MoneyType;
    const paidBy = typeof body.paid_by === 'string' ? body.paid_by.trim() : '';
    const mobileNumber = typeof body.mobile_number === 'string' ? body.mobile_number.trim() : null;
    const paymentSource = (body.payment_source as PaymentSource) || 'Event';
    const status = (body.status as ExpenseStatus) || 'Approved';
    const hasReceipt = Boolean(body.has_receipt);
    const receiptLink = typeof body.receipt_link === 'string' ? body.receipt_link.trim() : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;

    // Advance & Settlement fields
    const advanceAmount = body.advance_amount !== undefined && body.advance_amount !== null
      ? Number(body.advance_amount)
      : null;
    const advanceMoneyType = body.advance_money_type && ['Cash', 'UPI'].includes(body.advance_money_type)
      ? (body.advance_money_type as MoneyType)
      : null;
    const settlementStatus = body.settlement_status && ['Direct', 'Advance Given', 'Settled'].includes(body.settlement_status)
      ? body.settlement_status
      : (advanceAmount !== null && advanceAmount > 0 ? 'Advance Given' : 'Direct');
    const balanceAmount = body.balance_amount !== undefined && body.balance_amount !== null
      ? Number(body.balance_amount)
      : 0;
    const balanceMoneyType = body.balance_money_type && ['Cash', 'UPI'].includes(body.balance_money_type)
      ? (body.balance_money_type as MoneyType)
      : null;
    const settledAt = body.settled_at || (settlementStatus === 'Settled' ? new Date().toISOString() : null);

    if (!category) {
      return NextResponse.json({ success: false, error: 'Category is required.' }, { status: 400 });
    }

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0.' },
        { status: 400 }
      );
    }

    if (!moneyType || !['Cash', 'UPI'].includes(moneyType)) {
      return NextResponse.json(
        { success: false, error: 'Valid money type (Cash or UPI) is required.' },
        { status: 400 }
      );
    }

    if (!paidBy) {
      return NextResponse.json(
        { success: false, error: 'Paid by name is required.' },
        { status: 400 }
      );
    }

    // Generate next sequential EXP-XXXX id
    const { data: allIds } = await supabase.from('expenses').select('id');

    let maxNum = 0;
    if (allIds) {
      for (const item of allIds) {
        const match = item.id.match(/^EXP-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextId = `EXP-${String(maxNum + 1).padStart(4, '0')}`;

    const insertPayload: Record<string, unknown> = {
      id: nextId,
      category,
      description,
      amount,
      money_type: moneyType,
      paid_by: paidBy,
      mobile_number: mobileNumber || null,
      payment_source: paymentSource,
      status,
      has_receipt: hasReceipt,
      receipt_link: receiptLink || null,
      notes: notes || null,
      advance_amount: advanceAmount,
      advance_money_type: advanceMoneyType,
      settlement_status: settlementStatus,
      balance_amount: balanceAmount,
      balance_money_type: balanceMoneyType,
      settled_at: settledAt,
    };

    const { data: newExpense, error: insertError } = await supabase
      .from('expenses')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        data: newExpense,
        message: 'Expense created successfully.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
