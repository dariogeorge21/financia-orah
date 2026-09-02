'use client';

import { useState, useTransition, useMemo } from 'react';
import type { FeeRecord, FeePaymentStatus, FeePaymentMethod } from '@/lib/types';
import { formatINR, calcFeeSummary, formatFeeStatusLabel } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ViewModeToggle } from '../ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { fetchFeeData } from '@/features/fees';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface FeeManagerProps {
  initialFees: FeeRecord[];
}

export function FeeManager({ initialFees }: FeeManagerProps) {
  const [fees, setFees] = useState<FeeRecord[]>(initialFees);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [personTypeFilter, setPersonTypeFilter] = useState<string>('ALL');
  const [onlyPendingDues, setOnlyPendingDues] = useState<boolean>(false);
  const [viewMode, setViewMode] = useViewMode('fee_collections');

  const [isRefreshing, startRefresh] = useTransition();
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedDues, setCopiedDues] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live filter computation
  const filteredFees = useMemo(() => {
    return fees.filter((f) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (f.display_name && f.display_name.toLowerCase().includes(q)) ||
        (f.display_phone && f.display_phone.toLowerCase().includes(q)) ||
        (f.participant_parish && f.participant_parish.toLowerCase().includes(q)) ||
        (f.participant_college && f.participant_college.toLowerCase().includes(q)) ||
        (f.volunteer_ministry && f.volunteer_ministry.toLowerCase().includes(q)) ||
        (f.volunteer_role && f.volunteer_role.toLowerCase().includes(q)) ||
        (f.payment_note && f.payment_note.toLowerCase().includes(q)) ||
        (f.id && f.id.toLowerCase().includes(q));

      // Status filter matching
      let matchStatus = true;
      const st = (f.payment_status || '').toLowerCase();
      if (statusFilter === 'PAID') {
        matchStatus = st === 'paid' || st === 'fully_paid';
      } else if (statusFilter === 'PARTIAL') {
        matchStatus = st === 'partially_paid' || st === 'half_paid';
      } else if (statusFilter === 'LATER_PAY') {
        matchStatus = st === 'later_pay' || st === 'pay_later';
      } else if (statusFilter === 'UNPAID') {
        matchStatus = st === 'not_paid' || st === 'no_pay';
      }

      // Method filter matching
      let matchMethod = true;
      const m = (f.payment_method || '').toUpperCase();
      if (methodFilter === 'CASH') {
        matchMethod = m === 'CASH';
      } else if (methodFilter === 'UPI') {
        matchMethod = m === 'UPI';
      } else if (methodFilter === 'NONE') {
        matchMethod = !m || m === '';
      }

      // Person type filter
      let matchPerson = true;
      if (personTypeFilter === 'PARTICIPANT') {
        matchPerson = f.person_type === 'participant';
      } else if (personTypeFilter === 'VOLUNTEER') {
        matchPerson = f.person_type === 'volunteer';
      }

      // Dues only filter
      let matchDues = true;
      if (onlyPendingDues) {
        matchDues = Number(f.amount_due) > 0;
      }

      return matchSearch && matchStatus && matchMethod && matchPerson && matchDues;
    });
  }, [fees, searchQuery, statusFilter, methodFilter, personTypeFilter, onlyPendingDues]);

  // Aggregate KPI summary
  const summary = useMemo(() => {
    return calcFeeSummary(fees);
  }, [fees]);

  // Filtered summary
  const filteredSummary = useMemo(() => {
    return calcFeeSummary(filteredFees);
  }, [filteredFees]);

  function handleRefresh() {
    startRefresh(async () => {
      try {
        setErrorMessage(null);
        const res = await fetchFeeData();
        if (res.data?.fees) {
          setFees(res.data.fees);
        }
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to refresh fee data.');
      }
    });
  }

  function handleCopySummary() {
    const text = [
      `📊 ORAH 2026 - REGISTRATION FEES SUMMARY (CHECKED-IN)`,
      `═══════════════════════════════════════════════`,
      `👥 Total Checked-In Attendees: ${summary.checkedInCount}`,
      `💰 Total Fee Collected: ₹${summary.totalCollected.toLocaleString('en-IN')}`,
      `   • Cash Collected: ₹${summary.cashCollected.toLocaleString('en-IN')} (${summary.cashCount} payers)`,
      `   • UPI Collected:  ₹${summary.upiCollected.toLocaleString('en-IN')} (${summary.upiCount} payers)`,
      `⚠️ Total Pending Dues: ₹${summary.totalDue.toLocaleString('en-IN')}`,
      `📈 Collection Rate: ${summary.collectionRate}% of ₹${summary.totalExpected.toLocaleString('en-IN')}`,
      `───────────────────────────────────────────────`,
      `STATUS BREAKDOWN:`,
      `• Fully Paid:     ${summary.fullyPaidCount} (₹${summary.fullyPaidAmount.toLocaleString('en-IN')})`,
      `• Partially Paid: ${summary.partiallyPaidCount} (₹${summary.partiallyPaidAmount.toLocaleString('en-IN')} collected, ₹${summary.partiallyPaidDue.toLocaleString('en-IN')} due)`,
      `• Pay Later:      ${summary.laterPayCount} (₹${summary.laterPayDue.toLocaleString('en-IN')} due)`,
      `• Unpaid:         ${summary.notPaidCount} (₹${summary.notPaidDue.toLocaleString('en-IN')} due)`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  }

  function handleCopyDuesList() {
    const attendeesWithDues = fees.filter((f) => Number(f.amount_due) > 0);
    if (attendeesWithDues.length === 0) return;

    const lines = [
      `⚠️ ORAH 2026 - PENDING DUES LIST (${attendeesWithDues.length} Attendees)`,
      `Total Outstanding: ₹${summary.totalDue.toLocaleString('en-IN')}`,
      `═══════════════════════════════════════════════`,
    ];

    attendeesWithDues.forEach((f, idx) => {
      const phone = f.display_phone ? ` | 📱 ${f.display_phone}` : '';
      const parishOrRole =
        f.person_type === 'volunteer'
          ? f.volunteer_ministry || f.volunteer_role || 'Volunteer'
          : f.participant_parish || f.participant_college || 'Participant';
      const statusLabel = formatFeeStatusLabel(f.payment_status);
      const note = f.payment_note ? ` (Note: ${f.payment_note})` : '';

      lines.push(
        `${idx + 1}. ${f.display_name}${phone} — Due: ₹${Number(f.amount_due).toLocaleString('en-IN')} [${statusLabel} · ${parishOrRole}]${note}`
      );
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedDues(true);
    setTimeout(() => setCopiedDues(false), 2500);
  }

  function handleExportCsv() {
    const headers = [
      'Attendee Name',
      'Person Type',
      'Phone',
      'Parish/Ministry',
      'Payment Status',
      'Payment Method',
      'Amount Paid (INR)',
      'Amount Due (INR)',
      'Checked-In At',
      'Payment Remarks',
    ];

    const rows = filteredFees.map((f) => [
      `"${(f.display_name || '').replace(/"/g, '""')}"`,
      `"${f.person_type}"`,
      `"${f.display_phone || ''}"`,
      `"${((f.person_type === 'volunteer' ? f.volunteer_ministry || f.volunteer_role : f.participant_parish) || '').replace(/"/g, '""')}"`,
      `"${formatFeeStatusLabel(f.payment_status)}"`,
      `"${f.payment_method || 'None'}"`,
      f.amount_paid,
      f.amount_due,
      `"${f.checked_in_at ? new Date(f.checked_in_at).toLocaleString('en-IN') : ''}"`,
      `"${(f.payment_note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `orah_2026_fees_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
                <path d="M12 14v2" />
                <path d="M16 14v2" />
                <path d="M8 14v2" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Registration Fees
              </h1>
              <p className="text-xs text-muted-foreground">
                Fee collections and dues for checked-in participants & volunteers (Read-only)
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            className="h-8 text-xs cursor-pointer"
          >
            {copiedSummary ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-emerald-500">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied Summary!
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                Copy Summary
              </>
            )}
          </Button>

          {summary.totalDue > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyDuesList}
              className="h-8 text-xs border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
            >
              {copiedDues ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 text-emerald-500">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied Dues!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" x2="19" y1="8" y2="14" />
                    <line x1="22" x2="16" y1="11" y2="11" />
                  </svg>
                  Copy Dues List
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredFees.length === 0}
            className="h-8 text-xs cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Export CSV
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            title="Refresh fee data"
          >
            {isRefreshing ? (
              <Spinner className="size-3.5" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M8 16H3v5" />
              </svg>
            )}
          </Button>

          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Hero KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Fee Collected */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Collected
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {formatINR(summary.totalCollected)}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                💵 {formatINR(summary.cashCollected)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                📱 {formatINR(summary.upiCollected)}
              </span>
            </div>
          </div>
        </div>

        {/* Cash Collection */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cash Collected
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="12" x="2" y="6" rx="2" />
                <circle cx="12" cy="12" r="2" />
                <path d="M6 12h.01M18 12h.01" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatINR(summary.cashCollected)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.cashCount} cash payer{summary.cashCount === 1 ? '' : 's'} at desk
            </p>
          </div>
        </div>

        {/* UPI Collection */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              UPI Digital Collected
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                <path d="M12 18h.01" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 tabular-nums">
              {formatINR(summary.upiCollected)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.upiCount} UPI QR payer{summary.upiCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* Pending Dues */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-rose-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Dues
            </span>
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              summary.totalDue > 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-muted text-muted-foreground"
            )}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" x2="12" y1="8" y2="12" />
                <line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
            </div>
          </div>
          <div className="mt-3">
            <div className={cn(
              "text-2xl font-bold tracking-tight tabular-nums",
              summary.totalDue > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
            )}>
              {formatINR(summary.totalDue)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary.partiallyPaidCount + summary.laterPayCount + summary.notPaidCount} attendee(s) with dues
            </p>
          </div>
        </div>
      </section>

      {/* Progress & Quick Breakdown Band */}
      <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5 flex-1 max-w-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">
                Checked-In Collection Rate ({summary.collectionRate}%)
              </span>
              <span className="text-muted-foreground">
                <strong>{summary.checkedInCount}</strong> Attendees Checked In
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                style={{ width: `${Math.min(100, summary.collectionRate)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 lg:pt-0">
            <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-center">
              <span className="block text-[10px] font-medium text-emerald-700 dark:text-emerald-300 uppercase">
                Fully Paid
              </span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                {summary.fullyPaidCount}
              </span>
            </div>

            <div className="rounded-xl bg-blue-500/10 px-3 py-2 text-center">
              <span className="block text-[10px] font-medium text-blue-700 dark:text-blue-300 uppercase">
                Partially Paid
              </span>
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                {summary.partiallyPaidCount}
              </span>
            </div>

            <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-center">
              <span className="block text-[10px] font-medium text-amber-700 dark:text-amber-300 uppercase">
                Pay Later
              </span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                {summary.laterPayCount}
              </span>
            </div>

            <div className="rounded-xl bg-rose-500/10 px-3 py-2 text-center">
              <span className="block text-[10px] font-medium text-rose-700 dark:text-rose-300 uppercase">
                Unpaid
              </span>
              <span className="text-sm font-bold text-rose-700 dark:text-rose-300">
                {summary.notPaidCount}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
            <Input
              type="text"
              placeholder="Search by name, phone, parish, ministry, note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Dues Filter Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyPendingDues(!onlyPendingDues)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                onlyPendingDues
                  ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20"
                  : "border-border bg-background hover:bg-muted text-muted-foreground"
              )}
            >
              <span className={cn("size-2 rounded-full", onlyPendingDues ? "bg-rose-500 animate-pulse" : "bg-muted-foreground")} />
              Pending Dues Only ({fees.filter((f) => Number(f.amount_due) > 0).length})
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Status Filter */}
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
            Status:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PAID', label: '✓ Full Paid' },
            { id: 'PARTIAL', label: '◐ Partially Paid' },
            { id: 'LATER_PAY', label: '⏱ Pay Later' },
            { id: 'UNPAID', label: '✕ Unpaid' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer",
                statusFilter === item.id
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              {item.label}
            </button>
          ))}

          <span className="text-muted-foreground/40 mx-1">|</span>

          {/* Method Filter */}
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
            Method:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'CASH', label: '💵 Cash' },
            { id: 'UPI', label: '📱 UPI' },
            { id: 'NONE', label: 'None' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setMethodFilter(item.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer",
                methodFilter === item.id
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              {item.label}
            </button>
          ))}

          <span className="text-muted-foreground/40 mx-1">|</span>

          {/* Person Type Filter */}
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
            Person:
          </span>
          {[
            { id: 'ALL', label: 'All' },
            { id: 'PARTICIPANT', label: 'Participants' },
            { id: 'VOLUNTEER', label: 'Volunteers' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPersonTypeFilter(item.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer",
                personTypeFilter === item.id
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* Main Results View */}
      {filteredFees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 px-4 text-center bg-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" x2="16.65" y1="21" y2="16.65" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            No checked-in fee records found
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {fees.length === 0
              ? 'No attendees have checked in yet. Check-in payments recorded in the check-in desk app will show here in real-time.'
              : 'No fee records match the current filters. Try resetting the search or filter options.'}
          </p>
          {(searchQuery || statusFilter !== 'ALL' || methodFilter !== 'ALL' || personTypeFilter !== 'ALL' || onlyPendingDues) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setMethodFilter('ALL');
                setPersonTypeFilter('ALL');
                setOnlyPendingDues(false);
              }}
              className="mt-4 text-xs cursor-pointer"
            >
              Reset All Filters
            </Button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Attendee</th>
                  <th className="py-3.5 px-3">Type</th>
                  <th className="py-3.5 px-3">Parish / Ministry</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-3">Method</th>
                  <th className="py-3.5 px-3 text-right">Paid</th>
                  <th className="py-3.5 px-3 text-right">Due</th>
                  <th className="py-3.5 px-4">Check-in Time</th>
                  <th className="py-3.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredFees.map((fee) => {
                  const status = (fee.payment_status || '').toLowerCase();
                  const isPaid = status === 'paid' || status === 'fully_paid';
                  const isPartial = status === 'partially_paid' || status === 'half_paid';
                  const isLater = status === 'later_pay' || status === 'pay_later';
                  const isUnpaid = status === 'not_paid' || status === 'no_pay';

                  return (
                    <tr
                      key={fee.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      {/* Attendee Name & Phone */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">
                          {fee.display_name}
                        </div>
                        {fee.display_phone && (
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {fee.display_phone}
                          </div>
                        )}
                      </td>

                      {/* Person Type Badge */}
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold px-2 py-0.5",
                            fee.person_type === 'volunteer'
                              ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                              : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                          )}
                        >
                          {fee.person_type === 'volunteer' ? 'Volunteer' : 'Participant'}
                        </Badge>
                      </td>

                      {/* Parish / Ministry */}
                      <td className="py-3 px-3 text-muted-foreground">
                        {fee.person_type === 'volunteer' ? (
                          <div>
                            <span className="font-medium text-foreground">
                              {fee.volunteer_ministry || fee.volunteer_role || '—'}
                            </span>
                            {fee.volunteer_role && fee.volunteer_ministry && (
                              <span className="block text-[10px] text-muted-foreground">
                                {fee.volunteer_role}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium text-foreground">
                              {fee.participant_parish || '—'}
                            </span>
                            {fee.participant_college && (
                              <span className="block text-[10px] text-muted-foreground truncate max-w-[140px]" title={fee.participant_college}>
                                {fee.participant_college}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Payment Status Badge */}
                      <td className="py-3 px-3">
                        {isPaid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Fully Paid
                          </span>
                        )}
                        {isPartial && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            <span className="size-1.5 rounded-full bg-blue-500" />
                            Partially Paid
                          </span>
                        )}
                        {isLater && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            Pay Later
                          </span>
                        )}
                        {isUnpaid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300 border border-rose-500/20">
                            <span className="size-1.5 rounded-full bg-rose-500" />
                            Unpaid
                          </span>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3">
                        {fee.payment_method === 'CASH' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                            💵 Cash
                          </span>
                        ) : fee.payment_method === 'UPI' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                            📱 UPI
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Amount Paid */}
                      <td className="py-3 px-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {fee.amount_paid > 0 ? formatINR(fee.amount_paid) : '₹0'}
                      </td>

                      {/* Amount Due */}
                      <td className="py-3 px-3 text-right font-bold tabular-nums">
                        {fee.amount_due > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {formatINR(fee.amount_due)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground font-normal">₹0</span>
                        )}
                      </td>

                      {/* Check-in Time */}
                      <td className="py-3 px-4 text-muted-foreground whitespace-nowrap text-[11px]">
                        {fee.checked_in_at ? (
                          <>
                            <div>{new Date(fee.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="text-[10px] text-muted-foreground/70">
                              {new Date(fee.checked_in_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                            </div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-3 px-4 text-muted-foreground text-[11px] max-w-[180px] truncate" title={fee.payment_note || ''}>
                        {fee.payment_note || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border/60 bg-muted/20 px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing <strong>{filteredFees.length}</strong> of <strong>{fees.length}</strong> checked-in attendees
            </span>
            <div className="flex items-center gap-3 font-medium">
              <span>Collected: <strong className="text-emerald-600 dark:text-emerald-400">{formatINR(filteredSummary.totalCollected)}</strong></span>
              {filteredSummary.totalDue > 0 && (
                <span>Due: <strong className="text-rose-600 dark:text-rose-400">{formatINR(filteredSummary.totalDue)}</strong></span>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Grid / Card View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFees.map((fee) => {
            const status = (fee.payment_status || '').toLowerCase();
            const isPaid = status === 'paid' || status === 'fully_paid';
            const isPartial = status === 'partially_paid' || status === 'half_paid';
            const isLater = status === 'later_pay' || status === 'pay_later';
            const isUnpaid = status === 'not_paid' || status === 'no_pay';

            return (
              <div
                key={fee.id}
                className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1",
                  isPaid ? "bg-emerald-500" : isPartial ? "bg-blue-500" : isLater ? "bg-amber-500" : "bg-rose-500"
                )} />

                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">
                        {fee.display_name}
                      </h3>
                      {fee.display_phone && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">
                          📱 {fee.display_phone}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 shrink-0",
                        fee.person_type === 'volunteer'
                          ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                          : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      )}
                    >
                      {fee.person_type === 'volunteer' ? 'Volunteer' : 'Participant'}
                    </Badge>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    {fee.person_type === 'volunteer' ? (
                      <span>{fee.volunteer_ministry || fee.volunteer_role || 'Volunteer Team'}</span>
                    ) : (
                      <span>{fee.participant_parish || fee.participant_college || 'General Attendee'}</span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-2.5 text-center">
                    <div>
                      <span className="block text-[10px] font-medium text-muted-foreground uppercase">
                        Paid ({fee.payment_method || '—'})
                      </span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatINR(fee.amount_paid)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-medium text-muted-foreground uppercase">
                        Balance Due
                      </span>
                      <span className={cn(
                        "text-sm font-bold tabular-nums",
                        fee.amount_due > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                      )}>
                        {formatINR(fee.amount_due)}
                      </span>
                    </div>
                  </div>

                  {fee.payment_note && (
                    <div className="mt-3 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground italic">
                      &ldquo;{fee.payment_note}&rdquo;
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    {isPaid && (
                      <span className="size-2 rounded-full bg-emerald-500" />
                    )}
                    {isPartial && (
                      <span className="size-2 rounded-full bg-blue-500" />
                    )}
                    {isLater && (
                      <span className="size-2 rounded-full bg-amber-500" />
                    )}
                    {isUnpaid && (
                      <span className="size-2 rounded-full bg-rose-500" />
                    )}
                    <span className="font-semibold text-foreground">
                      {formatFeeStatusLabel(fee.payment_status)}
                    </span>
                  </div>
                  <span>
                    {fee.checked_in_at
                      ? new Date(fee.checked_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
