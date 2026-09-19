'use client';

import { useState, useTransition, useMemo } from 'react';
import type { CouponRecord, CouponPaymentMode } from '@/lib/types';
import { formatINR, calcCouponSummary } from '@/lib/calculations';
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
import { AddCouponDialog } from './AddCouponDialog';
import { EditCouponDialog } from './EditCouponDialog';
import { ViewModeToggle } from '../ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { fetchCouponsData, deleteCoupon, updateCoupon } from '@/features/coupons';
import { ExportCsvDialog, type ExportField } from '@/components/finance/export';
import { Checkbox } from '@/components/ui/checkbox';
import { SortableHeader, type SortState, TableSelectionBar } from '@/components/finance/table';
import { cn } from '@/lib/utils';

const COUPON_EXPORT_FIELDS: ExportField<CouponRecord>[] = [
  {
    key: 'date',
    label: 'Date',
    group: 'Basic Details',
    accessor: (c) => c.date,
  },
  {
    key: 'contributor_name',
    label: 'Contributor Name',
    group: 'Basic Details',
    accessor: (c) => c.contributor_name,
  },
  {
    key: 'mobile_number',
    label: 'Mobile Number',
    group: 'Basic Details',
    defaultSelected: true,
    accessor: (c) => c.mobile_number || '',
  },
  {
    key: 'amount',
    label: 'Total Amount (₹)',
    group: 'Financials',
    accessor: (c) => Number(c.amount),
  },
  {
    key: 'money_type',
    label: 'Payment Mode',
    group: 'Financials',
    accessor: (c) => c.money_type,
  },
  {
    key: 'cash_amount',
    label: 'Cash Portion (₹)',
    group: 'Financials',
    defaultSelected: false,
    accessor: (c) =>
      c.money_type === 'Cash'
        ? Number(c.amount)
        : c.cash_amount != null
        ? Number(c.cash_amount)
        : '',
  },
  {
    key: 'upi_amount',
    label: 'UPI Portion (₹)',
    group: 'Financials',
    defaultSelected: false,
    accessor: (c) =>
      c.money_type === 'UPI'
        ? Number(c.amount)
        : c.upi_amount != null
        ? Number(c.upi_amount)
        : '',
  },
  {
    key: 'is_handed_over',
    label: 'Handover Status (Cash)',
    group: 'Financials',
    accessor: (c) =>
      c.money_type === 'Cash' || c.money_type === 'Cash + UPI'
        ? c.is_handed_over === false
          ? 'Pending'
          : 'Handed Over'
        : 'N/A (Digital)',
  },
  {
    key: 'booklet_number',
    label: 'Booklet Number',
    group: 'Coupon Details',
    defaultSelected: true,
    accessor: (c) => c.booklet_number || '',
  },
  {
    key: 'collected_by',
    label: 'Collected By (Volunteer)',
    group: 'Coupon Details',
    defaultSelected: true,
    accessor: (c) => c.collected_by || '',
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
    label: 'Notes / Remarks',
    group: 'Additional Info',
    defaultSelected: false,
    accessor: (c) => c.notes || '',
  },
  {
    key: 'id',
    label: 'Coupon ID',
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

interface CouponManagerProps {
  initialCoupons: CouponRecord[];
}

export function CouponManager({ initialCoupons }: CouponManagerProps) {
  const [coupons, setCoupons] = useState<CouponRecord[]>(initialCoupons);
  const [searchQuery, setSearchQuery] = useState('');
  const [moneyTypeFilter, setMoneyTypeFilter] = useState<'ALL' | CouponPaymentMode>('ALL');
  const [viewMode, setViewMode] = useViewMode('coupons');

  const [isRefreshing, startRefresh] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [editingCoupon, setEditingCoupon] = useState<CouponRecord | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<CouponRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtered List
  const filteredCoupons = useMemo(() => {
    return coupons.filter((c) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        c.contributor_name.toLowerCase().includes(q) ||
        (c.mobile_number && c.mobile_number.includes(q)) ||
        (c.collected_by && c.collected_by.toLowerCase().includes(q)) ||
        (c.booklet_number && c.booklet_number.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q)) ||
        c.id.toLowerCase().includes(q);

      const matchesType =
        moneyTypeFilter === 'ALL' || c.money_type === moneyTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [coupons, searchQuery, moneyTypeFilter]);

  // Aggregate Metrics using central calcCouponSummary
  const summary = useMemo(() => calcCouponSummary(coupons), [coupons]);
  const totalAmount = summary.totalAmount;
  const cashAmount = summary.cashAmount;
  const cashHandedOver = summary.cashHandedOver;
  const cashPending = summary.cashPending;
  const upiAmount = summary.upiAmount;
  const splitCount = summary.splitCount;

  // Table Sorting
  const [sortState, setSortState] = useState<SortState<string>>({ field: 'date', direction: 'desc' });

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

  const sortedCoupons = useMemo(() => {
    if (!sortState.field || !sortState.direction) return filteredCoupons;
    const dir = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredCoupons].sort((a, b) => {
      if (sortState.field === 'amount') {
        return (Number(a.amount) - Number(b.amount)) * dir;
      }
      if (sortState.field === 'date') {
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
      }
      const valA = String((a as unknown as Record<string, unknown>)[sortState.field!] ?? '').toLowerCase();
      const valB = String((b as unknown as Record<string, unknown>)[sortState.field!] ?? '').toLowerCase();
      return valA.localeCompare(valB) * dir;
    });
  }, [filteredCoupons, sortState]);

  // Selective Total State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedCoupons = useMemo(() => {
    return sortedCoupons.filter((c) => selectedIds.has(c.id));
  }, [sortedCoupons, selectedIds]);

  const selectiveCashTotal = useMemo(
    () =>
      selectedCoupons.reduce((sum, c) => {
        if (c.money_type === 'Cash') return sum + Number(c.amount);
        if (c.money_type === 'Cash + UPI') return sum + Number(c.cash_amount ?? 0);
        return sum;
      }, 0),
    [selectedCoupons]
  );
  const selectiveUpiTotal = useMemo(
    () =>
      selectedCoupons.reduce((sum, c) => {
        if (c.money_type === 'UPI') return sum + Number(c.amount);
        if (c.money_type === 'Cash + UPI') return sum + Number(c.upi_amount ?? 0);
        return sum;
      }, 0),
    [selectedCoupons]
  );
  const selectiveGrandTotal = useMemo(
    () => selectedCoupons.reduce((sum, c) => sum + Number(c.amount), 0),
    [selectedCoupons]
  );

  // Filtered Summary Totals for Table Footer
  const filteredCashTotal = useMemo(
    () =>
      filteredCoupons.reduce((sum, c) => {
        if (c.money_type === 'Cash') return sum + Number(c.amount);
        if (c.money_type === 'Cash + UPI') return sum + Number(c.cash_amount ?? 0);
        return sum;
      }, 0),
    [filteredCoupons]
  );
  const filteredUpiTotal = useMemo(
    () =>
      filteredCoupons.reduce((sum, c) => {
        if (c.money_type === 'UPI') return sum + Number(c.amount);
        if (c.money_type === 'Cash + UPI') return sum + Number(c.upi_amount ?? 0);
        return sum;
      }, 0),
    [filteredCoupons]
  );
  const filteredGrandTotal = useMemo(
    () => filteredCoupons.reduce((sum, c) => sum + Number(c.amount), 0),
    [filteredCoupons]
  );

  const isAllSelected = sortedCoupons.length > 0 && selectedCoupons.length === sortedCoupons.length;

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedCoupons.map((c) => c.id)));
    }
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  async function handleToggleHandover(coupon: CouponRecord) {
    const nextVal = coupon.is_handed_over === false ? true : false;
    try {
      await updateCoupon(coupon.id, { is_handed_over: nextVal });
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_handed_over: nextVal } : c))
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
        const res = await fetchCouponsData();
        if (res.data?.coupons) {
          setCoupons(res.data.coupons);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh coupons.');
      }
    });
  }

  function confirmDelete() {
    if (!deletingCoupon) return;
    startDelete(async () => {
      try {
        setErrorMessage(null);
        await deleteCoupon(deletingCoupon.id);
        setDeletingCoupon(null);
        handleRefresh();
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete coupon.');
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
        {/* Total Collections */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Collections</span>
            <span className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              {coupons.length} Total
            </span>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {formatINR(totalAmount)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span>From {coupons.length} coupon receipts</span>
            {splitCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px]">
                {splitCount} Split (Cash+UPI)
              </span>
            )}
          </div>
        </div>

        {/* Cash Collections */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Cash Collection</span>
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
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                All Cash In Hand: {formatINR(cashHandedOver)}
              </span>
            )}
          </div>
        </div>

        {/* UPI Collections */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>UPI Collection</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 sm:text-2xl">
            {formatINR(upiAmount)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {formatINR(upiAmount)} in bank transfers
          </div>
        </div>

        {/* Average Contribution */}
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Average per Coupon</span>
            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              AVG
            </span>
          </div>
          <div className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {formatINR(coupons.length > 0 ? totalAmount / coupons.length : 0)}
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
              placeholder="Search contributor, booklet #, volunteer..."
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
            {(['ALL', 'Cash', 'UPI', 'Cash + UPI'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMoneyTypeFilter(m)}
                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                  moneyTypeFilter === m
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

          <ExportCsvDialog
            title="Export Coupon Collections"
            description="Export coupon booklet sales, collections, and contributor logs to CSV."
            defaultFilename={`orah_coupons_${new Date().toISOString().slice(0, 10)}.csv`}
            data={coupons}
            filteredData={filteredCoupons}
            fields={COUPON_EXPORT_FIELDS}
            storageKey="coupons"
          />

          <AddCouponDialog onSuccess={handleRefresh} />
        </div>
      </div>

      {/* Cards View */}
      {viewMode === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCoupons.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs transition-all hover:shadow-md flex flex-col justify-between gap-3"
            >
              <div>
                {/* Header: ID + Booklet # + Mode */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {c.id}
                    </span>
                    {c.booklet_number && (
                      <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-mono font-medium truncate">
                        Bkt #{c.booklet_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.money_type === 'Cash + UPI' ? (
                      <>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 text-indigo-700 border-indigo-500/30 bg-gradient-to-r from-emerald-50/70 to-indigo-50/70 dark:from-emerald-950/30 dark:to-indigo-950/30 dark:text-indigo-300 font-semibold"
                        >
                          Cash + UPI
                        </Badge>
                        {c.is_handed_over === false ? (
                          <button
                            type="button"
                            onClick={() => handleToggleHandover(c)}
                            title="Cash portion is pending with volunteer. Click to mark handed over to finance."
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Cash Pending
                          </button>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 text-emerald-700 border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                          >
                            Cash In Hand
                          </Badge>
                        )}
                      </>
                    ) : c.money_type === 'Cash' ? (
                      c.is_handed_over === false ? (
                        <button
                          type="button"
                          onClick={() => handleToggleHandover(c)}
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
                    <span className="text-xs text-muted-foreground">{c.date}</span>
                  </div>
                </div>

                {/* Contributor & Amount */}
                <div className="mb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-foreground text-sm leading-snug truncate" title={c.contributor_name}>
                      {c.contributor_name}
                    </h3>
                    {c.screenshot_link && (
                      <a
                        href={c.screenshot_link}
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
                      +{formatINR(c.amount)}
                    </span>
                    {c.mobile_number && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {c.mobile_number}
                      </span>
                    )}
                  </div>

                  {c.money_type === 'Cash + UPI' && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-mono">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 font-medium text-[10px]">
                        Cash: {formatINR(c.cash_amount != null ? Number(c.cash_amount) : 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 font-medium text-[10px]">
                        UPI: {formatINR(c.upi_amount != null ? Number(c.upi_amount) : 0)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Details Footer: Volunteer & Notes */}
                {(c.collected_by || c.notes) && (
                  <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t border-border/40">
                    {c.collected_by && (
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="text-muted-foreground">Collector:</span>
                        <span className="font-medium text-foreground">{c.collected_by}</span>
                      </div>
                    )}
                    {c.notes && (
                      <p className="text-[11px] text-muted-foreground italic line-clamp-2" title={c.notes}>
                        “{c.notes}”
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
                  onClick={() => setEditingCoupon(c)}
                  className="text-xs h-7 px-2"
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setDeletingCoupon(c)}
                  className="text-xs h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}

          {filteredCoupons.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border/80 p-8 text-center">
              <p className="text-sm font-medium text-foreground">No coupon records found.</p>
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
                  <th className="w-10 px-4 py-3 text-left">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="Select all rows"
                    />
                  </th>
                  <SortableHeader field="id" currentSort={sortState} onSort={handleSort}>
                    ID
                  </SortableHeader>
                  <SortableHeader field="date" currentSort={sortState} onSort={handleSort}>
                    Date
                  </SortableHeader>
                  <SortableHeader field="contributor_name" currentSort={sortState} onSort={handleSort}>
                    Contributor
                  </SortableHeader>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mobile
                  </th>
                  <SortableHeader field="booklet_number" currentSort={sortState} onSort={handleSort}>
                    Booklet #
                  </SortableHeader>
                  <SortableHeader field="collected_by" currentSort={sortState} onSort={handleSort}>
                    Collected By
                  </SortableHeader>
                  <SortableHeader field="amount" currentSort={sortState} onSort={handleSort}>
                    Amount
                  </SortableHeader>
                  <SortableHeader field="money_type" currentSort={sortState} onSort={handleSort}>
                    Money Type
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
                {sortedCoupons.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={cn(
                        'transition-colors hover:bg-muted/20',
                        isSelected && 'bg-primary/5 dark:bg-primary/10'
                      )}
                    >
                      <td className="w-10 px-4 py-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(c.id)}
                          aria-label={`Select ${c.contributor_name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {c.id}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                        {c.date}
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{c.contributor_name}</span>
                          {c.screenshot_link && (
                            <a
                              href={c.screenshot_link}
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
                        {c.mobile_number || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-medium whitespace-nowrap text-amber-600 dark:text-amber-400">
                        {c.booklet_number || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {c.collected_by ? (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-medium text-foreground">
                            {c.collected_by}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          +{formatINR(c.amount)}
                        </div>
                        {c.money_type === 'Cash + UPI' && (
                          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                            ₹{c.cash_amount ?? 0} Cash + ₹{c.upi_amount ?? 0} UPI
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.money_type === 'Cash + UPI' ? (
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="text-xs text-indigo-700 border-indigo-500/30 bg-gradient-to-r from-emerald-50/70 to-indigo-50/70 dark:from-emerald-950/30 dark:to-indigo-950/30 dark:text-indigo-300 font-semibold"
                            >
                              Cash + UPI
                            </Badge>
                            {c.is_handed_over === false ? (
                              <button
                                type="button"
                                onClick={() => handleToggleHandover(c)}
                                title="Cash portion pending with volunteer. Click to mark handed over to finance."
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Cash Pending
                              </button>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-emerald-700 border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                              >
                                Cash In Hand
                              </Badge>
                            )}
                          </div>
                        ) : c.money_type === 'Cash' ? (
                          c.is_handed_over === false ? (
                            <button
                              type="button"
                              onClick={() => handleToggleHandover(c)}
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
                        title={c.notes || ''}
                      >
                        {c.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setEditingCoupon(c)}
                            className="text-xs"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setDeletingCoupon(c)}
                            className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {sortedCoupons.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No coupon records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/25 font-medium text-xs">
                  <td colSpan={5} className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Filtered Collections</span>
                      <span className="text-muted-foreground">({filteredCoupons.length} records)</span>
                    </div>
                  </td>
                  <td colSpan={3} className="px-4 py-3.5">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">Cash:</span>
                        <span className="font-bold tabular-nums">{formatINR(filteredCashTotal)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">UPI:</span>
                        <span className="font-bold tabular-nums">{formatINR(filteredUpiTotal)}</span>
                      </div>
                    </div>
                  </td>
                  <td colSpan={3} className="px-4 py-3.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total (CASH+UPI):</span>
                      <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatINR(filteredGrandTotal)}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Floating Selective Total Bar */}
      <TableSelectionBar
        selectedCount={selectedCoupons.length}
        totalFilteredCount={sortedCoupons.length}
        cashTotal={selectiveCashTotal}
        upiTotal={selectiveUpiTotal}
        grandTotal={selectiveGrandTotal}
        onSelectAll={handleToggleSelectAll}
        onClear={handleClearSelection}
        isAllSelected={isAllSelected}
      />

      {/* Edit Coupon Dialog */}
      <EditCouponDialog
        coupon={editingCoupon}
        open={Boolean(editingCoupon)}
        onOpenChange={(open) => {
          if (!open) setEditingCoupon(null);
        }}
        onSuccess={handleRefresh}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingCoupon)}
        onOpenChange={(open) => {
          if (!open) setDeletingCoupon(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Coupon Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete coupon <strong className="text-foreground">{deletingCoupon?.id}</strong> from{' '}
              <strong className="text-foreground">{deletingCoupon?.contributor_name}</strong> ({formatINR(deletingCoupon?.amount ?? 0)})?
              The corresponding entry in the Income ledger will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingCoupon(null)}
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
