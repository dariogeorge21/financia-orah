import { createClient } from '@/lib/supabase/server';
import type { BudgetCategory, ExpenseRecord } from '@/lib/types';
import { calcBudgetRows, formatINR } from '@/lib/calculations';
import { Progress } from '@/components/ui/progress';

export default async function BudgetPage() {
  const supabase = await createClient();
  const [{ data: budgetsData }, { data: expensesData }] = await Promise.all([
    supabase.from('budget').select('*').order('category'),
    supabase.from('expenses').select('*'),
  ]);

  const budgets = (budgetsData ?? []) as BudgetCategory[];
  const expenses = (expensesData ?? []) as ExpenseRecord[];
  const rows = calcBudgetRows(budgets, expenses);

  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const overallPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Planned vs actual spend by category</p>
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total Budget', value: formatINR(totalPlanned), cls: 'text-foreground' },
          { label: 'Total Spent (Approved)', value: formatINR(totalActual), cls: 'text-rose-600 dark:text-rose-400' },
          { label: 'Remaining', value: formatINR(totalPlanned - totalActual), cls: 'text-emerald-600 dark:text-emerald-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Overall progress */}
      <div className="rounded-2xl border border-border/50 bg-card px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Overall Budget Utilization</p>
          <span className="text-sm font-semibold text-primary">{overallPct}%</span>
        </div>
        <Progress value={overallPct} className="h-2" />
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.category} className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">{row.category}</h3>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                row.statusLabel === 'Healthy'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : row.statusLabel === 'Warning'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
              }`}>
                {row.statusLabel}
              </span>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Planned</span>
                <span className="font-medium text-foreground">{formatINR(row.planned)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Spent</span>
                <span className="font-medium text-rose-600 dark:text-rose-400">{formatINR(row.actual)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Remaining</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{formatINR(row.remaining)}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Utilization</span>
                <span className="text-xs font-semibold text-foreground">{row.utilizationPct}%</span>
              </div>
              <Progress
                value={row.utilizationPct}
                className={`h-1.5 ${
                  row.statusLabel === 'Critical'
                    ? '[&>div]:bg-rose-500'
                    : row.statusLabel === 'Warning'
                    ? '[&>div]:bg-amber-500'
                    : '[&>div]:bg-emerald-500'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
