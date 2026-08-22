import { createClient } from '@/lib/supabase/server';
import type { BudgetCategory, ExpenseRecord } from '@/lib/types';
import { BudgetManager } from '@/components/finance/BudgetManager';

export const dynamic = 'force-dynamic';

export default async function BudgetPage() {
  const supabase = await createClient();

  const [{ data: budgetsData }, { data: expensesData }] = await Promise.all([
    supabase.from('budget').select('*').order('category'),
    supabase.from('expenses').select('*'),
  ]);

  const budgets = (budgetsData ?? []) as BudgetCategory[];
  const expenses = (expensesData ?? []) as ExpenseRecord[];

  return <BudgetManager initialBudgets={budgets} initialExpenses={expenses} />;
}
