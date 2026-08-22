import { createClient } from '@/lib/supabase/server';
import type { IncomeRecord } from '@/lib/types';
import { formatINR } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { AddIncomeDialog } from '@/components/finance/AddIncomeDialog';

export default async function IncomePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('income')
    .select('*')
    .order('date', { ascending: false });

  const income = (data ?? []) as IncomeRecord[];
  const total = income.reduce((s, i) => s + Number(i.amount), 0);
  const cashTotal = income.filter((i) => i.money_type === 'Cash').reduce((s, i) => s + Number(i.amount), 0);
  const upiTotal = income.filter((i) => i.money_type === 'UPI').reduce((s, i) => s + Number(i.amount), 0);

  const typeColors: Record<string, string> = {
    Registration: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Donation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'Personal Commitment': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Finance Call': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    Commitment: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Church: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Coupon: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    Sponsor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    Other: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Income</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All income transactions for Orah – Campus Meet 2026</p>
        </div>
        <AddIncomeDialog />
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Income', value: formatINR(total), cls: 'text-foreground' },
          { label: 'Cash', value: formatINR(cashTotal), cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'UPI / Digital', value: formatINR(upiTotal), cls: 'text-indigo-600 dark:text-indigo-400' },
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
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">ID</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contributor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ref / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {income.map((inc) => (
                <tr key={inc.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{inc.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{inc.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeColors[inc.type] ?? ''}`}>
                      {inc.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{inc.contributor}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{inc.mobile_number || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{inc.description}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {formatINR(inc.amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={inc.money_type === 'Cash' ? 'secondary' : 'outline'} className="text-xs">
                      {inc.money_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">
                    {inc.reference_id || inc.commitment_id ? (
                      <span className="font-mono text-primary font-medium">{inc.reference_id || inc.commitment_id}</span>
                    ) : (
                      inc.notes || '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-foreground">Total</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
