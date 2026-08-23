import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { IncomeRecord, IncomeType, MoneyType } from '@/lib/types';

// GET /api/income - Fetch all income records and computed summary statistics
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('income')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const income = (data ?? []) as IncomeRecord[];

    const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0);
    const cashTotal = income
      .filter((i) => i.money_type === 'Cash')
      .reduce((s, i) => s + Number(i.amount), 0);
    const cashHandedOverTotal = income
      .filter((i) => i.money_type === 'Cash' && i.is_handed_over !== false)
      .reduce((s, i) => s + Number(i.amount), 0);
    const cashPendingTotal = income
      .filter((i) => i.money_type === 'Cash' && i.is_handed_over === false)
      .reduce((s, i) => s + Number(i.amount), 0);
    const upiTotal = income
      .filter((i) => i.money_type === 'UPI')
      .reduce((s, i) => s + Number(i.amount), 0);

    return NextResponse.json({
      success: true,
      data: {
        income,
        summary: {
          totalIncome,
          cashTotal,
          cashHandedOverTotal,
          cashPendingTotal,
          upiTotal,
          totalCount: income.length,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/income - Create a new income record
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
    const type = body.type as IncomeType;
    const contributor = typeof body.contributor === 'string' ? body.contributor.trim() : '';
    const mobileNumber = typeof body.mobile_number === 'string' ? body.mobile_number.trim() : null;
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const amount = Number(body.amount);
    const moneyType = body.money_type as MoneyType;
    const isHandedOver = moneyType === 'UPI' ? true : body.is_handed_over !== undefined ? Boolean(body.is_handed_over) : true;
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const referenceId = typeof body.reference_id === 'string' ? body.reference_id.trim() : null;

    if (!type) {
      return NextResponse.json({ success: false, error: 'Income type is required.' }, { status: 400 });
    }

    if (!contributor) {
      return NextResponse.json({ success: false, error: 'Contributor name is required.' }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ success: false, error: 'Description is required.' }, { status: 400 });
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

    // Generate next sequential INC-XXXX id
    const { data: allIds } = await supabase.from('income').select('id');

    let maxNum = 0;
    if (allIds) {
      for (const item of allIds) {
        const match = item.id.match(/^INC-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const nextId = `INC-${String(maxNum + 1).padStart(4, '0')}`;

    const screenshotLink = typeof body.screenshot_link === 'string' ? body.screenshot_link.trim() : null;

    const { data: newIncome, error: insertError } = await supabase
      .from('income')
      .insert({
        id: nextId,
        date,
        type,
        contributor,
        mobile_number: mobileNumber || null,
        description,
        amount,
        money_type: moneyType,
        is_handed_over: isHandedOver,
        screenshot_link: screenshotLink || null,
        notes: notes || null,
        reference_id: referenceId || null,
        commitment_id: referenceId || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        data: newIncome,
        message: 'Income record created successfully.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
