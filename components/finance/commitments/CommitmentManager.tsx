'use client';

import { useState, useTransition, useMemo } from 'react';
import type { PersonalCommitmentRecord } from '@/lib/types';
import { formatINR } from '@/lib/calculations';
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
import { AddPersonalCommitmentDialog } from './AddPersonalCommitmentDialog';
import { EditCommitmentDialog } from './EditCommitmentDialog';
import { ViewModeToggle } from '../ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import {
  fetchPersonalCommitmentsData as fetchCommitmentsData,
  deletePersonalCommitment as deleteCommitment,
  updatePersonalCommitment,
} from '@/features/personal-commitments';
import { ExportCsvDialog, type ExportField } from '@/components/finance/export';
import { Checkbox } from '@/components/ui/checkbox';
import { SortableHeader, type SortState, TableSelectionBar } from '@/components/finance/table';
import { cn } from '@/lib/utils';

const COMMITMENT_EXPORT_FIELDS: ExportField<PersonalCommitmentRecord>[] = [
  {
    key: 'person_name',
    label: 'Person Name',
    group: 'Basic Details',
    accessor: (c) => c.person_name,
  },
  {
    key: 'mobile_number',
    label: 'Mobile Number',
    group: 'Basic Details',
    defaultSelected: true,
    accessor: (c) => c.mobile_number || '',
  },
  {
    key: 'caller_name',
    label: 'Caller / Follow-up By',
    group: 'Basic Details',
    defaultSelected: true,
    accessor: (c) => c.caller_name || '',
  },
  {
    key: 'promised',
    label: 'Promised Amount (₹)',
    group: 'Pledge & Financials',
    accessor: (c) => Number(c.promised),
  },
  {
    key: 'received',
    label: 'Received Amount (₹)',
    group: 'Pledge & Financials',
    accessor: (c) => Number(c.received),
  },
  {
    key: 'pending',
    label: 'Pending Amount (₹)',
    group: 'Pledge & Financials',
    accessor: (c) => Math.max(0, Number(c.promised) - Number(c.received)),
  },
  {
    key: 'status',
    label: 'Commitment Status',
    group: 'Status & Due Dates',
    accessor: (c) => c.status,
  },
  {
    key: 'money_type',
    label: 'Payment Mode',
    group: 'Pledge & Financials',
    defaultSelected: false,
    accessor: (c) => c.money_type || 'N/A',
  },
  {
    key: 'is_handed_over',
    label: 'Handover Status',
    group: 'Pledge & Financials',
    defaultSelected: false,
    accessor: (c) =>
      c.money_type === 'Cash'
        ? c.is_handed_over === false
          ? 'Pending'
          : 'Handed Over'
        : 'N/A (Digital)',
  },
  {
    key: 'due_date',
    label: 'Due Date',
    group: 'Status & Due Dates',
    defaultSelected: true,
    accessor: (c) => c.due_date || '',
  },
  {
    key: 'prayer_request',
    label: 'Prayer Request',
    group: 'Additional Info',
    defaultSelected: false,
    accessor: (c) => c.prayer_request || '',
  },
  {
    key: 'notes',
    label: 'Notes',
    group: 'Additional Info',
    defaultSelected: false,
    accessor: (c) => c.notes || '',
  },
  {
    key: 'id',
    label: 'Record ID',
    group: 'Audit & System',
    defaultSelected: false,
    accessor: (c) => c.id,
  },
  {
    key: 'created_at',
    label: 'Created At',
    group: 'Audit & System',
    defaultSelected: false,
    accessor: (c) => (c.created_at ? new Date(c.created_at).toLocaleString('en-IN') : ''),
  },
];

interface CommitmentManagerProps {
  initialCommitments: PersonalCommitmentRecord[];
}

