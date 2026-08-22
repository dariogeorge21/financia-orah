import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { BudgetCategory, ExpenseRecord } from '@/lib/types';
import { calcBudgetRows } from '@/lib/calculations';

// GET /api/budget - Fetch all budget categories, expenses, calculated rows, and summaries
export async function GET() {
  try {
    const supabase = await createClient();

    const [{ data: budgetsData, error: budgetError }, { data: expensesData, error: expenseError }] =
      await Promise.all([
        supabase.from('budget').select('*').order('category'),
        supabase.from('expenses').select('*'),
      ]);

    if (budgetError) {
      return NextResponse.json(
        { success: false, error: budgetError.message },
        { status: 500 }
      );
    }

    if (expenseError) {
      return NextResponse.json(
        { success: false, error: expenseError.message },
        { status: 500 }
      );
    }

    const budgets = (budgetsData ?? []) as BudgetCategory[];
    const expenses = (expensesData ?? []) as ExpenseRecord[];
    const rows = calcBudgetRows(budgets, expenses);

    const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual, 0);
    const totalRemaining = totalPlanned - totalActual;
    const overallPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        budgets,
        expenses,
        rows,
        summary: {
          totalPlanned,
          totalActual,
          totalRemaining,
          overallPct,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/budget - Create a new budget category
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
    const planned = Number(body.planned);
    const description = typeof body.description === 'string' ? body.description.trim() : null;

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category name is required.' },
        { status: 400 }
      );
    }

    if (isNaN(planned) || planned < 0) {
      return NextResponse.json(
        { success: false, error: 'Planned amount must be a positive number or zero.' },
        { status: 400 }
      );
    }

    // Check if category already exists (case-insensitive check)
    const { data: existing, error: checkError } = await supabase
      .from('budget')
      .select('id, category')
      .ilike('category', category)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json(
        { success: false, error: checkError.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Budget category "${existing.category}" already exists.` },
        { status: 409 }
      );
    }

    // Insert new category
    const { data: newBudget, error: insertError } = await supabase
      .from('budget')
      .insert({
        category,
        planned,
        description: description || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: newBudget,
        message: 'Budget category created successfully.',
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
