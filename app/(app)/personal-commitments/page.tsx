import { createClient } from '@/lib/supabase/server';
import type { PersonalCommitmentRecord } from '@/lib/types';
import { CommitmentManager } from '@/components/finance/CommitmentManager';

export const dynamic = 'force-dynamic';

export default async function PersonalCommitmentsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('personal_commitments')
    .select('*')
    .order('created_at', { ascending: false });

  const commitments = (data ?? []) as PersonalCommitmentRecord[];

  return <CommitmentManager initialCommitments={commitments} />;
}
