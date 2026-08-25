'use client';

import { useState, useTransition, useMemo } from 'react';
import type { IncomeRecord, IncomeType, MoneyPosition } from '@/lib/types';
import { formatINR, calcMoneyPosition } from '@/lib/calculations';
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
import { AddIncomeDialog } from './AddIncomeDialog';
import { EditIncomeDialog } from './EditIncomeDialog';
import { ViewModeToggle } from './ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { deleteIncome, updateIncome } from '@/features/income';

const TYPE_COLORS: Record<string, string> = {
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

const ALL_TYPES: IncomeType[] = [
  'Registration',
  'Donation',
  'Personal Commitment',
  'Finance Call',
  'Church',
  'Coupon',
  'Sponsor',
  'Other',
];

interface IncomeManagerProps {
  initialIncome: IncomeRecord[];
  initialMoneyPosition?: MoneyPosition;
}

export function IncomeManager({ initialIncome, initialMoneyPosition }: IncomeManagerProps) {
  const [income, setIncome] = useState<IncomeRecord[]>(initialIncome);
  const [moneyPosition, setMoneyPosition] = useState<MoneyPosition | undefined>(initialMoneyPosition);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [moneyTypeFilter, setMoneyTypeFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useViewMode('income');

  const [isRefreshing, startRefresh] = useTransition();
  const [editingIncome, setEditingIncome] = useState<IncomeRecord | null>(null);
  const [deletingIncome, setDeletingIncome] = useState<IncomeRecord | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute summary stats
  const total = useMemo(() => income.reduce((s, i) => s + Number(i.amount), 0), [income]);
  const cashTotal = useMemo(
    () =>
      income
        .filter((i) => i.money_type === 'Cash')
        .reduce((s, i) => s + Number(i.amount), 0),
    [income]
  );
  const cashHandedOverTotal = useMemo(
    () =>
      income
        .filter((i) => i.money_type === 'Cash' && i.is_handed_over !== false)
        .reduce((s, i) => s + Number(i.amount), 0),
    [income]
  );
  const cashPendingTotal = useMemo(
    () =>
      income
        .filter((i) => i.money_type === 'Cash' && i.is_handed_over === false)
        .reduce((s, i) => s + Number(i.amount), 0),
    [income]
  );
  const upiTotal = useMemo(
    () =>
      income
        .filter((i) => i.money_type === 'UPI')
        .reduce((s, i) => s + Number(i.amount), 0),
    [income]
  );

  // Filtered list
  const filteredIncome = useMemo(() => {
    return income.filter((inc) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        inc.id.toLowerCase().includes(q) ||
        inc.contributor.toLowerCase().includes(q) ||
        (inc.description && inc.description.toLowerCase().includes(q)) ||
        (inc.mobile_number && inc.mobile_number.includes(q)) ||
        (inc.reference_id && inc.reference_id.toLowerCase().includes(q)) ||
        (inc.notes && inc.notes.toLowerCase().includes(q));

      const matchesType = typeFilter === 'ALL' || inc.type === typeFilter;
      const matchesMoneyType =
        moneyTypeFilter === 'ALL'
          ? true
          : moneyTypeFilter === 'Cash'
          ? inc.money_type === 'Cash'
          : moneyTypeFilter === 'Cash-Handed'
          ? inc.money_type === 'Cash' && inc.is_handed_over !== false
          : moneyTypeFilter === 'Cash-Pending'
          ? inc.money_type === 'Cash' && inc.is_handed_over === false
          : inc.money_type === 'UPI';

      return matchesSearch && matchesType && matchesMoneyType;
    });
  }, [income, searchQuery, typeFilter, moneyTypeFilter]);

  async function handleToggleHandover(inc: IncomeRecord) {
    const nextVal = inc.is_handed_over === false ? true : false;
    try {
      await updateIncome(inc.id, { is_handed_over: nextVal });
      setIncome((prev) =>
        prev.map((item) => (item.id === inc.id ? { ...item, is_handed_over: nextVal } : item))
      );
      handleRefresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update handover status.');
    }
  }

  // Refresh via API
  function handleRefresh() {
    setErrorMessage(null);
    startRefresh(async () => {
      try {
        const [incRes, expRes, reimbRes] = await Promise.all([
          fetch('/api/income').then((r) => r.json()),
          fetch('/api/expenses').then((r) => r.json()).catch(() => ({ data: { expenses: [] } })),
          fetch('/api/reimbursements').then((r) => r.json()).catch(() => ({ data: { reimbursements: [] } })),
        ]);

        if (incRes.data) {
          setIncome(incRes.data.income);
        }
        const incList = incRes.data?.income ?? [];
        const expList = expRes.data?.expenses ?? [];
        const reimbList = reimbRes.data?.reimbursements ?? [];
        if (incList.length > 0 || expList.length > 0 || reimbList.length > 0) {
          setMoneyPosition(calcMoneyPosition(incList, expList, reimbList));
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh income data.');
      }
    });
  }

  // Handle Delete
  async function handleDeleteConfirm() {
    if (!deletingIncome?.id) return;
    setErrorMessage(null);

    startDelete(async () => {
      try {
        await deleteIncome(deletingIncome.id);
        setDeletingIncome(null);
        handleRefresh();
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete income record.');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Income</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            All income transactions for Orah – Campus Meet 2026 powered by client-server API
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
            title="Refresh income from server"
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

          <AddIncomeDialog onSuccess={handleRefresh} moneyPosition={moneyPosition} />
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
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Total Income',
            value: formatINR(total),
            subtext: `${income.length} Total Receipts`,
            cls: 'text-foreground',
          },
          {
            label: 'Cash Receipts',
            value: formatINR(cashTotal),
            subtext:
              cashPendingTotal > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  In Hand: {formatINR(cashHandedOverTotal)} • Pending: {formatINR(cashPendingTotal)}
                </span>
              ) : (
                `${income.filter((i) => i.money_type === 'Cash').length} cash receipts`
              ),
            cls: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'UPI / Digital Receipts',
            value: formatINR(upiTotal),
            subtext: `${income.filter((i) => i.money_type === 'UPI').length} online payments`,
            cls: 'text-indigo-600 dark:text-indigo-400',
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border/50 bg-card px-5 py-4 shadow-sm"
          >
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.cls}`}>{s.value}</p>
            <div className="text-xs text-muted-foreground/80 mt-1">{s.subtext}</div>
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
              placeholder="Search contributor, desc, or ref ID..."
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
          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? 'ALL')}>
            <SelectTrigger className="text-xs h-8 min-w-[140px]">
              <SelectValue placeholder="Income Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {ALL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Money Type Filter */}
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/20 p-1 text-xs overflow-x-auto">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'Cash', label: 'All Cash' },
              { id: 'Cash-Pending', label: 'Pending Cash' },
              { id: 'UPI', label: 'UPI' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setMoneyTypeFilter(st.id)}
                className={`rounded-md px-2 py-1 font-medium text-xs whitespace-nowrap transition-all ${
                  moneyTypeFilter === st.id
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st.label}
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
          {filteredIncome.map((inc) => (
            <div
              key={inc.id}
              className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between gap-3"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium truncate ${
                        TYPE_COLORS[inc.type] ?? 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {inc.type}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {inc.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {inc.money_type === 'Cash' ? (
                      inc.is_handed_over === false ? (
                        <button
                          type="button"
                          onClick={() => handleToggleHandover(inc)}
                          title="Cash is pending with volunteer. Click to mark handed over to finance."
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Pending Handover
                        </button>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                        >
                          Cash • In Hand
                        </Badge>
                      )
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 text-indigo-700 border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/30 dark:text-indigo-300"
                      >
                        UPI
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Contributor & Amount */}
                <div className="mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-foreground text-sm leading-snug truncate" title={inc.contributor}>
                      {inc.contributor}
                    </h3>
                    {inc.screenshot_link && (
                      <a
                        href={inc.screenshot_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-[10px] text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded font-mono shrink-0"
                        title="View Payment Screenshot"
                      >
                        Receipt ↗
                      </a>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatINR(inc.amount)}
                    </span>
                    <span className="text-xs text-muted-foreground">{inc.date}</span>
                  </div>

                  {inc.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2" title={inc.description}>
                      {inc.description}
                    </p>
                  )}
                </div>

                {/* Metadata Details */}
                {(inc.mobile_number || inc.reference_id || inc.commitment_id || inc.notes) && (
                  <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t border-border/40">
                    {inc.mobile_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px]">Mobile:</span>
                        <span className="font-mono text-[11px] text-foreground">
                          {inc.mobile_number}
                        </span>
                      </div>
                    )}
                    {(inc.reference_id || inc.commitment_id) && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px]">Ref / ID:</span>
                        <span className="font-mono text-[11px] text-primary font-medium truncate max-w-[150px]">
                          {inc.reference_id || inc.commitment_id}
                        </span>
                      </div>
                    )}
                    {inc.notes && (
                      <p className="text-[11px] text-muted-foreground italic line-clamp-1 pt-0.5" title={inc.notes}>
                        “{inc.notes}”
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer: Actions */}
              <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setEditingIncome(inc)}
                  className="text-xs h-7 px-2"
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setDeletingIncome(inc)}
                  className="text-xs h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}

          {filteredIncome.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border/80 p-8 text-center">
              <p className="text-sm font-medium text-foreground">No income transactions found.</p>
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
                  {['ID', 'Date', 'Type', 'Contributor', 'Mobile', 'Description', 'Amount', 'Mode', 'Ref / Notes', 'Actions'].map(
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
                {filteredIncome.map((inc) => (
                  <tr key={inc.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {inc.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                      {inc.date}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                          TYPE_COLORS[inc.type] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{inc.contributor}</span>
                        {inc.screenshot_link && (
                          <a
                            href={inc.screenshot_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-[10px] text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded font-mono"
                            title="View Payment Screenshot"
                          >
                            Receipt ↗
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {inc.mobile_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={inc.description || ''}>
                      {inc.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-left font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {formatINR(inc.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {inc.money_type === 'Cash' ? (
                        inc.is_handed_over === false ? (
                          <button
                            type="button"
                            onClick={() => handleToggleHandover(inc)}
                            title="Pending with volunteer. Click to mark handed over to finance."
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending Handover
                          </button>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-xs text-emerald-700 border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                          >
                            Cash • In Hand
                          </Badge>
                        )
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs text-indigo-700 border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-950/30 dark:text-indigo-300"
                        >
                          UPI
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate" title={inc.reference_id || inc.notes || ''}>
                      {inc.reference_id || inc.commitment_id ? (
                        <span className="font-mono text-primary font-medium">
                          {inc.reference_id || inc.commitment_id}
                        </span>
                      ) : (
                        inc.notes || '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setEditingIncome(inc)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setDeletingIncome(inc)}
                          className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredIncome.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No income transactions found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-semibold">
                  <td colSpan={6} className="px-4 py-3 text-sm text-foreground">
                    Total Income
                  </td>
                  <td className="px-4 py-3 text-left text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatINR(total)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <EditIncomeDialog
        income={editingIncome}
        open={Boolean(editingIncome)}
        onOpenChange={(open) => {
          if (!open) setEditingIncome(null);
        }}
        onSuccess={handleRefresh}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingIncome)}
        onOpenChange={(open) => {
          if (!open) setDeletingIncome(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Income Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete receipt{' '}
              <strong className="text-foreground">
                {deletingIncome?.id} ({deletingIncome?.contributor} - {formatINR(deletingIncome?.amount ?? 0)})
              </strong>
              ? This action will be processed via server API and removed from the database.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeletingIncome(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? 'Deleting…' : 'Delete Income'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
