import { formatINR } from '@/lib/calculations';
import type { IncomeRecord, ExpenseRecord } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface Props {
  income: IncomeRecord[];
  expenses: ExpenseRecord[];
}

export function RecentTransactions({ income, expenses }: Props) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {/* Recent Income */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Income</h3>
          <Link href="/income" className="text-xs font-medium text-primary hover:underline">View all →</Link>
        </div>
        <div className="space-y-2">
          {income.map((inc) => (
            <div key={inc.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{inc.contributor}</p>
                  <p className="text-xs text-muted-foreground">{inc.type} · {inc.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">{inc.money_type}</Badge>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">+{formatINR(inc.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Expenses</h3>
          <Link href="/expenses" className="text-xs font-medium text-primary hover:underline">View all →</Link>
        </div>
        <div className="space-y-2">
          {expenses.map((exp) => (
            <div key={exp.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                  exp.status === 'Approved'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                    : exp.status === 'Rejected'
                    ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{exp.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {exp.category} · {exp.money_type}
                    {exp.settlement_status === 'Advance Given' && (
                      <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">· ⏳ Advance</span>
                    )}
                    {exp.settlement_status === 'Settled' && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1">· ✓ Settled</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={exp.status === 'Approved' ? 'default' : exp.status === 'Rejected' ? 'destructive' : 'outline'}
                  className="text-xs"
                >
                  {exp.status}
                </Badge>
                <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">-{formatINR(exp.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
