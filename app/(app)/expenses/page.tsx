import { createClient } from '@/lib/supabase/server';
import type { ExpenseRecord } from '@/lib/types';
import { ExpenseManager } from '@/components/finance/ExpenseManager';

export const dynamic = 'force-dynamic';

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });

  const expenses = (data ?? []) as ExpenseRecord[];

  return <ExpenseManager initialExpenses={expenses} />;
}
