'use client';

import { useState, useTransition, useMemo } from 'react';
import type { ExpenseRecord, MoneyPosition } from '@/lib/types';
import {
  formatINR,
  isEventExpense,
  calcMoneyPosition,
  calcAdvancesSummary,
} from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AddExpenseDialog } from './AddExpenseDialog';
import { EditExpenseDialog } from './EditExpenseDialog';
import { SettleExpenseDialog } from './SettleExpenseDialog';
import { ViewModeToggle } from './ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { deleteExpense } from '@/features/expenses';

interface ExpenseManagerProps {
  initialExpenses: ExpenseRecord[];
  initialMoneyPosition?: MoneyPosition;
}

export function ExpenseManager({ initialExpenses, initialMoneyPosition }: ExpenseManagerProps) {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses);
  const [moneyPosition, setMoneyPosition] = useState<MoneyPosition | undefined>(initialMoneyPosition);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [settlementFilter, setSettlementFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useViewMode('expenses');

  const [isRefreshing, startRefresh] = useTransition();
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [settlingExpense, setSettlingExpense] = useState<ExpenseRecord | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRecord | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute summary stats
  const approved = useMemo(
    () =>
      expenses
        .filter((e) => e.status === 'Approved')
        .reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  );

  const pending = useMemo(
    () =>
      expenses
        .filter((e) => e.status === 'Pending')
        .reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  );

  const eventDirect = useMemo(
    () =>
      expenses
        .filter((e) => isEventExpense(e.payment_source) && e.status === 'Approved')
        .reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  );

  const personalPocket = useMemo(
    () =>
      expenses
        .filter((e) => !isEventExpense(e.payment_source) && e.status === 'Approved')
        .reduce((s, e) => s + Number(e.amount), 0),
    [expenses]
  );

  const advancesSummary = useMemo(() => calcAdvancesSummary(expenses), [expenses]);

  // Unique categories list
  const uniqueCategories = useMemo(() => {
    const set = new Set(expenses.map((e) => e.category));
    return Array.from(set).sort();
  }, [expenses]);

  // Filtered list
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        exp.id.toLowerCase().includes(q) ||
        exp.description.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q) ||
        exp.paid_by.toLowerCase().includes(q) ||
        (exp.notes && exp.notes.toLowerCase().includes(q));

      const matchesCat = categoryFilter === 'ALL' || exp.category === categoryFilter;
      const matchesSource =
        sourceFilter === 'ALL' ||
        (sourceFilter === 'Event' && isEventExpense(exp.payment_source)) ||
        (sourceFilter === 'Personal' && !isEventExpense(exp.payment_source));
      const matchesStatus = statusFilter === 'ALL' || exp.status === statusFilter;

      const expSettlement = exp.settlement_status || 'Direct';
      const matchesSettlement =
        settlementFilter === 'ALL' || expSettlement === settlementFilter;

      return matchesSearch && matchesCat && matchesSource && matchesStatus && matchesSettlement;
    });
  }, [expenses, searchQuery, categoryFilter, sourceFilter, statusFilter, settlementFilter]);

  // Refresh via API
  function handleRefresh() {
    setErrorMessage(null);
    startRefresh(async () => {
      try {
        const [expRes, incRes, reimbRes] = await Promise.all([
          fetch('/api/expenses').then((r) => r.json()),
          fetch('/api/income').then((r) => r.json()).catch(() => ({ data: { income: [] } })),
          fetch('/api/reimbursements').then((r) => r.json()).catch(() => ({ data: { reimbursements: [] } })),
        ]);

        if (expRes.data) {
          setExpenses(expRes.data.expenses);
        }
        const incList = incRes.data?.income ?? [];
        const expList = expRes.data?.expenses ?? [];
        const reimbList = reimbRes.data?.reimbursements ?? [];
        if (incList.length > 0 || expList.length > 0 || reimbList.length > 0) {
          setMoneyPosition(calcMoneyPosition(incList, expList, reimbList));
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh expenses data.');
      }
    });
  }

  // Handle Delete
  async function handleDeleteConfirm() {
    if (!deletingExpense?.id) return;
    setErrorMessage(null);

    startDelete(async () => {
      try {
        await deleteExpense(deletingExpense.id);
        setDeletingExpense(null);
        handleRefresh();
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete expense.');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses & Advances</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Disburse advances, reconcile volunteer bills, and track direct expenditures
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
            title="Refresh expenses from server"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isRefreshing ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            {isRefreshing ? 'Syncing…' : 'Refresh'}
          </Button>

          {/* Quick Disburse Advance Button */}
          <AddExpenseDialog
            defaultMode="advance"
            onSuccess={handleRefresh}
            moneyPosition={moneyPosition}
            trigger={
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-sm"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Disburse Advance
              </Button>
            }
          />

          {/* Add Direct Expense Button */}
          <AddExpenseDialog
            defaultMode="direct"
            onSuccess={handleRefresh}
            moneyPosition={moneyPosition}
          />
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive flex items-center justify-between">
          <span>{errorMessage}</span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setErrorMessage(null)}
            className="text-destructive hover:bg-destructive/20"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Active Advances Alert Banner (if any pending settlement) */}
      {advancesSummary.pendingCount > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/20 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                {advancesSummary.pendingCount}{' '}
                {advancesSummary.pendingCount === 1 ? 'Advance' : 'Advances'} Pending Final Bill (
                {formatINR(advancesSummary.totalPendingSettlement)} in volunteers’ hands)
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Funds are held by volunteers. Click &quot;Settle Bill&quot; when they return with bills and change.
              </p>
            </div>
          </div>

          <Button
            size="xs"
            variant="outline"
            onClick={() => setSettlementFilter(settlementFilter === 'Advance Given' ? 'ALL' : 'Advance Given')}
            className="border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 shrink-0 text-xs"
          >
            {settlementFilter === 'Advance Given' ? 'Show All Expenses' : 'View Pending Advances →'}
          </Button>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Approved Spent',
            value: formatINR(approved),
            subtext: `${expenses.filter((e) => e.status === 'Approved').length} Approved Records`,
            cls: 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Pending Claims',
            value: formatINR(pending),
            subtext: `${expenses.filter((e) => e.status === 'Pending').length} Pending Approval`,
            cls: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Advances Disbursed',
            value: formatINR(advancesSummary.totalAdvanceDisbursed),
            subtext: `${advancesSummary.pendingCount} pending • ${advancesSummary.settledCount} settled`,
            cls: 'text-orange-600 dark:text-orange-400',
          },
          {
            label: 'Personal Out of Pocket',
            value: formatINR(personalPocket),
            subtext: 'Reimbursable claims',
            cls: 'text-indigo-600 dark:text-indigo-400',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border/50 bg-card px-5 py-4 shadow-sm"
          >
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground/80 mt-1">{s.subtext}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-sm">
          <div className="relative w-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              placeholder="Search description, payee, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Select Filter */}
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? 'ALL')}>
            <SelectTrigger className="text-xs h-8 min-w-[130px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {uniqueCategories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Settlement Status Filter */}
          <Select value={settlementFilter} onValueChange={(v) => setSettlementFilter(v ?? 'ALL')}>
            <SelectTrigger className="text-xs h-8 min-w-[140px]">
              <SelectValue placeholder="Flow" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Flows</SelectItem>
              <SelectItem value="Advance Given">⏳ Advances in Hand ({advancesSummary.pendingCount})</SelectItem>
              <SelectItem value="Settled">✓ Settled Advances ({advancesSummary.settledCount})</SelectItem>
              <SelectItem value="Direct">Direct Expenses</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Source Filter */}
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v ?? 'ALL')}>
            <SelectTrigger className="text-xs h-8 min-w-[120px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sources</SelectItem>
              <SelectItem value="Event">Event Money</SelectItem>
              <SelectItem value="Personal">Personal Pocket</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter Buttons */}
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/20 p-1 text-xs">
            {['ALL', 'Approved', 'Pending', 'Rejected'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st === 'ALL' ? 'All' : st}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExpenses.map((exp) => {
            const isAdvanceGiven = exp.settlement_status === 'Advance Given';
            const isSettled = exp.settlement_status === 'Settled';
            const advAmt = Number(exp.advance_amount ?? exp.amount);
            const advType = exp.advance_money_type || exp.money_type;
            const balAmt = Number(exp.balance_amount ?? 0);
            const balType = exp.balance_money_type || advType;

            return (
              <div
                key={exp.id}
                className={`rounded-2xl border p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between gap-3 ${
                  isAdvanceGiven
                    ? 'border-amber-500/40 bg-amber-500/[0.02] dark:bg-amber-950/10'
                    : 'border-border/50 bg-card'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                        {exp.category}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {exp.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isAdvanceGiven && (
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] gap-1 px-1.5 py-0"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Advance Given
                        </Badge>
                      )}
                      {isSettled && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 text-[10px] px-1.5 py-0"
                        >
                          ✓ Settled
                        </Badge>
                      )}
                      <Badge
                        variant={
                          exp.status === 'Approved'
                            ? 'default'
                            : exp.status === 'Rejected'
                            ? 'destructive'
                            : 'outline'
                        }
                        className="text-[10px] px-1.5 py-0 shrink-0"
                      >
                        {exp.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Card Description & Amount */}
                  <div className="mb-2.5">
                    <h3
                      className="font-semibold text-foreground text-sm leading-snug line-clamp-2"
                      title={exp.description}
                    >
                      {exp.description}
                    </h3>
                    <div className="flex items-baseline justify-between mt-1">
                      <div>
                        <span className="text-lg font-bold text-rose-600 dark:text-rose-400">
                          {formatINR(exp.amount)}
                        </span>
                        {isAdvanceGiven && (
                          <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium ml-1.5">
                            (Advance)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Badge
                          variant={exp.money_type === 'Cash' ? 'secondary' : 'outline'}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {exp.money_type}
                        </Badge>
                        <span
                          className={`inline-flex items-center rounded-md px-1.5 py-0 text-[10px] font-medium ${
                            isEventExpense(exp.payment_source)
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}
                        >
                          {isEventExpense(exp.payment_source) ? 'Event' : 'Personal'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Advance Settlement Breakdown Pill if Settled */}
                  {isSettled && exp.advance_amount && (
                    <div className="rounded-lg bg-muted/40 p-2 text-[11px] space-y-1 mb-2 border border-border/30">
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Advance Disbursed:</span>
                        <span className="font-medium text-foreground">
                          {formatINR(advAmt)} ({advType})
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Reconciliation:</span>
                        {balAmt < 0 ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            Refunded {formatINR(Math.abs(balAmt))} ({balType})
                          </span>
                        ) : balAmt > 0 ? (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            Extra Paid +{formatINR(balAmt)} ({balType})
                          </span>
                        ) : (
                          <span className="font-semibold text-muted-foreground">
                            Exact Match (₹0)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata Details */}
                  <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px]">
                        {isAdvanceGiven ? 'Volunteer (Holding):' : 'Paid By:'}
                      </span>
                      <span className="font-medium text-foreground text-right truncate max-w-[150px]">
                        {exp.paid_by || '—'}
                      </span>
                    </div>
                    {exp.mobile_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px]">Mobile:</span>
                        <span className="font-mono text-[11px] text-foreground">
                          {exp.mobile_number}
                        </span>
                      </div>
                    )}
                    {exp.notes && (
                      <p
                        className="text-[11px] text-muted-foreground italic line-clamp-1 pt-0.5"
                        title={exp.notes}
                      >
                        “{exp.notes}”
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer: Receipt & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div>
                    {exp.has_receipt ? (
                      exp.receipt_link ? (
                        <a
                          href={exp.receipt_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Receipt ↗
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ Receipt Attached
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] text-muted-foreground">No receipt</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isAdvanceGiven && (
                      <Button
                        size="xs"
                        onClick={() => setSettlingExpense(exp)}
                        className="text-xs h-7 px-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xs font-medium gap-1"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Settle Bill
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setEditingExpense(exp)}
                      className="text-xs h-7 px-2"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setDeletingExpense(exp)}
                      className="text-xs h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredExpenses.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border/80 p-8 text-center">
              <p className="text-sm font-medium text-foreground">No expense records found.</p>
              <p className="text-xs text-muted-foreground mt-1">Try changing your filters or search query.</p>
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {[
                    'ID',
                    'Category',
                    'Description',
                    'Amount',
                    'Payment Mode',
                    'Flow Status',
                    'Volunteer / Payee',
                    'Mobile',
                    'Source',
                    'Status',
                    'Receipt',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground last:text-right"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredExpenses.map((exp) => {
                  const isAdvanceGiven = exp.settlement_status === 'Advance Given';
                  const isSettled = exp.settlement_status === 'Settled';
                  const balAmt = Number(exp.balance_amount ?? 0);
                  const balType = exp.balance_money_type || exp.money_type;

                  return (
                    <tr
                      key={exp.id}
                      className={`transition-colors hover:bg-muted/20 ${
                        isAdvanceGiven ? 'bg-amber-50/20 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {exp.id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={exp.description}>
                        {exp.description}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-rose-600 dark:text-rose-400">
                        {formatINR(exp.amount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={exp.money_type === 'Cash' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {exp.money_type}
                        </Badge>
                      </td>

                      {/* Flow Status Column */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isAdvanceGiven ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] gap-1"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Advance Given
                          </Badge>
                        ) : isSettled ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                            title={
                              balAmt !== 0
                                ? `Settled with ${balAmt < 0 ? 'Refund' : 'Extra payment'} of ${formatINR(Math.abs(balAmt))} via ${balType}`
                                : 'Settled with exact amount'
                            }
                          >
                            ✓ Settled{' '}
                            {balAmt < 0 && `(-${formatINR(Math.abs(balAmt))})`}
                            {balAmt > 0 && `(+${formatINR(balAmt)})`}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Direct</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs font-medium whitespace-nowrap text-foreground">
                        {exp.paid_by || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {exp.mobile_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 font-medium ${
                            isEventExpense(exp.payment_source)
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}
                        >
                          {isEventExpense(exp.payment_source) ? 'Event' : 'Personal'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant={
                            exp.status === 'Approved'
                              ? 'default'
                              : exp.status === 'Rejected'
                              ? 'destructive'
                              : 'outline'
                          }
                          className="text-xs"
                        >
                          {exp.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {exp.has_receipt ? (
                          exp.receipt_link ? (
                            <a
                              href={exp.receipt_link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-500 hover:underline text-xs font-medium inline-flex items-center gap-0.5"
                            >
                              View ↗
                            </a>
                          ) : (
                            <span className="text-emerald-500 font-bold">✓</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isAdvanceGiven && (
                            <Button
                              size="xs"
                              onClick={() => setSettlingExpense(exp)}
                              className="text-xs h-7 px-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-xs gap-1"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Settle
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setEditingExpense(exp)}
                            className="text-xs"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setDeletingExpense(exp)}
                            className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No expense records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-sm">
                    Total Approved Spend
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-400">
                    {formatINR(approved)}
                  </td>
                  <td colSpan={8} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Settle Expense Dialog */}
      <SettleExpenseDialog
        expense={settlingExpense}
        open={Boolean(settlingExpense)}
        onOpenChange={(open) => {
          if (!open) setSettlingExpense(null);
        }}
        moneyPosition={moneyPosition}
        onSuccess={handleRefresh}
      />

      {/* Edit Dialog */}
      <EditExpenseDialog
        expense={editingExpense}
        open={Boolean(editingExpense)}
        onOpenChange={(open) => {
          if (!open) setEditingExpense(null);
        }}
        moneyPosition={moneyPosition}
        onSuccess={handleRefresh}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingExpense)}
        onOpenChange={(open) => {
          if (!open) setDeletingExpense(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Expense Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">
                {deletingExpense?.id} ({deletingExpense?.category} - {formatINR(deletingExpense?.amount ?? 0)})
              </strong>
              ? This action will be processed via server API and removed from the database.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeletingExpense(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? 'Deleting…' : 'Delete Expense'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