export function CommitmentManager({ initialCommitments }: CommitmentManagerProps) {
  const [commitments, setCommitments] = useState<PersonalCommitmentRecord[]>(initialCommitments);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useViewMode('commitments');

  const [isRefreshing, startRefresh] = useTransition();
  const [editingCommitment, setEditingCommitment] = useState<PersonalCommitmentRecord | null>(null);
  const [deletingCommitment, setDeletingCommitment] = useState<PersonalCommitmentRecord | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  function formatDisplayDate(dateStr: string): string {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return dateStr;
    }
  }

  // Compute summary values
  const active = useMemo(
    () => commitments.filter((c) => c.status !== 'Cancelled'),
    [commitments]
  );
  const totalPromised = useMemo(
    () => active.reduce((s, c) => s + Number(c.promised), 0),
    [active]
  );
  const totalReceived = useMemo(
    () => active.reduce((s, c) => s + Number(c.received), 0),
    [active]
  );
  const totalPending = useMemo(
    () => active.reduce((s, c) => s + Math.max(0, Number(c.promised) - Number(c.received)), 0),
    [active]
  );
  const totalSurplus = useMemo(
    () => active.reduce((s, c) => s + Math.max(0, Number(c.received) - Number(c.promised)), 0),
    [active]
  );
  const fulfillmentPct = totalPromised > 0 ? Math.round((totalReceived / totalPromised) * 100) : 0;

  {/* Filtered list */}
  const filteredCommitments = useMemo(() => {
    return commitments.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.person_name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.mobile_number && c.mobile_number.includes(q)) ||
        (c.caller_name && c.caller_name.toLowerCase().includes(q)) ||
        (c.due_date && c.due_date.includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'Overdue'
          ? Boolean(c.due_date && c.due_date < todayStr && c.status !== 'Fully Received' && c.status !== 'Cancelled')
          : c.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [commitments, searchQuery, statusFilter, todayStr]);

  // Table Sorting
  const [sortState, setSortState] = useState<SortState<string>>({ field: 'id', direction: 'desc' });

  function handleSort(field: string) {
    setSortState((prev) => {
      if (prev.field === field) {
        if (prev.direction === 'asc') return { field, direction: 'desc' };
        if (prev.direction === 'desc') return { field: null, direction: null };
        return { field, direction: 'asc' };
      }
      return { field, direction: 'asc' };
    });
  }

  const sortedCommitments = useMemo(() => {
    if (!sortState.field || !sortState.direction) return filteredCommitments;
    const dir = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredCommitments].sort((a, b) => {
      if (sortState.field === 'promised') {
        return (Number(a.promised) - Number(b.promised)) * dir;
      }
      if (sortState.field === 'received') {
        return (Number(a.received) - Number(b.received)) * dir;
      }
      if (sortState.field === 'pending') {
        const pendingA = Math.max(0, Number(a.promised) - Number(a.received));
        const pendingB = Math.max(0, Number(b.promised) - Number(b.received));
        return (pendingA - pendingB) * dir;
      }
      const valA = String((a as unknown as Record<string, unknown>)[sortState.field!] ?? '').toLowerCase();
      const valB = String((b as unknown as Record<string, unknown>)[sortState.field!] ?? '').toLowerCase();
      return valA.localeCompare(valB) * dir;
    });
  }, [filteredCommitments, sortState]);

  // Selective Total State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedCommitments = useMemo(() => {
    return sortedCommitments.filter((c) => selectedIds.has(c.id));
  }, [sortedCommitments, selectedIds]);

  const selectiveCashReceived = useMemo(
    () => selectedCommitments.filter((c) => c.money_type === 'Cash').reduce((s, c) => s + Number(c.received), 0),
    [selectedCommitments]
  );
  const selectiveUpiReceived = useMemo(
    () => selectedCommitments.filter((c) => c.money_type === 'UPI').reduce((s, c) => s + Number(c.received), 0),
    [selectedCommitments]
  );
  const selectiveGrandTotal = selectiveCashReceived + selectiveUpiReceived;
  const selectivePromised = useMemo(
    () => selectedCommitments.reduce((s, c) => s + Number(c.promised), 0),
    [selectedCommitments]
  );
  const selectivePending = useMemo(
    () => selectedCommitments.reduce((s, c) => s + Math.max(0, Number(c.promised) - Number(c.received)), 0),
    [selectedCommitments]
  );

  // Filtered Totals for Table Footer
  const filteredCashReceived = useMemo(
    () => filteredCommitments.filter((c) => c.money_type === 'Cash').reduce((s, c) => s + Number(c.received), 0),
    [filteredCommitments]
  );
  const filteredUpiReceived = useMemo(
    () => filteredCommitments.filter((c) => c.money_type === 'UPI').reduce((s, c) => s + Number(c.received), 0),
    [filteredCommitments]
  );
  const filteredPromised = useMemo(
    () => filteredCommitments.reduce((s, c) => s + Number(c.promised), 0),
    [filteredCommitments]
  );
  const filteredReceived = useMemo(
    () => filteredCommitments.reduce((s, c) => s + Number(c.received), 0),
    [filteredCommitments]
  );
  const filteredPending = useMemo(
    () => filteredCommitments.reduce((s, c) => s + Math.max(0, Number(c.promised) - Number(c.received)), 0),
    [filteredCommitments]
  );

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (selectedIds.size === sortedCommitments.length && sortedCommitments.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCommitments.map((c) => c.id)));
    }
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  const isAllSelected = sortedCommitments.length > 0 && sortedCommitments.every((c) => selectedIds.has(c.id));
  const isSomeSelected = sortedCommitments.some((c) => selectedIds.has(c.id));

  // Handle Handover Toggle
  async function handleToggleHandover(com: PersonalCommitmentRecord) {
    const nextVal = com.is_handed_over === false ? true : false;
    try {
      await updatePersonalCommitment(com.id, { is_handed_over: nextVal });
      setCommitments((prev) =>
        prev.map((item) => (item.id === com.id ? { ...item, is_handed_over: nextVal } : item))
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
        const res = await fetchCommitmentsData();
        if (res.data) {
          setCommitments(res.data.commitments);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh commitments data.');
      }
    });
  }

  // Handle Delete
  async function handleDeleteConfirm() {
    if (!deletingCommitment?.id) return;
    setErrorMessage(null);

    startDelete(async () => {
      try {
        await deleteCommitment(deletingCommitment.id);
        setDeletingCommitment(null);
        handleRefresh();
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete commitment.');
      }
    });
  }

  const statusVariant = (s: string) => {
    if (s === 'Fully Received')
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (s === 'Partially Received')
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    if (s === 'Cancelled')
      return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Personal Commitments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Individual pledges and contributions powered by client-server API architecture
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
            title="Refresh commitments from server"
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

          <ExportCsvDialog
            title="Export Personal Commitments"
            description="Export individual pledges, received contributions, and pending balances to CSV."
            defaultFilename={`orah_personal_commitments_${new Date().toISOString().slice(0, 10)}.csv`}
            data={commitments}
            filteredData={filteredCommitments}
            fields={COMMITMENT_EXPORT_FIELDS}
            storageKey="personal_commitments"
          />

          <AddPersonalCommitmentDialog onSuccess={handleRefresh} />
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
            label: 'Total Promised',
            value: formatINR(totalPromised),
            subtext: `${active.length} Active Donors`,
            cls: 'text-foreground',
          },
          {
            label: 'Total Received',
            value: formatINR(totalReceived),
            subtext:
              totalSurplus > 0
                ? `${fulfillmentPct}% fulfilled (+${formatINR(totalSurplus)} surplus)`
                : `${fulfillmentPct}% fulfilled`,
            cls: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Still Pending',
            value: formatINR(totalPending),
            subtext: `${active.filter((c) => Number(c.received) < Number(c.promised)).length} donors pending`,
            cls: 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Collection Progress',
            value: `${fulfillmentPct}%`,
            subtext: `${active.filter((c) => c.status === 'Fully Received').length} fully collected`,
            cls: 'text-primary',
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
              placeholder="Search donor, mobile, note, or date..."
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
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center rounded-lg border border-border/50 bg-muted/20 p-1 text-xs">
            {['ALL', 'Pending', 'Overdue', 'Partially Received', 'Fully Received', 'Cancelled'].map((st) => {
              const overdueCount = active.filter(
                (c) => c.due_date && c.due_date < todayStr && c.status !== 'Fully Received'
              ).length;

              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
                    statusFilter === st
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {st === 'ALL' ? 'All' : st}
                  {st === 'Overdue' && overdueCount > 0 && (
                    <span className="ml-1 text-[10px] bg-rose-500/20 text-rose-600 dark:text-rose-400 px-1.5 py-0.2 rounded-full font-bold">
                      {overdueCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* View Mode Toggle */}
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCommitments.map((com) => {
            const pct =
              com.promised > 0
                ? Math.min(100, Math.round((Number(com.received) / Number(com.promised)) * 100))
                : 0;
            const pendingAmt = Math.max(0, Number(com.promised) - Number(com.received));

            return (
              <div
                key={com.id}
                className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between gap-3"
              >
                <div>
                  {/* Header: Status + Caller */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium truncate ${statusVariant(
                          com.status
                        )}`}
                      >
                        {com.status}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {com.id}
                      </span>
                    </div>

                    {com.caller_name && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[11px] font-medium shrink-0">
                        {com.caller_name}
                      </span>
                    )}
                  </div>

                  {/* Person Name & Receipt */}
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-foreground text-sm leading-snug truncate" title={com.person_name}>
                        {com.person_name}
                      </h3>
                      {com.screenshot_link && (
                        <a
                          href={com.screenshot_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[10px] text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded font-mono shrink-0"
                          title="View Payment Screenshot"
                        >
                          Receipt ↗
                        </a>
                      )}
                    </div>

                    {com.mobile_number && (
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        {com.mobile_number}
                      </p>
                    )}
                  </div>

                  {/* Due Date Indicator */}
                  {com.due_date && (
                    <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
                      {com.status !== 'Fully Received' && com.status !== 'Cancelled' ? (
                        com.due_date < todayStr ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            Overdue: Follow up by {formatDisplayDate(com.due_date)}
                          </span>
                        ) : com.due_date === todayStr ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                            Due Today ({formatDisplayDate(com.due_date)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            Promised by: {formatDisplayDate(com.due_date)}
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                          ✓ Pledged for {formatDisplayDate(com.due_date)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Financial Breakdown */}
                  <div className="rounded-xl bg-muted/30 p-2.5 space-y-2 mb-3">
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Promised</span>
                        <span className="text-xs font-semibold text-foreground">
                          {formatINR(com.promised)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Received</span>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatINR(com.received)}
                        </span>
                        {Number(com.received) > Number(com.promised) && (
                          <span className="block text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1 py-0.5 rounded mt-0.5">
                            +{formatINR(Number(com.received) - Number(com.promised))} surplus
                          </span>
                        )}
                        {com.received > 0 && com.money_type === 'Cash' && (
                          <button
                            type="button"
                            onClick={() => handleToggleHandover(com)}
                            title={com.is_handed_over === false ? 'Click to mark as Handed Over to Finance' : 'Click to mark as Pending Handover'}
                            className={`block text-[9px] font-medium mt-0.5 px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                              com.is_handed_over === false
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                            }`}
                          >
                            {com.is_handed_over === false ? '⏳ Pending Handover' : '✓ Cash In Hand'}
                          </button>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Pending</span>
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                          {formatINR(pendingAmt)}
                        </span>
                      </div>
                    </div>

                    {/* Mini Progress */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Fulfillment</span>
                        <span className="font-medium text-foreground">
                          {pct}% {pct > 100 && '🎉'}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, pct)}
                        className={`h-1.5 ${
                          com.status === 'Fully Received'
                            ? '[&>div]:bg-emerald-500'
                            : com.status === 'Partially Received'
                            ? '[&>div]:bg-amber-500'
                            : '[&>div]:bg-rose-500'
                        }`}
                      />
                    </div>
                  </div>

                  {com.notes && (
                    <p className="text-[11px] text-muted-foreground italic line-clamp-2" title={com.notes}>
                      “{com.notes}”
                    </p>
                  )}
                </div>

                {/* Card Footer: Actions */}
                <div className="flex items-center justify-end gap-1 pt-2 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setEditingCommitment(com)}
                    className="text-xs h-7 px-2"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setDeletingCommitment(com)}
                    className="text-xs h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}

          {filteredCommitments.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border/80 p-8 text-center">
              <p className="text-sm font-medium text-foreground">No commitments found.</p>
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
                  <th className="w-10 px-3 py-3 text-center">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <SortableHeader field="id" currentSort={sortState} onSort={handleSort}>
                    ID
                  </SortableHeader>
                  <SortableHeader field="person_name" currentSort={sortState} onSort={handleSort}>
                    Person Name
                  </SortableHeader>
                  <SortableHeader field="mobile_number" currentSort={sortState} onSort={handleSort}>
                    Mobile
                  </SortableHeader>
                  <SortableHeader field="caller_name" currentSort={sortState} onSort={handleSort}>
                    Caller
                  </SortableHeader>
                  <SortableHeader field="due_date" currentSort={sortState} onSort={handleSort}>
                    Promised By
                  </SortableHeader>
                  <SortableHeader field="promised" currentSort={sortState} onSort={handleSort}>
                    Promised
                  </SortableHeader>
                  <SortableHeader field="received" currentSort={sortState} onSort={handleSort}>
                    Received
                  </SortableHeader>
                  <SortableHeader field="pending" currentSort={sortState} onSort={handleSort}>
                    Pending
                  </SortableHeader>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Progress
                  </th>
                  <SortableHeader field="status" currentSort={sortState} onSort={handleSort}>
                    Status
                  </SortableHeader>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sortedCommitments.map((com) => {
                  const pct =
                    com.promised > 0
                      ? Math.round((Number(com.received) / Number(com.promised)) * 100)
                      : 0;
                  const pendingAmt = Math.max(0, Number(com.promised) - Number(com.received));
                  const isSelected = selectedIds.has(com.id);

                  return (
                    <tr
                      key={com.id}
                      className={cn(
                        'transition-colors hover:bg-muted/20',
                        isSelected && 'bg-primary/5'
                      )}
                    >
                      <td className="w-10 px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(com.id)}
                          aria-label={`Select ${com.person_name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {com.id}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{com.person_name}</span>
                          {com.screenshot_link && (
                            <a
                              href={com.screenshot_link}
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
                        {com.mobile_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">
                        {com.caller_name ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                            {com.caller_name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {com.due_date ? (
                          com.status !== 'Fully Received' && com.status !== 'Cancelled' ? (
                            com.due_date < todayStr ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/25">
                                ⚠️ {formatDisplayDate(com.due_date)}
                              </span>
                            ) : com.due_date === todayStr ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25">
                                🔔 Today
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-medium">
                                {formatDisplayDate(com.due_date)}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground line-through text-[11px]">
                              {formatDisplayDate(com.due_date)}
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">
                        {formatINR(com.promised)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span>{formatINR(com.received)}</span>
                          {Number(com.received) > Number(com.promised) && (
                            <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-1 py-0.5 rounded">
                              +{formatINR(Number(com.received) - Number(com.promised))}
                            </span>
                          )}
                          {com.received > 0 && com.money_type && (
                            <button
                              type="button"
                              onClick={() => handleToggleHandover(com)}
                              title={com.is_handed_over === false ? 'Click to mark as Handed Over to Finance' : 'Click to mark as Pending Handover'}
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                                com.money_type === 'Cash' && com.is_handed_over === false
                                   ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 hover:bg-amber-200'
                                  : 'bg-muted text-muted-foreground hover:bg-accent'
                              }`}
                            >
                              {com.money_type}
                              {com.money_type === 'Cash' && (com.is_handed_over === false ? ' (⏳ Pending)' : ' (✓ Handed)')}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-rose-600 dark:text-rose-400">
                        {formatINR(pendingAmt)}
                      </td>
                      <td className="px-4 py-3 w-32">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(100, pct)}
                            className={`h-1.5 flex-1 ${
                              com.status === 'Fully Received'
                                ? '[&>div]:bg-emerald-500'
                                : com.status === 'Partially Received'
                                ? '[&>div]:bg-amber-500'
                                : '[&>div]:bg-rose-500'
                            }`}
                          />
                          <span className="text-xs text-muted-foreground w-8 text-right font-medium">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${statusVariant(
                            com.status
                          )}`}
                        >
                          {com.status}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate"
                        title={com.notes || ''}
                      >
                        {com.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setEditingCommitment(com)}
                            className="text-xs"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setDeletingCommitment(com)}
                            className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {sortedCommitments.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No commitments found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/30 font-semibold">
                  <td colSpan={6} className="px-4 py-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-foreground">
                        Total ({filteredCommitments.length} {filteredCommitments.length === 1 ? 'record' : 'records'})
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        Cash: {formatINR(filteredCashReceived)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                        UPI: {formatINR(filteredUpiReceived)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-foreground/5 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                        Total Received (CASH+UPI): {formatINR(filteredCashReceived + filteredUpiReceived)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-foreground whitespace-nowrap">
                    {formatINR(filteredPromised)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {formatINR(filteredReceived)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {formatINR(filteredPending)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <EditCommitmentDialog
        commitment={editingCommitment}
        open={Boolean(editingCommitment)}
        onOpenChange={(open) => {
          if (!open) setEditingCommitment(null);
        }}
        onSuccess={handleRefresh}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingCommitment)}
        onOpenChange={(open) => {
          if (!open) setDeletingCommitment(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Commitment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete commitment{' '}
              <strong className="text-foreground">
                {deletingCommitment?.id} ({deletingCommitment?.person_name})
              </strong>
              ? This action will be processed via server API and removed from the database.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeletingCommitment(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? 'Deleting…' : 'Delete Commitment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Selective Total Bar */}
      <TableSelectionBar
        selectedCount={selectedIds.size}
        totalFilteredCount={sortedCommitments.length}
        cashTotal={selectiveCashReceived}
        upiTotal={selectiveUpiReceived}
        grandTotal={selectiveGrandTotal}
        extraTotalLabel="Pending"
        extraTotalAmount={selectivePending}
        onSelectAll={handleToggleSelectAll}
        onClear={handleClearSelection}
        isAllSelected={isAllSelected}
      />
    </div>
  );
}
