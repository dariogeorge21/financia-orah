import { createClient } from '@/lib/supabase/server';
import type { ReimbursementRecord } from '@/lib/types';
import { formatINR } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { AddReimbursementDialog } from '@/components/finance/AddReimbursementDialog';

export default async function ReimbursementsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('reimbursements')
    .select('*')
    .order('date', { ascending: false });

  const reimbursements = (data ?? []) as ReimbursementRecord[];
  const paid = reimbursements.filter((r) => r.status === 'Paid').reduce((s, r) => s + Number(r.amount), 0);
  const pending = reimbursements.filter((r) => r.status === 'Pending').reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reimbursements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Personal expenses pending settlement and reimbursement</p>
        </div>
        <AddReimbursementDialog />
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Claims', value: formatINR(paid + pending), cls: 'text-foreground' },
          { label: 'Settled / Paid', value: formatINR(paid), cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Pending Settlement', value: formatINR(pending), cls: 'text-amber-600 dark:text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {['ID', 'Date', 'Person', 'Mobile', 'Expense ID', 'Amount', 'Status', 'Paid Via', 'Notes'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {reimbursements.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{r.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{r.person}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{r.mobile_number || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary whitespace-nowrap">{r.expense_id}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold">{formatINR(r.amount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      variant={r.status === 'Paid' ? 'default' : 'outline'}
                      className={`text-xs ${r.status === 'Paid' ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''}`}
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.money_type_paid ? (
                      <Badge variant="secondary" className="text-xs">{r.money_type_paid}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold">Pending Settlement Total</td>
                <td className="px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400">{formatINR(pending)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
