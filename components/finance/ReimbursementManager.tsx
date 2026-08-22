'use client';

import { useState, useTransition, useMemo } from 'react';
import type { ReimbursementRecord, ReimbursementStatus, MoneyType } from '@/lib/types';
import { formatINR } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddReimbursementDialog } from './AddReimbursementDialog';
import { EditReimbursementDialog } from './EditReimbursementDialog';
import {
  fetchReimbursementsData,
  updateReimbursement,
  deleteReimbursement,
} from '@/features/reimbursements';

interface ReimbursementManagerProps {
  initialReimbursements: ReimbursementRecord[];
}

export function ReimbursementManager({ initialReimbursements }: ReimbursementManagerProps) {
  const [reimbursements, setReimbursements] =
    useState<ReimbursementRecord[]>(initialReimbursements);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');

  const [isRefreshing, startRefresh] = useTransition();
  const [editingReimbursement, setEditingReimbursement] = useState<ReimbursementRecord | null>(
    null
  );
  const [deletingReimbursement, setDeletingReimbursement] = useState<ReimbursementRecord | null>(
    null
  );
  const [settlingReimbursement, setSettlingReimbursement] = useState<ReimbursementRecord | null>(
    null
  );
  const [settleMode, setSettleMode] = useState<MoneyType>('UPI');
  const [isSettling, startSettle] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute summary values
  const paidTotal = useMemo(
    () =>
      reimbursements
        .filter((r) => r.status === 'Paid')
        .reduce((s, r) => s + Number(r.amount), 0),
    [reimbursements]
  );
  const pendingTotal = useMemo(
    () =>
      reimbursements
        .filter((r) => r.status === 'Pending')
        .reduce((s, r) => s + Number(r.amount), 0),
    [reimbursements]
  );
  const totalClaims = paidTotal + pendingTotal;
  const settlementPct =
    totalClaims > 0 ? Math.round((paidTotal / totalClaims) * 100) : 0;

  // Filtered list
  const filteredReimbursements = useMemo(() => {
    return reimbursements.filter((r) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        r.id.toLowerCase().includes(q) ||
        r.person.toLowerCase().includes(q) ||
        r.expense_id.toLowerCase().includes(q) ||
        (r.mobile_number && r.mobile_number.includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const matchesMode =
        modeFilter === 'ALL' ||
        (modeFilter === 'Cash' && r.money_type_paid === 'Cash') ||
        (modeFilter === 'UPI' && r.money_type_paid === 'UPI');

      return matchesSearch && matchesStatus && matchesMode;
    });
  }, [reimbursements, searchQuery, statusFilter, modeFilter]);

  // Refresh via API
  function handleRefresh() {
    setErrorMessage(null);
    startRefresh(async () => {
      try {
        const res = await fetchReimbursementsData();
        if (res.data) {
          setReimbursements(res.data.reimbursements);
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to refresh reimbursements data.'
        );
      }
    });
  }

  // Handle Quick Settle
  async function handleSettleConfirm() {
    if (!settlingReimbursement?.id) return;
    setErrorMessage(null);

    startSettle(async () => {
      try {
        await updateReimbursement(settlingReimbursement.id, {
          status: 'Paid' as ReimbursementStatus,
          money_type_paid: settleMode,
        });
        setSettlingReimbursement(null);
        handleRefresh();
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to settle reimbursement.'
        );
      }
    });
  }

  // Handle Delete
  async function handleDeleteConfirm() {
    if (!deletingReimbursement?.id) return;
    setErrorMessage(null);

    startDelete(async () => {
      try {
        await deleteReimbursement(deletingReimbursement.id);
        setDeletingReimbursement(null);
        handleRefresh();
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to delete reimbursement.'
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reimbursements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personal expenses pending settlement and reimbursement powered by client-server API
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
            title="Refresh reimbursements from server"
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

          <AddReimbursementDialog onSuccess={handleRefresh} />
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
            label: 'Total Claims',
            value: formatINR(totalClaims),
            subtext: `${reimbursements.length} Claims Logged`,
            cls: 'text-foreground',
          },
          {
            label: 'Settled / Paid',
            value: formatINR(paidTotal),
            subtext: `${settlementPct}% settled`,
            cls: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Pending Settlement',
            value: formatINR(pendingTotal),
            subtext: `${reimbursements.filter((r) => r.status === 'Pending').length} pending`,
            cls: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Settlement Rate',
            value: `${settlementPct}%`,
            subtext: `${reimbursements.filter((r) => r.status === 'Paid').length} paid out`,
            cls: 'text-cyan-600 dark:text-cyan-400',
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
              placeholder="Search person, EXP-ID, mobile, note..."
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
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/20 p-1 text-xs">
            {['ALL', 'Pending', 'Paid'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st}
              </button>
            ))}
          </div>

          {/* Mode Filter Buttons */}
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/20 p-1 text-xs">
            {['ALL', 'Cash', 'UPI'].map((m) => (
              <button
                key={m}
                onClick={() => setModeFilter(m)}
                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                  modeFilter === m
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'ALL' ? 'All Modes' : m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {['ID', 'Date', 'Person', 'Mobile', 'Expense ID', 'Amount', 'Status', 'Paid Via', 'Notes', 'Actions'].map(
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
              {filteredReimbursements.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {r.id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                    {r.date}
                  </td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                    {r.person}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {r.mobile_number || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-primary whitespace-nowrap">
                    {r.expense_id}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold text-foreground">
                    {formatINR(r.amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge
                      variant={r.status === 'Paid' ? 'default' : 'outline'}
                      className={`text-xs ${
                        r.status === 'Paid'
                          ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                          : 'text-amber-600 border-amber-500/30 dark:text-amber-400'
                      }`}
                    >
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.money_type_paid ? (
                      <Badge variant="secondary" className="text-xs">
                        {r.money_type_paid}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate"
                    title={r.notes || ''}
                  >
                    {r.notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === 'Pending' && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setSettlingReimbursement(r)}
                          className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        >
                          Settle
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditingReimbursement(r)}
                        className="text-xs"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setDeletingReimbursement(r)}
                        className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredReimbursements.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No reimbursement records found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20 font-semibold">
                <td colSpan={5} className="px-4 py-3 text-sm text-foreground">
                  Pending Settlement Total
                </td>
                <td className="px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400">
                  {formatINR(pendingTotal)}
                </td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditReimbursementDialog
        reimbursement={editingReimbursement}
        open={Boolean(editingReimbursement)}
        onOpenChange={(open) => {
          if (!open) setEditingReimbursement(null);
        }}
        onSuccess={handleRefresh}
      />

      {/* Quick Settle Confirmation Dialog */}
      <Dialog
        open={Boolean(settlingReimbursement)}
        onOpenChange={(open) => {
          if (!open) setSettlingReimbursement(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Claim as Settled / Paid</DialogTitle>
            <DialogDescription>
              Confirm reimbursement payment of{' '}
              <strong className="text-foreground">
                {formatINR(settlingReimbursement?.amount ?? 0)}
              </strong>{' '}
              to <strong className="text-foreground">{settlingReimbursement?.person}</strong> for{' '}
              <strong className="text-primary">{settlingReimbursement?.expense_id}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-medium text-muted-foreground">Payment Mode</label>
            <Select value={settleMode} onValueChange={(v) => setSettleMode(v as MoneyType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UPI">UPI / Online Transfer</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSettling}
              onClick={() => setSettlingReimbursement(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSettling}
              onClick={handleSettleConfirm}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSettling ? 'Settling…' : 'Confirm Settlement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingReimbursement)}
        onOpenChange={(open) => {
          if (!open) setDeletingReimbursement(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Reimbursement Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete reimbursement claim{' '}
              <strong className="text-foreground">
                {deletingReimbursement?.id} ({deletingReimbursement?.person} - {formatINR(deletingReimbursement?.amount ?? 0)})
              </strong>
              ? This action will be processed via server API and removed from the database.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setDeletingReimbursement(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              {isDeleting ? 'Deleting…' : 'Delete Reimbursement'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
