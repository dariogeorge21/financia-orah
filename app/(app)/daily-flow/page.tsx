import { createClient } from '@/lib/supabase/server';
import type { IncomeRecord, ExpenseRecord, ReimbursementRecord } from '@/lib/types';
import { calcMoneyPosition } from '@/lib/calculations';
import { DailyFlowManager } from '@/components/finance/daily/DailyFlowManager';

export const dynamic = 'force-dynamic';

export default async function DailyFlowPage() {
  const supabase = await createClient();

  const [incRes, expRes, reimbRes] = await Promise.all([
    supabase.from('income').select('*').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('reimbursements').select('*'),
  ]);

  const income = (incRes.data ?? []) as IncomeRecord[];
  const expenses = (expRes.data ?? []) as ExpenseRecord[];
  const reimbursements = (reimbRes.data ?? []) as ReimbursementRecord[];

  const moneyPosition = calcMoneyPosition(income, expenses, reimbursements);

  return (
    <DailyFlowManager
      initialIncome={income}
      initialExpenses={expenses}
      initialMoneyPosition={moneyPosition}
    />
  );
}
