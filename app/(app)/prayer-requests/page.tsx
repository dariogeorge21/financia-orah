import { createClient } from '@/lib/supabase/server';
import type { PrayerRequestRecord, PrayerStatus } from '@/lib/types';
import { PrayerRequestManager } from '@/components/finance/prayer/PrayerRequestManager';

export const dynamic = 'force-dynamic';

export default async function PrayerRequestsPage() {
  const supabase = await createClient();

  // 1. Fetch direct prayer requests
  const { data: directData } = await supabase
    .from('prayer_requests')
    .select('*')
    .order('date', { ascending: false });

  const directRequests: PrayerRequestRecord[] = (directData ?? []).map((r) => ({
    ...r,
    isDirect: true,
  }));

  // 2. Fetch income records that have prayer_request
  const { data: incomeData } = await supabase
    .from('income')
    .select('*')
    .not('prayer_request', 'is', null)
    .neq('prayer_request', '');

  const incomeRequests: PrayerRequestRecord[] = (incomeData ?? []).map((inc) => ({
    id: `INC-PR-${inc.id}`,
    person_name: inc.contributor,
    mobile_number: inc.mobile_number || null,
    prayer_request: inc.prayer_request || '',
    date: inc.date || (inc.created_at ? inc.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    status: 'Active' as PrayerStatus,
    source: `Income (${inc.type})`,
    reference_id: inc.id,
    notes: inc.notes || null,
    amount: Number(inc.amount),
    created_at: inc.created_at,
    isDirect: false,
  }));

  // 3. Fetch personal commitments with prayer_request
  const { data: pcomData } = await supabase
    .from('personal_commitments')
    .select('*')
    .not('prayer_request', 'is', null)
    .neq('prayer_request', '');

  const pcomRequests: PrayerRequestRecord[] = (pcomData ?? []).map((c) => ({
    id: `PCOM-PR-${c.id}`,
    person_name: c.person_name,
    mobile_number: c.mobile_number || null,
    prayer_request: c.prayer_request || '',
    date: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    status: 'Active' as PrayerStatus,
    source: 'Personal Commitment',
    reference_id: c.id,
    notes: c.notes || null,
    amount: Number(c.promised),
    created_at: c.created_at,
    isDirect: false,
  }));

  // 4. Fetch finance calls with prayer_request
  const { data: fcData } = await supabase
    .from('finance_calls')
    .select('*')
    .not('prayer_request', 'is', null)
    .neq('prayer_request', '');

  const fcRequests: PrayerRequestRecord[] = (fcData ?? []).map((c) => ({
    id: `FC-PR-${c.id}`,
    person_name: c.person_name,
    mobile_number: c.mobile_number || null,
    prayer_request: c.prayer_request || '',
    date: c.created_at ? c.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
    status: 'Active' as PrayerStatus,
    source: 'Finance Call',
    reference_id: c.id,
    notes: c.notes || null,
    amount: Number(c.promised),
    created_at: c.created_at,
    isDirect: false,
  }));

  const seenRefs = new Set<string>();
  const allRequests: PrayerRequestRecord[] = [];

  for (const req of directRequests) {
    allRequests.push(req);
    if (req.reference_id) seenRefs.add(req.reference_id);
  }

  for (const req of [...incomeRequests, ...pcomRequests, ...fcRequests]) {
    if (req.reference_id && seenRefs.has(req.reference_id)) continue;
    allRequests.push(req);
    if (req.reference_id) seenRefs.add(req.reference_id);
  }

  allRequests.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return <PrayerRequestManager initialRequests={allRequests} />;
}
