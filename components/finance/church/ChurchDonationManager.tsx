'use client';

import { useState, useTransition, useMemo } from 'react';
import type { ChurchDonationRecord, MoneyType } from '@/lib/types';
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
import { AddChurchDonationDialog } from './AddChurchDonationDialog';
import { EditChurchDonationDialog } from './EditChurchDonationDialog';
import { ViewModeToggle } from '../ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { fetchChurchDonationsData, deleteChurchDonation, updateChurchDonation } from '@/features/church-donations';

interface ChurchDonationManagerProps {
  initialDonations: ChurchDonationRecord[];
}

export function ChurchDonationManager({ initialDonations }: ChurchDonationManagerProps) {
  const [donations, setDonations] = useState<ChurchDonationRecord[]>(initialDonations);
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useViewMode('church_donations');

  const [isRefreshing, startRefresh] = useTransition();
  const [editingDonation, setEditingDonation] = useState<ChurchDonationRecord | null>(null);
  const [deletingDonation, setDeletingDonation] = useState<ChurchDonationRecord | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute live filtered donations
  const filteredDonations = useMemo(() => {
    return donations.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        d.church_name.toLowerCase().includes(q) ||
        (d.contact_number && d.contact_number.toLowerCase().includes(q)) ||
        (d.collected_by && d.collected_by.toLowerCase().includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q)) ||
        d.id.toLowerCase().includes(q);

      const matchMode = modeFilter === 'ALL' || d.money_type === modeFilter;

      return matchSearch && matchMode;
    });
  }, [donations, searchQuery, modeFilter]);

  // Aggregate metrics
  const totalAmount = useMemo(() => {
    return donations.reduce((sum, d) => sum + Number(d.amount), 0);
  }, [donations]);

  const cashAmount = useMemo(() => {
    return donations.filter((d) => d.money_type === 'Cash').reduce((sum, d) => sum + Number(d.amount), 0);
  }, [donations]);

  const cashHandedOver = useMemo(() => {
    return donations
      .filter((d) => d.money_type === 'Cash' && d.is_handed_over !== false)
      .reduce((sum, d) => sum + Number(d.amount), 0);
  }, [donations]);

  const cashPending = useMemo(() => {
    return donations
      .filter((d) => d.money_type === 'Cash' && d.is_handed_over === false)
      .reduce((sum, d) => sum + Number(d.amount), 0);
  }, [donations]);

  const upiAmount = useMemo(() => {
    return donations.filter((d) => d.money_type === 'UPI').reduce((sum, d) => sum + Number(d.amount), 0);
  }, [donations]);

  async function handleToggleHandover(donation: ChurchDonationRecord) {
    const nextVal = donation.is_handed_over === false ? true : false;
    try {
      await updateChurchDonation(donation.id, { is_handed_over: nextVal });
      setDonations((prev) =>
        prev.map((d) => (d.id === donation.id ? { ...d, is_handed_over: nextVal } : d))
      );
      handleRefresh();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update handover status.');
    }
  }

  function handleRefresh() {
    startRefresh(async () => {
      try {
        setErrorMessage(null);
        const res = await fetchChurchDonationsData();
        if (res.data?.donations) {
          setDonations(res.data.donations);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh church donations.');
      }
    });
  }

  function confirmDelete() {
    if (!deletingDonation) return;
    startDelete(async () => {
      try {
        setErrorMessage(null);
        await deleteChurchDonation(deletingDonation.id);
        setDeletingDonation(null);
        handleRefresh();
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete donation.');
      }
    });
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Church Donations */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Church Funds</span>
            <span className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {donations.length} Contributions
            </span>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {formatINR(totalAmount)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            From churches & convents
          </div>
        </div>

        {/* Cash Collections */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Cash Donations</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-2xl">
            {formatINR(cashAmount)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {cashPending > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                In Hand: {formatINR(cashHandedOver)} • Pending: {formatINR(cashPending)}
              </span>
            ) : (
              `${donations.filter((d) => d.money_type === 'Cash').length} cash payments`
            )}
          </div>
        </div>

        {/* UPI Collections */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>UPI / Bank Donations</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 sm:text-2xl">
            {formatINR(upiAmount)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {donations.filter((d) => d.money_type === 'UPI').length} online transfers
          </div>
        </div>

        {/* Average Contribution */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Average per Parish</span>
            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              AVG
            </span>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {formatINR(donations.length > 0 ? totalAmount / donations.length : 0)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Auto-synced to Income ledger
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <svg
              className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <Input
              placeholder="Search church, convent, volunteer..."
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
          {/* Mode Filter */}
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

          {/* View Mode Toggle */}
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs h-8"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          <AddChurchDonationDialog onSuccess={handleRefresh} />
        </div>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDonations.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between gap-3"
            >
              <div>
                {/* Header: ID + Mode + Date */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {d.id}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {d.money_type === 'Cash' ? (
                      d.is_handed_over === false ? (
                        <button
                          type="button"
                          onClick={() => handleToggleHandover(d)}
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
                    <span className="text-xs text-muted-foreground">{d.date}</span>
                  </div>
                </div>

                {/* Church Name & Amount */}
                <div className="mb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-foreground text-sm leading-snug truncate" title={d.church_name}>
                      {d.church_name}
                    </h3>
                    {d.screenshot_link && (
                      <a
                        href={d.screenshot_link}
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
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      +{formatINR(d.amount)}
                    </span>
                    {d.contact_number && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {d.contact_number}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Footer: Volunteer & Notes */}
                {(d.collected_by || d.notes) && (
                  <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t border-border/40">
                    {d.collected_by && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-muted-foreground">Collector:</span>
                        <span className="font-medium text-foreground">{d.collected_by}</span>
                      </div>
                    )}
                    {d.notes && (
                      <p className="text-[11px] text-muted-foreground italic line-clamp-2" title={d.notes}>
                        “{d.notes}”
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
                  onClick={() => setEditingDonation(d)}
                  className="text-xs h-7 px-2"
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setDeletingDonation(d)}
                  className="text-xs h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}

          {filteredDonations.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border/80 p-8 text-center">
              <p className="text-sm font-medium text-foreground">No church or convent donations found.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your search query or filters.
              </p>
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
                  {['ID', 'Date', 'Church / Convent Name', 'Contact Number', 'Collected By', 'Amount', 'Money Type', 'Notes', 'Actions'].map(
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
                {filteredDonations.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {d.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                      {d.date}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{d.church_name}</span>
                        {d.screenshot_link && (
                          <a
                            href={d.screenshot_link}
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
                      {d.contact_number || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {d.collected_by ? (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">
                          {d.collected_by}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatINR(d.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.money_type === 'Cash' ? (
                        d.is_handed_over === false ? (
                          <button
                            type="button"
                            onClick={() => handleToggleHandover(d)}
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
                    <td
                      className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate"
                      title={d.notes || ''}
                    >
                      {d.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setEditingDonation(d)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setDeletingDonation(d)}
                          className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredDonations.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No church or convent donation records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20 font-semibold">
                  <td colSpan={5} className="px-4 py-3 text-sm text-foreground">
                    Total Church Funds ({filteredDonations.length} records)
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatINR(filteredDonations.reduce((s, d) => s + Number(d.amount), 0))}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Edit Donation Dialog */}
      <EditChurchDonationDialog
        donation={editingDonation}
        open={Boolean(editingDonation)}
        onOpenChange={(open) => {
          if (!open) setEditingDonation(null);
        }}
        onSuccess={handleRefresh}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingDonation)}
        onOpenChange={(open) => {
          if (!open) setDeletingDonation(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Donation Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the donation <strong className="text-foreground">{deletingDonation?.id}</strong> from{' '}
              <strong className="text-foreground">{deletingDonation?.church_name}</strong> ({formatINR(deletingDonation?.amount ?? 0)})?
              The corresponding entry in the Income ledger will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingDonation(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
