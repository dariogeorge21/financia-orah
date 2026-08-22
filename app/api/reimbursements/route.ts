import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ReimbursementRecord, ReimbursementStatus, MoneyType } from '@/lib/types';

// GET /api/reimbursements - Fetch all reimbursement records and computed statistics
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('reimbursements')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const reimbursements = (data ?? []) as ReimbursementRecord[];

    const paidTotal = reimbursements
      .filter((r) => r.status === 'Paid')
      .reduce((s, r) => s + Number(r.amount), 0);

    const pendingTotal = reimbursements
      .filter((r) => r.status === 'Pending')
      .reduce((s, r) => s + Number(r.amount), 0);

    const totalClaims = paidTotal + pendingTotal;
    const settlementPct = totalClaims > 0 ? Math.round((paidTotal / totalClaims) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        reimbursements,
        summary: {
          totalClaims,
          paidTotal,
          pendingTotal,
          settlementPct,
          totalCount: reimbursements.length,
          paidCount: reimbursements.filter((r) => r.status === 'Paid').length,
          pendingCount: reimbursements.filter((r) => r.status === 'Pending').length,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/reimbursements - Create a new reimbursement claim/record
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const date = typeof body.date === 'string' ? body.date.trim() : new Date().toISOString().split('T')[0];
    const person = typeof body.person === 'string' ? body.person.trim() : '';
    const mobileNumber = typeof body.mobile_number === 'string' ? body.mobile_number.trim() : null;
    const expenseId = typeof body.expense_id === 'string' ? body.expense_id.trim() : '';
    const amount = Number(body.amount);
    const status = (body.status as ReimbursementStatus) || 'Pending';
    const moneyTypePaid = status === 'Paid' && body.money_type_paid ? (body.money_type_paid as MoneyType) : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;

    if (!person) {
      return NextResponse.json({ success: false, error: 'Person name is required.' }, { status: 400 });
    }

    if (!expenseId) {
      return NextResponse.json({ success: false, error: 'Expense ID is required.' }, { status: 400 });
    }

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than 0.' },
        { status: 400 }
      );
    }

    if (status === 'Paid' && moneyTypePaid && !['Cash', 'UPI'].includes(moneyTypePaid)) {
      return NextResponse.json(
        { success: false, error: 'Valid payment mode (Cash or UPI) is required for paid reimbursements.' },
        { status: 400 }
      );
    }

    // Generate next sequential REIM-XXX id
    const { data: allIds } = await supabase.from('reimbursements').select('id');

    let maxNum = 0;
    if (allIds) {
      for (const item of allIds) {
        const match = item.id.match(/^REIM-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextId = `REIM-${String(maxNum + 1).padStart(3, '0')}`;

    const { data: newReimbursement, error: insertError } = await supabase
      .from('reimbursements')
      .insert({
        id: nextId,
        date,
        person,
        mobile_number: mobileNumber || null,
        expense_id: expenseId,
        amount,
        status,
        money_type_paid: moneyTypePaid || null,
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
        data: newReimbursement,
        message: 'Reimbursement record created successfully.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
