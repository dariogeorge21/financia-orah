import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildLedgerRows } from '@/lib/export/ledger';
import type {
  IncomeRecord,
  ExpenseRecord,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET /api/export/ledger
// Returns all financial transactions as a master ledger with running balances,
// sorted in ascending date order for financial reporting.
export async function GET() {
  try {
    const supabase = await createClient();

    const [incRes, expRes] = await Promise.all([
      supabase.from('income').select('*').order('date', { ascending: true }),
      supabase.from('expenses').select('*').order('created_at', { ascending: true }),
    ]);

    const income = (incRes.data ?? []) as IncomeRecord[];
    const expenses = (expRes.data ?? []) as ExpenseRecord[];

    const rows = buildLedgerRows(income, expenses);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
