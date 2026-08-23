import { createClient } from '@/lib/supabase/server';
import type { ChurchDonationRecord } from '@/lib/types';
import { ChurchDonationManager } from '@/components/finance/ChurchDonationManager';

export const dynamic = 'force-dynamic';

export default async function ChurchDonationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('church_donations')
    .select('*')
    .order('created_at', { ascending: false });

  const donations = (data ?? []) as ChurchDonationRecord[];

  return <ChurchDonationManager initialDonations={donations} />;
}
