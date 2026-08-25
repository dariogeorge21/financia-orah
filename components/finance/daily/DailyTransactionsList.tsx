'use client';

import type { IncomeRecord, ExpenseRecord } from '@/lib/types';
import { formatINR, isEventExpense } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';

interface DailyTransactionsListProps {
  incomeRecords: IncomeRecord[];
  expenseRecords: ExpenseRecord[];
}

export function DailyTransactionsList({
  incomeRecords,
  expenseRecords,
}: DailyTransactionsListProps) {
  const approvedExpenses = expenseRecords.filter((e) => e.status === 'Approved');
  const otherExpenses = expenseRecords.filter((e) => e.status !== 'Approved');

  const hasNoTransactions = incomeRecords.length === 0 && expenseRecords.length === 0;

  if (hasNoTransactions) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        No recorded transactions for this date.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Income Section */}
      {incomeRecords.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Income ({incomeRecords.length})
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              +{formatINR(incomeRecords.reduce((s, i) => s + Number(i.amount), 0))}
            </span>
          </div>

          <div className="divide-y divide-border/40 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            {incomeRecords.map((inc) => (
              <div
                key={inc.id}
                className="flex items-center justify-between p-2.5 sm:p-3 text-xs gap-2 hover:bg-emerald-500/10 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-foreground truncate">{inc.contributor}</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                      {inc.type}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] py-0 px-1.5 ${
                        inc.money_type === 'Cash'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                      }`}
                    >
                      {inc.money_type}
                    </Badge>
                    {inc.money_type === 'Cash' && inc.is_handed_over === false && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        ⏳ Handover Pending
                      </span>
                    )}
                  </div>
                  {inc.description && (
                    <p className="mt-0.5 text-muted-foreground truncate">{inc.description}</p>
                  )}
                  {inc.notes && (
                    <p className="mt-0.5 text-[11px] italic text-muted-foreground/80 truncate">
                      &ldquo;{inc.notes}&rdquo;
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatINR(Number(inc.amount))}
                  </span>
                  {inc.screenshot_link && (
                    <div className="mt-0.5">
                      <a
                        href={inc.screenshot_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary hover:underline"
                      >
                        Screenshot ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Outgoing Section */}
      {approvedExpenses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Outgoing Expenses ({approvedExpenses.length})
            </span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              -{formatINR(approvedExpenses.reduce((s, e) => s + Number(e.amount), 0))}
            </span>
          </div>

          <div className="divide-y divide-border/40 rounded-xl border border-rose-500/20 bg-rose-500/5">
            {approvedExpenses.map((exp) => {
              const isAdvance = exp.settlement_status === 'Advance Given';
              const isSettled = exp.settlement_status === 'Settled';

              return (
                <div
                  key={exp.id}
                  className="flex items-center justify-between p-2.5 sm:p-3 text-xs gap-2 hover:bg-rose-500/10 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-foreground truncate">
                        {exp.paid_by || exp.description || exp.category}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {exp.category}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] py-0 px-1.5 ${
                          exp.money_type === 'Cash'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                        }`}
                      >
                        {exp.money_type}
                      </Badge>
                      {!isEventExpense(exp.payment_source) && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">
                          Personal Pocket
                        </Badge>
                      )}
                      {isAdvance && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          ⏳ Advance Disbursed
                        </span>
                      )}
                      {isSettled && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ Settled
                        </span>
                      )}
                    </div>
                    {exp.description && (
                      <p className="mt-0.5 text-muted-foreground truncate">{exp.description}</p>
                    )}
                    {exp.notes && (
                      <p className="mt-0.5 text-[11px] italic text-muted-foreground/80 truncate">
                        &ldquo;{exp.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                      -{formatINR(Number(exp.amount))}
                    </span>
                    {exp.receipt_link && (
                      <div className="mt-0.5">
                        <a
                          href={exp.receipt_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-primary hover:underline"
                        >
                          Receipt ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending / Rejected Expenses (if any on that date) */}
      {otherExpenses.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Other Expenses ({otherExpenses.length})
            </span>
          </div>

          <div className="divide-y divide-border/40 rounded-xl border border-border/50 bg-muted/20">
            {otherExpenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between p-2.5 sm:p-3 text-xs gap-2 opacity-75"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {exp.paid_by || exp.description || exp.category}
                    </span>
                    <Badge
                      variant={exp.status === 'Pending' ? 'outline' : 'destructive'}
                      className="text-[10px] py-0 px-1.5"
                    >
                      {exp.status}
                    </Badge>
                  </div>
                  {exp.description && (
                    <p className="mt-0.5 text-muted-foreground truncate">{exp.description}</p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatINR(Number(exp.amount))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
