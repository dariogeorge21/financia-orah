import { createClient } from '@/lib/supabase/server';
import type { IncomeRecord } from '@/lib/types';
import { IncomeManager } from '@/components/finance/IncomeManager';

export const dynamic = 'force-dynamic';

export default async function IncomePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('income')
    .select('*')
    .order('date', { ascending: false });

  const income = (data ?? []) as IncomeRecord[];

  return <IncomeManager initialIncome={income} />;
}
