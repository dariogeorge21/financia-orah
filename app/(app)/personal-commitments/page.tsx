import { createClient } from '@/lib/supabase/server';
import type { PersonalCommitmentRecord } from '@/lib/types';
import { formatINR } from '@/lib/calculations';
import { Progress } from '@/components/ui/progress';
import { AddPersonalCommitmentDialog } from '@/components/finance/AddPersonalCommitmentDialog';

export default async function PersonalCommitmentsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('personal_commitments')
    .select('*')
    .order('created_at', { ascending: false });

  const commitments = (data ?? []) as PersonalCommitmentRecord[];
  const active = commitments.filter((c) => c.status !== 'Cancelled');
  const totalPromised = active.reduce((s, c) => s + Number(c.promised), 0);
  const totalReceived = active.reduce((s, c) => s + Number(c.received), 0);
  const totalPending = Math.max(0, totalPromised - totalReceived);

  const statusVariant = (s: string) => {
    if (s === 'Fully Received') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (s === 'Partially Received') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (s === 'Cancelled') return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personal Commitments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Individual pledges and contributions for Orah – Campus Meet 2026
          </p>
        </div>
        <AddPersonalCommitmentDialog />
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Promised', value: formatINR(totalPromised), cls: 'text-foreground' },
          { label: 'Total Received', value: formatINR(totalReceived), cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Still Pending', value: formatINR(totalPending), cls: 'text-rose-600 dark:text-rose-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {['ID', 'Person', 'Mobile', 'Promised', 'Received', 'Pending', 'Progress', 'Status', 'Notes'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {commitments.map((com) => {
                const pct = com.promised > 0 ? Math.round((Number(com.received) / Number(com.promised)) * 100) : 0;
                const pendingAmt = Math.max(0, Number(com.promised) - Number(com.received));
                return (
                  <tr key={com.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{com.id}</td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{com.person_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{com.mobile_number || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold">{formatINR(com.promised)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatINR(com.received)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-rose-600 dark:text-rose-400">
                      {formatINR(pendingAmt)}
                    </td>
                    <td className="px-4 py-3 w-32">
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusVariant(com.status)}`}>
                        {com.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{com.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold">Total</td>
                <td className="px-4 py-3 text-sm font-bold text-foreground">{formatINR(totalPromised)}</td>
                <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(totalReceived)}</td>
                <td className="px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-400">{formatINR(totalPending)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
