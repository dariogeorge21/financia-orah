import { createClient } from '@/lib/supabase/server';
import type { ExpenseRecord } from '@/lib/types';
import { formatINR, isEventExpense } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { AddExpenseDialog } from '@/components/finance/AddExpenseDialog';

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false });

  const expenses = (data ?? []) as ExpenseRecord[];
  const approved = expenses.filter((e) => e.status === 'Approved').reduce((s, e) => s + Number(e.amount), 0);
  const pending = expenses.filter((e) => e.status === 'Pending').reduce((s, e) => s + Number(e.amount), 0);
  const eventDirect = expenses.filter((e) => isEventExpense(e.payment_source) && e.status === 'Approved').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All event expenditure records and billings</p>
        </div>
        <AddExpenseDialog />
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Approved Spent', value: formatINR(approved), cls: 'text-rose-600 dark:text-rose-400' },
          { label: 'Pending Approval', value: formatINR(pending), cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Direct from Event Funds', value: formatINR(eventDirect), cls: 'text-foreground' },
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
                {['ID', 'Category', 'Description', 'Amount', 'Money Type', 'Paid By', 'Mobile', 'Source', 'Status', 'Receipt'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground last:text-center">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {expenses.map((exp) => (
                <tr key={exp.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{exp.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[180px] truncate">{exp.description}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-rose-600 dark:text-rose-400">
                    {formatINR(exp.amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant={exp.money_type === 'Cash' ? 'secondary' : 'outline'} className="text-xs">
                      {exp.money_type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">{exp.paid_by || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{exp.mobile_number || '—'}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${
                      isEventExpense(exp.payment_source)
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {isEventExpense(exp.payment_source) ? 'Event' : 'Personal'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      variant={exp.status === 'Approved' ? 'default' : exp.status === 'Rejected' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {exp.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    {exp.has_receipt ? (
                      exp.receipt_link ? (
                        <a href={exp.receipt_link} target="_blank" rel="noreferrer" className="text-emerald-500 hover:underline text-xs">
                          View ↗
                        </a>
                      ) : (
                        <span className="text-emerald-500 font-bold">✓</span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold">Total Approved</td>
                <td className="px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-400">{formatINR(approved)}</td>
                <td colSpan={6} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
