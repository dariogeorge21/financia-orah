import { createClient } from '@/lib/supabase/server';
import type { ExpenseRecord, IncomeRecord, ReimbursementRecord } from '@/lib/types';
import { calcMoneyPosition } from '@/lib/calculations';
import { ExpenseManager } from '@/components/finance/expense/ExpenseManager';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage() {
  const supabase = await createClient();
  const [expRes, incRes, reimbRes] = await Promise.all([
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('income').select('*'),
    supabase.from('reimbursements').select('*'),
  ]);

  const expenses = (expRes.data ?? []) as ExpenseRecord[];
  const income = (incRes.data ?? []) as IncomeRecord[];
  const reimbursements = (reimbRes.data ?? []) as ReimbursementRecord[];

  const moneyPosition = calcMoneyPosition(income, expenses, reimbursements);

  return <ExpenseManager initialExpenses={expenses} initialMoneyPosition={moneyPosition} />;
}
