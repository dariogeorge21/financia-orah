'use client';

import { useState, useTransition, useMemo } from 'react';
import type { BudgetCategory, ExpenseRecord, BudgetRow } from '@/lib/types';
import { calcBudgetRows, formatINR } from '@/lib/calculations';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AddBudgetDialog } from './Budget/AddBudgetDialog';
import { EditBudgetDialog } from './EditBudgetDialog';
import { ViewModeToggle } from './ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { fetchBudgetData, deleteBudgetCategory } from '@/features/budget';

interface BudgetManagerProps {
  initialBudgets: BudgetCategory[];
  initialExpenses: ExpenseRecord[];
}

export function BudgetManager({
  initialBudgets,
  initialExpenses,
}: BudgetManagerProps) {
  const [budgets, setBudgets] = useState<BudgetCategory[]>(initialBudgets);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Healthy' | 'Warning' | 'Critical'>('ALL');
  const [viewMode, setViewMode] = useViewMode('budget');

  const [isRefreshing, startRefresh] = useTransition();
  const [editingBudget, setEditingBudget] = useState<BudgetRow | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<BudgetRow | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute live budget rows
  const rows = useMemo(() => calcBudgetRows(budgets, expenses), [budgets, expenses]);

  // Aggregate summary metrics
  const totalPlanned = useMemo(() => rows.reduce((s, r) => s + r.planned, 0), [rows]);
  const totalActual = useMemo(() => rows.reduce((s, r) => s + r.actual, 0), [rows]);
  const totalRemaining = totalPlanned - totalActual;
  const overallPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch =
        r.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || r.statusLabel === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, searchQuery, statusFilter]);

  // Refresh data via API endpoint
  function handleRefresh() {
    setErrorMessage(null);
    startRefresh(async () => {
      try {
        const res = await fetchBudgetData();
        if (res.data) {
          setBudgets(res.data.budgets);
          setExpenses(res.data.expenses);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh budget data.');
      }
    });
  }

  // Handle Delete Confirmation
  async function handleDeleteConfirm() {
    if (!deletingBudget?.id) return;
    setErrorMessage(null);

    startDelete(async () => {
      try {
        await deleteBudgetCategory(deletingBudget.id!);
        setDeletingBudget(null);
        handleRefresh();
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete budget category.');
      }
    });
  }

  const existingCategories = useMemo(() => budgets.map((b) => b.category), [budgets]);

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Client-server architecture: Planned vs actual spend powered by Next.js API endpoints
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
            title="Refresh budget from server"
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

          <AddBudgetDialog
            existingCategories={existingCategories}
            onSuccess={handleRefresh}
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

      {/* Summary KPI Strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Total Planned Budget',
            value: formatINR(totalPlanned),
            subtext: `${budgets.length} Active Categories`,
            cls: 'text-foreground',
          },
          {
            label: 'Total Spent (Approved)',
            value: formatINR(totalActual),
            subtext: `${overallPct}% utilized`,
            cls: 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Remaining Budget',
            value: formatINR(totalRemaining),
            subtext: totalRemaining >= 0 ? 'Within budget' : 'Over budget',
            cls:
              totalRemaining >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400',
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

      {/* Overall Progress */}
      <div className="rounded-2xl border border-border/50 bg-card px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium">Overall Budget Utilization</p>
            <p className="text-xs text-muted-foreground">
              {formatINR(totalActual)} spent of {formatINR(totalPlanned)} total budget
            </p>
          </div>
          <span className="text-base font-bold text-primary">{overallPct}%</span>
        </div>
        <Progress
          value={Math.min(overallPct, 100)}
          className={`h-2.5 ${
            overallPct > 100
              ? '[&>div]:bg-rose-500'
              : overallPct >= 80
              ? '[&>div]:bg-amber-500'
              : '[&>div]:bg-emerald-500'
          }`}
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              placeholder="Search category or note..."
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

        <div className="flex items-center gap-2">
          {/* Status Filter Buttons */}
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/20 p-1 text-xs">
            {(['ALL', 'Healthy', 'Warning', 'Critical'] as const).map((st) => (
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRows.map((row) => (
            <div
              key={row.category}
              className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground truncate" title={row.category}>
                    {row.category}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.statusLabel === 'Healthy'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : row.statusLabel === 'Warning'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                    }`}
                  >
                    {row.statusLabel}
                  </span>
                </div>

                {row.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2" title={row.description}>
                    {row.description}
                  </p>
                )}

                <div className="space-y-2 mb-3 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Planned</span>
                    <span className="font-medium text-foreground">{formatINR(row.planned)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Spent (Approved)</span>
                    <span className="font-medium text-rose-600 dark:text-rose-400">
                      {formatINR(row.actual)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Remaining</span>
                    <span
                      className={`font-medium ${
                        row.remaining >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatINR(row.remaining)}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Utilization</span>
                    <span className="text-xs font-semibold text-foreground">
                      {row.utilizationPct}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(row.utilizationPct, 100)}
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

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingBudget(row)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Edit
                </Button>

                {row.id && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setDeletingBudget(row)}
                    className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-1"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}

          {filteredRows.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border/80 p-8 text-center">
              <p className="text-sm font-medium text-foreground">No budget categories match your filter.</p>
              <p className="text-xs text-muted-foreground mt-1">Try clearing your search query or status filter.</p>
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
                  {['Category', 'Planned', 'Spent (Approved)', 'Remaining', 'Utilization', 'Status', 'Actions'].map((h) => (
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
                {filteredRows.map((row) => (
                  <tr key={row.category} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{row.category}</div>
                      {row.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{row.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {formatINR(row.planned)}
                    </td>
                    <td className="px-4 py-3 font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      {formatINR(row.actual)}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium whitespace-nowrap ${
                        row.remaining >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {formatINR(row.remaining)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress
                          value={Math.min(row.utilizationPct, 100)}
                          className={`h-2 flex-1 ${
                            row.statusLabel === 'Critical'
                              ? '[&>div]:bg-rose-500'
                              : row.statusLabel === 'Warning'
                              ? '[&>div]:bg-amber-500'
                              : '[&>div]:bg-emerald-500'
                          }`}
                        />
                        <span className="text-xs font-semibold text-foreground w-8">
                          {row.utilizationPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.statusLabel === 'Healthy'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : row.statusLabel === 'Warning'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setEditingBudget(row)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                        {row.id && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setDeletingBudget(row)}
                            className="text-xs text-rose-500 hover:text-rose-600"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-semibold">
                  <td className="px-4 py-3 text-sm">Totals</td>
                  <td className="px-4 py-3 text-sm text-foreground">{formatINR(totalPlanned)}</td>
                  <td className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{formatINR(totalActual)}</td>
                  <td className={`px-4 py-3 text-sm ${totalRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatINR(totalRemaining)}
                  </td>
                  <td className="px-4 py-3 text-sm">{overallPct}% overall</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Edit Budget Dialog */}
      <EditBudgetDialog
        budget={editingBudget}
        open={Boolean(editingBudget)}
        onOpenChange={(open) => {
          if (!open) setEditingBudget(null);
        }}
        onSuccess={handleRefresh}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingBudget)}
        onOpenChange={(open) => {
          if (!open) setDeletingBudget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Budget Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{deletingBudget?.category}</strong>? This action
              will be sent to the server API and removed from the database.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeletingBudget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? 'Deleting…' : 'Delete Category'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
