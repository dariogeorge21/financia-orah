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
import { ViewModeToggle } from './ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { fetchPersonalCommitmentsData as fetchCommitmentsData, deletePersonalCommitment as deleteCommitment } from '@/features/personal-commitments';

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
  const totalPending = Math.max(0, totalPromised - totalReceived);
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
            (c.notes && c.notes.toLowerCase().includes(q));

          const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;

          return matchesSearch && matchesStatus;
        });
      }, [commitments, searchQuery, statusFilter]);

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
            subtext: `${fulfillmentPct}% fulfilled`,
            cls: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Still Pending',
            value: formatINR(totalPending),
            subtext: `${active.filter((c) => c.status !== 'Fully Received').length} donors pending`,
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
              placeholder="Search donor name, mobile, or note..."
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
            {['ALL', 'Pending', 'Partially Received', 'Fully Received', 'Cancelled'].map((st) => (
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
                  <div className="mb-3">
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
                        {com.received > 0 && com.money_type === 'Cash' && (
                          <span
                            className={`block text-[9px] font-medium mt-0.5 ${
                              com.is_handed_over === false
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {com.is_handed_over === false ? 'Pending Handover' : 'Cash In Hand'}
                          </span>
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
                        <span className="font-medium text-foreground">{pct}%</span>
                      </div>
                      <Progress
                        value={pct}
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
                  {['ID', 'Person Name', 'Mobile', 'Caller', 'Promised', 'Received', 'Pending', 'Progress', 'Status', 'Notes', 'Actions'].map((h) => (
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
                {filteredCommitments.map((com) => {
                  const pct =
                    com.promised > 0
                      ? Math.min(100, Math.round((Number(com.received) / Number(com.promised)) * 100))
                      : 0;
                  const pendingAmt = Math.max(0, Number(com.promised) - Number(com.received));

                  return (
                    <tr key={com.id} className="transition-colors hover:bg-muted/20">
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
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">
                        {formatINR(com.promised)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span>{formatINR(com.received)}</span>
                          {com.received > 0 && com.money_type && (
                            <span
                              className={`text-[10px] font-mono px-1 rounded ${
                                com.money_type === 'Cash' && com.is_handed_over === false
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {com.money_type}
                              {com.money_type === 'Cash' && com.is_handed_over === false && ' (Pending)'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-rose-600 dark:text-rose-400">
                        {formatINR(pendingAmt)}
                      </td>
                      <td className="px-4 py-3 w-32">
                        <div className="flex items-center gap-2">
                          <Progress
                            value={pct}
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

                {filteredCommitments.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No commitments found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-sm">
                    Total ({active.length} Active)
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-foreground">
                    {formatINR(totalPromised)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatINR(totalReceived)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-400">
                    {formatINR(totalPending)}
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
    </div>
  );
}
