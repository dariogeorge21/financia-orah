'use client';

import { useState, useMemo, useCallback } from 'react';
import type { LedgerRow } from '@/lib/export/ledger';
import { generateCsvContent, downloadCsv } from '@/lib/export/csv';
import type { ExportField } from '@/components/finance/export/types';
import { cn } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────

const INR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const CODE_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  CASHIN:    { label: 'CASH IN',    bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  UPIIN:     { label: 'UPI IN',     bg: 'bg-indigo-50 dark:bg-indigo-950/40',   text: 'text-indigo-700 dark:text-indigo-300',   dot: 'bg-indigo-500'  },
  'SPLIT-IN':{ label: 'SPLIT IN',   bg: 'bg-violet-50 dark:bg-violet-950/40',   text: 'text-violet-700 dark:text-violet-300',   dot: 'bg-violet-500'  },
  CASHOUT:   { label: 'CASH OUT',   bg: 'bg-rose-50 dark:bg-rose-950/40',       text: 'text-rose-700 dark:text-rose-300',       dot: 'bg-rose-500'    },
  UPIOUT:    { label: 'UPI OUT',    bg: 'bg-orange-50 dark:bg-orange-950/40',   text: 'text-orange-700 dark:text-orange-300',   dot: 'bg-orange-500'  },
  };

const getCodeMeta = (code: string) => CODE_META[code] ?? { label: code, bg: 'bg-muted/40', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };

const STATUS_STYLE: Record<string, string> = {
  'Received':              'text-emerald-600 dark:text-emerald-400',
  'Approved':              'text-emerald-600 dark:text-emerald-400',
  'Paid':                  'text-emerald-600 dark:text-emerald-400',
  'fully_paid':            'text-emerald-600 dark:text-emerald-400',
  'partially_paid':        'text-amber-600 dark:text-amber-400',
  'Cash Pending Handover': 'text-amber-600 dark:text-amber-400',
  'Pending':               'text-amber-600 dark:text-amber-400',
  'later_pay':             'text-amber-600 dark:text-amber-400',
  'Rejected':              'text-rose-600 dark:text-rose-400',
  'Cancelled':             'text-rose-600 dark:text-rose-400',
  'not_paid':              'text-rose-600 dark:text-rose-400',
};

// ── CSV Export fields ─────────────────────────────────────────────────────────

const CSV_FIELDS: ExportField<LedgerRow>[] = [
  { key: 'sNo',             label: '#',                        group: 'Transaction Info', accessor: (r) => r.sNo },
  { key: 'date',            label: 'Date',                     group: 'Transaction Info', accessor: (r) => r.displayDate },
  { key: 'transactionCode', label: 'Transaction Code',         group: 'Transaction Info', accessor: (r) => r.transactionCode },
  { key: 'entryKind',       label: 'Entry Kind',               group: 'Transaction Info', accessor: (r) => r.entryKind },
  { key: 'particulars',     label: 'Particulars',              group: 'Transaction Info', accessor: (r) => r.particulars },
  { key: 'name',            label: 'Name',                     group: 'Party Info',       accessor: (r) => r.name },
  { key: 'contact',         label: 'Contact',                  group: 'Party Info',       accessor: (r) => r.contact },
  { key: 'description',     label: 'Description / Narration',  group: 'Party Info',       accessor: (r) => r.description },
  { key: 'debit',           label: 'Debit (₹)',                group: 'Financials',       accessor: (r) => r.debit || '' },
  { key: 'credit',          label: 'Credit (₹)',               group: 'Financials',       accessor: (r) => r.credit || '' },
  { key: 'paymentMode',     label: 'Payment Mode',             group: 'Financials',       accessor: (r) => r.paymentMode },
  { key: 'balanceCash',     label: 'Balance Cash (₹)',         group: 'Running Balances', accessor: (r) => r.balanceCash },
  { key: 'balanceUpi',      label: 'Balance UPI (₹)',          group: 'Running Balances', accessor: (r) => r.balanceUpi },
  { key: 'balanceTotal',    label: 'Balance Total (₹)',        group: 'Running Balances', accessor: (r) => r.balanceTotal },
  { key: 'status',          label: 'Status',                   group: 'Additional Info',  accessor: (r) => r.status },
  { key: 'transactionType', label: 'Transaction Type',         group: 'Additional Info',  accessor: (r) => r.transactionType },
  { key: 'notes',           label: 'Notes / Remarks',          group: 'Additional Info',  accessor: (r) => r.notes },
  { key: 'referenceId',     label: 'Reference ID',             group: 'Audit',            accessor: (r) => r.referenceId },
];

// ── Filter bar options ────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  'All',
  'Income',
  'Expense',
] as const;

// ── Main Component ────────────────────────────────────────────────────────────

interface MasterLedgerSheetProps {
  rows: LedgerRow[];
  generatedAt?: string;
}

