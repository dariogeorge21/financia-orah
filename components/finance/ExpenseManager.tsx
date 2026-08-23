'use client';

import { useState, useTransition, useMemo } from 'react';
import type { ExpenseRecord, MoneyPosition } from '@/lib/types';
import { formatINR, isEventExpense, calcMoneyPosition } from '@/lib/calculations';
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
  const [viewMode, setViewMode] = useViewMode('expenses');

  const [isRefreshing, startRefresh] = useTransition();
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
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

      return matchesSearch && matchesCat && matchesSource && matchesStatus;
    });
  }, [expenses, searchQuery, categoryFilter, sourceFilter, statusFilter]);

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
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Event expenditure records and billings powered by client-server API architecture
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          <AddExpenseDialog onSuccess={handleRefresh} moneyPosition={moneyPosition} />
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

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Approved Spent',
            value: formatINR(approved),
            subtext: `${expenses.filter((e) => e.status === 'Approved').length} Approved Bills`,
            cls: 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Pending Approval',
            value: formatINR(pending),
            subtext: `${expenses.filter((e) => e.status === 'Pending').length} Pending Claims`,
            cls: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Direct Event Spend',
            value: formatINR(eventDirect),
            subtext: 'Paid directly from event fund',
            cls: 'text-foreground',
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
          {filteredExpenses.map((exp) => (
            <div
              key={exp.id}
              className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between gap-3"
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
                  <Badge
                    variant={
                      exp.status === 'Approved'
                        ? 'default'
                        : exp.status === 'Rejected'
                        ? 'destructive'
                        : 'outline'
                    }
                    className="text-[11px] shrink-0"
                  >
                    {exp.status}
                  </Badge>
                </div>

                {/* Card Description & Amount */}
                <div className="mb-2.5">
                  <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2" title={exp.description}>
                    {exp.description}
                  </h3>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-lg font-bold text-rose-600 dark:text-rose-400">
                      {formatINR(exp.amount)}
                    </span>
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

                {/* Metadata Details */}
                <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]">Paid By:</span>
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
                    <p className="text-[11px] text-muted-foreground italic line-clamp-1 pt-0.5" title={exp.notes}>
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
          ))}

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
                  {['ID', 'Category', 'Description', 'Amount', 'Money Type', 'Paid By', 'Mobile', 'Source', 'Status', 'Receipt', 'Actions'].map(
                    (h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground last:text-right"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="transition-colors hover:bg-muted/20">
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
                ))}

                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-xs text-muted-foreground">
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
                  <td colSpan={7} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

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
