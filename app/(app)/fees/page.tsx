import { fetchServerFees } from '@/app/api/fees/route';
import { FeeManager } from '@/components/finance/fees/FeeManager';

export const dynamic = 'force-dynamic';

export default async function FeesPage() {
  const fees = await fetchServerFees();

  return <FeeManager initialFees={fees} />;
}
