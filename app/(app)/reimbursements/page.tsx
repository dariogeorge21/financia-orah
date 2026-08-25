import { createClient } from '@/lib/supabase/server';
import type { ReimbursementRecord } from '@/lib/types';
import { ReimbursementManager } from '@/components/finance/reimbursement/ReimbursementManager';

export const dynamic = 'force-dynamic';

export default async function ReimbursementsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reimbursements')
    .select('*')
    .order('date', { ascending: false });

  const reimbursements = (data ?? []) as ReimbursementRecord[];

  return <ReimbursementManager initialReimbursements={reimbursements} />;
}
