import { createClient } from '@/lib/supabase/server';
import type { PersonalCommitmentRecord } from '@/lib/types';
import { CommitmentManager } from '@/components/finance/commitments/CommitmentManager';

export const dynamic = 'force-dynamic';

export default async function CommitmentsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('personal_commitments')
    .select('*')
    .order('created_at', { ascending: false });

  const commitments = (data ?? []) as PersonalCommitmentRecord[];

  return <CommitmentManager initialCommitments={commitments} />;
}
