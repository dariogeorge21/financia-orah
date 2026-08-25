import { createClient } from '@/lib/supabase/server';
import type { CouponRecord } from '@/lib/types';
import { CouponManager } from '@/components/finance/coupons/CouponManager';

export const dynamic = 'force-dynamic';

export default async function CouponsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  const coupons = (data ?? []) as CouponRecord[];

  return <CouponManager initialCoupons={coupons} />;
}