export function MasterLedgerSheet({ rows, generatedAt }: MasterLedgerSheetProps) {
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [modeFilter, setModeFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== 'All' && r.transactionType !== typeFilter) return false;
      if (modeFilter === 'Cash'  && !['CASHIN', 'CASHOUT'].includes(r.transactionCode)) return false;
      if (modeFilter === 'UPI'   && !['UPIIN',  'UPIOUT'].includes(r.transactionCode)) return false;
      if (modeFilter === 'Split' && r.transactionCode !== 'SPLIT-IN') return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(q) &&
          !r.description.toLowerCase().includes(q) &&
          !r.particulars.toLowerCase().includes(q) &&
          !r.referenceId.toLowerCase().includes(q) &&
          !r.displayDate.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, typeFilter, modeFilter, search]);

  // Summary of filtered rows
  const summary = useMemo(() => {
    let totalCredit = 0;
    let totalDebit  = 0;
    for (const r of filtered) {
      totalCredit += r.credit;
      totalDebit  += r.debit;
    }
    const lastRow = filtered[filtered.length - 1];
    return {
      totalCredit,
      totalDebit,
      netFlow:     totalCredit - totalDebit,
      finalCash:   lastRow?.balanceCash  ?? 0,
      finalUpi:    lastRow?.balanceUpi   ?? 0,
      finalTotal:  lastRow?.balanceTotal ?? 0,
      count:       filtered.length,
    };
  }, [filtered]);

  const handleCsvDownload = useCallback(() => {
    if (downloading) return;
    setDownloading(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const content = generateCsvContent(filtered, CSV_FIELDS, true);
      downloadCsv(`orah_financial_report_${dateStr}.csv`, content);
      setDownloaded(true);
      setTimeout(() => { setDownloaded(false); setDownloading(false); }, 2000);
    } catch {
      setDownloading(false);
    }
  }, [filtered, downloading]);

  return (
    <div className="space-y-4">
      {/* ── Sheet Header ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4 border-b border-border/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="8" y1="13" x2="16" y2="13"/>
                  <line x1="8" y1="17" x2="16" y2="17"/>
                  <line x1="8" y1="9" x2="10" y2="9"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">
                  Master Financial Ledger
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ORAH – Campus Meet 2026 · All Transactions
                </p>
                {generatedAt && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
                    Generated: {generatedAt}
                  </p>
                )}
              </div>
            </div>

            {/* Export Button */}
            <button
              type="button"
              onClick={handleCsvDownload}
              disabled={downloading || filtered.length === 0}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-all cursor-pointer',
                downloaded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {downloaded ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Downloaded!
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                  </svg>
                  Export CSV ({filtered.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Summary KPI Strip ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-border/40 border-b border-border/50 bg-muted/10">
          {[
            { label: 'Total Credits', value: summary.totalCredit, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Total Debits',  value: summary.totalDebit,  color: 'text-rose-600 dark:text-rose-400' },
            { label: 'Net Flow',      value: summary.netFlow,     color: summary.netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
            { label: 'Cash Balance',  value: summary.finalCash,   color: 'text-teal-600 dark:text-teal-400' },
            { label: 'UPI Balance',   value: summary.finalUpi,    color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Total Balance', value: summary.finalTotal,  color: 'text-violet-600 dark:text-violet-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="px-4 py-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className={cn('text-sm font-bold tabular-nums mt-0.5', kpi.color)}>
                {INR(kpi.value)}
              </p>
            </div>
          ))}
        </div>

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-border/40 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-muted/5">
          {/* Type Filters */}
          <div className="flex flex-wrap gap-1.5">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all cursor-pointer border',
                  typeFilter === t
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {t}
              </button>
            ))}
            <span className="self-center text-muted-foreground/40 text-xs">|</span>
            {['All', 'Cash', 'UPI', 'Split'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all cursor-pointer border',
                  modeFilter === m
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-xs w-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              placeholder="Search name, ID, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-card pl-7 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer">✕</button>
            )}
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b-2 border-border/60 bg-muted/30 sticky top-0">
                {[
                  { label: '#',          cls: 'w-10 text-center' },
                  { label: 'Date',       cls: 'w-24' },
                  { label: 'Txn Code',   cls: 'w-24' },
                  { label: 'Particulars / Type', cls: '' },
                  { label: 'Name',       cls: 'w-36' },
                  { label: 'Contact',    cls: 'w-28' },
                  { label: 'Description', cls: 'max-w-[200px]' },
                  { label: 'Debit (₹)', cls: 'w-28 text-right text-rose-700 dark:text-rose-400' },
                  { label: 'Credit (₹)', cls: 'w-28 text-right text-emerald-700 dark:text-emerald-400' },
                  { label: 'Mode',       cls: 'w-16 text-center' },
                  { label: 'Status',     cls: 'w-32' },
                  { label: 'Cash Bal.',  cls: 'w-28 text-right text-teal-700 dark:text-teal-400' },
                  { label: 'UPI Bal.',   cls: 'w-28 text-right text-indigo-700 dark:text-indigo-400' },
                  { label: 'Total Bal.', cls: 'w-28 text-right text-violet-700 dark:text-violet-400' },
                  { label: 'Notes',      cls: 'w-32' },
                ].map((h) => (
                  <th
                    key={h.label}
                    className={cn(
                      'px-3 py-2.5 font-semibold text-muted-foreground tracking-wider uppercase text-[10px] whitespace-nowrap text-left',
                      h.cls
                    )}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                      <p className="text-sm">No transactions match your filter</p>
                      <button type="button" onClick={() => { setTypeFilter('All'); setModeFilter('All'); setSearch(''); }} className="text-xs text-primary hover:underline cursor-pointer">Clear filters</button>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((row, idx) => {
                const meta = getCodeMeta(row.transactionCode);
                const isCredit = row.credit > 0;
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={row.referenceId + idx}
                    className={cn(
                      'border-b border-border/30 transition-colors hover:bg-primary/5',
                      isEven ? 'bg-transparent' : 'bg-muted/10'
                    )}
                  >
                    {/* # */}
                    <td className="px-3 py-2.5 text-center text-muted-foreground/60 font-mono text-[10px]">
                      {row.sNo}
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-medium text-foreground">{row.displayDate}</span>
                    </td>

                    {/* Txn Code badge */}
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', meta.bg, meta.text)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dot)} />
                        {meta.label}
                      </span>
                    </td>

                    {/* Particulars */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground">{row.particulars}</span>
                        <span className="text-[10px] text-muted-foreground">{row.entryKind}</span>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-foreground max-w-[140px] truncate block" title={row.name}>{row.name || '—'}</span>
                    </td>

                    {/* Contact */}
                    <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">
                      {row.contact || '—'}
                    </td>

                    {/* Description */}
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <span className="text-muted-foreground truncate block" title={row.description}>{row.description || '—'}</span>
                    </td>

                    {/* Debit */}
                    <td className="px-3 py-2.5 text-right">
                      {row.debit > 0 ? (
                        <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400">
                          {INR(row.debit)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Credit */}
                    <td className="px-3 py-2.5 text-right">
                      {row.credit > 0 ? (
                        <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {INR(row.credit)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Mode */}
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn(
                        'text-[10px] font-semibold rounded px-1.5 py-0.5',
                        row.paymentMode === 'UPI' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' :
                        row.paymentMode === 'Cash' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' :
                        'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
                      )}>
                        {row.paymentMode}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <span className={cn('text-[10px] font-medium capitalize', STATUS_STYLE[row.status] ?? 'text-muted-foreground')}>
                        {row.status}
                      </span>
                    </td>

                    {/* Balance Cash */}
                    <td className={cn('px-3 py-2.5 text-right tabular-nums font-mono text-[11px]', isCredit && row.transactionCode === 'CASHIN' || row.transactionCode === 'SPLIT-IN' ? 'text-teal-700 dark:text-teal-400 font-semibold' : 'text-foreground')}>
                      {INR(row.balanceCash)}
                    </td>

                    {/* Balance UPI */}
                    <td className={cn('px-3 py-2.5 text-right tabular-nums font-mono text-[11px]', isCredit && row.transactionCode === 'UPIIN' ? 'text-indigo-700 dark:text-indigo-400 font-semibold' : 'text-foreground')}>
                      {INR(row.balanceUpi)}
                    </td>

                    {/* Total Balance */}
                    <td className="px-3 py-2.5 text-right tabular-nums font-mono text-[11px] font-semibold text-violet-700 dark:text-violet-400">
                      {INR(row.balanceTotal)}
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-2.5 max-w-[130px]">
                      <span className="text-[10px] text-muted-foreground truncate block" title={row.notes}>{row.notes || '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* ── Totals Footer ────────────────────────────────────────── */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border/80 bg-muted/30 font-bold">
                  <td colSpan={7} className="px-3 py-3 text-xs text-muted-foreground uppercase tracking-wider">
                    Totals — {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400 text-xs">
                    {INR(summary.totalDebit)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 text-xs">
                    {INR(summary.totalCredit)}
                  </td>
                  <td colSpan={2} className="px-3 py-3 text-xs text-muted-foreground">
                    Net: <span className={summary.netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {INR(summary.netFlow)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-teal-700 dark:text-teal-400 text-xs font-bold">
                    {INR(summary.finalCash)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-indigo-700 dark:text-indigo-400 text-xs font-bold">
                    {INR(summary.finalUpi)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-violet-700 dark:text-violet-400 text-xs font-bold">
                    {INR(summary.finalTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Legend ───────────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-t border-border/40 bg-muted/10 flex flex-wrap gap-3 items-center">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Legend:</span>
          {Object.entries(CODE_META).map(([code, m]) => (
            <span key={code} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full', m.dot)} />
              <span className="font-medium">{m.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
