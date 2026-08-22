import { createClient } from '@/lib/supabase/server';
import type { FinanceCallRecord } from '@/lib/types';
import { FinanceCallManager } from '@/components/finance/FinanceCallManager';

export const dynamic = 'force-dynamic';

export default async function FinanceCallsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('finance_calls')
    .select('*')
    .order('created_at', { ascending: false });

  const calls = (data ?? []) as FinanceCallRecord[];

  return <FinanceCallManager initialCalls={calls} />;
}
