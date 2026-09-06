'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { IncomeRecord, ExpenseRecord, MoneyPosition, DailyFlowRecord } from '@/lib/types';
import {
  formatINR,
  calcDailyFlowRecords,
} from '@/lib/calculations';
import { KpiCard } from '@/components/finance/KpiCard';
import { ViewModeToggle } from '@/components/finance/ViewModeToggle';
import { useViewMode } from '@/hooks/useViewMode';
import { ExportCsvDialog, type ExportField } from '@/components/finance/export';
import { DailyCardItem } from './DailyCardItem';
import { DailyTransactionsList } from './DailyTransactionsList';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const DAILY_FLOW_EXPORT_FIELDS: ExportField<DailyFlowRecord>[] = [
  {
    key: 'date',
    label: 'Date (YYYY-MM-DD)',
    group: 'Date Info',
    accessor: (d) => d.date,
  },
  {
    key: 'displayDate',
    label: 'Formatted Date',
    group: 'Date Info',
    accessor: (d) => d.displayDate,
  },
  {
    key: 'dayOfWeek',
    label: 'Day of Week',
    group: 'Date Info',
    accessor: (d) => d.dayOfWeek,
  },
  {
    key: 'incomeTotal',
    label: 'Total Income (₹)',
    group: 'Income Summary',
    accessor: (d) => d.incomeTotal,
  },
  {
    key: 'incomeCash',
    label: 'Cash Income (₹)',
    group: 'Income Summary',
    accessor: (d) => d.incomeCash,
  },
  {
    key: 'incomeUpi',
    label: 'UPI Income (₹)',
    group: 'Income Summary',
    accessor: (d) => d.incomeUpi,
  },
  {
    key: 'incomeCount',
    label: 'Income Receipts Count',
    group: 'Income Summary',
    defaultSelected: false,
    accessor: (d) => d.incomeCount,
  },
  {
    key: 'expenseTotal',
    label: 'Total Expenses (₹)',
    group: 'Expense Summary',
    accessor: (d) => d.expenseTotal,
  },
  {
    key: 'expenseCash',
    label: 'Cash Expenses (₹)',
    group: 'Expense Summary',
    accessor: (d) => d.expenseCash,
  },
  {
    key: 'expenseUpi',
    label: 'UPI Expenses (₹)',
    group: 'Expense Summary',
    accessor: (d) => d.expenseUpi,
  },
  {
    key: 'expenseCount',
    label: 'Expense Transactions Count',
    group: 'Expense Summary',
    defaultSelected: false,
    accessor: (d) => d.expenseCount,
  },
  {
    key: 'netTotal',
    label: 'Net Daily Flow (₹)',
    group: 'Net Balance',
    accessor: (d) => d.netTotal,
  },
  {
    key: 'netCash',
    label: 'Net Cash Balance (₹)',
    group: 'Net Balance',
    accessor: (d) => d.netCash,
  },
  {
    key: 'netUpi',
    label: 'Net UPI Balance (₹)',
    group: 'Net Balance',
    accessor: (d) => d.netUpi,
  },
];

interface DailyFlowManagerProps {
  initialIncome: IncomeRecord[];
  initialExpenses: ExpenseRecord[];
  initialMoneyPosition?: MoneyPosition;
}

export function DailyFlowManager({
  initialIncome,
  initialExpenses,
  initialMoneyPosition,
}: DailyFlowManagerProps) {
  const router = useRouter();
  const [income, setIncome] = useState<IncomeRecord[]>(initialIncome);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initialExpenses);
  const [viewMode, setViewMode] = useViewMode('daily_flow');
  const [isRefreshing, startRefresh] = useTransition();

  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [inspectingDate, setInspectingDate] = useState<string | null>(null);

  // Calculate day-by-day aggregated records and summary
  const { dailyRecords, summary } = useMemo(() => {
    return calcDailyFlowRecords(income, expenses);
  }, [income, expenses]);

  // Refresh handler
  const handleRefresh = () => {
    startRefresh(async () => {
      try {
        const [incRes, expRes] = await Promise.all([
          fetch('/api/income').then((r) => r.json()).catch(() => null),
          fetch('/api/expenses').then((r) => r.json()).catch(() => null),
        ]);

        if (incRes?.success && incRes?.data?.income) {
          setIncome(incRes.data.income);
        }
        if (expRes?.success && expRes?.data?.expenses) {
          setExpenses(expRes.data.expenses);
        }
        router.refresh();
      } catch (err) {
        console.error('Failed to sync daily flow:', err);
      }
    });
  };

  // Filter & Search daily records
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 7 days ago key
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    const sevenDaysKey = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;

    // 30 days ago key
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyDaysKey = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;

    // Current month prefix
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return dailyRecords
      .filter((rec) => {
        // Date range preset filter
        if (dateRangePreset === 'TODAY' && rec.date !== todayKey) {
          return false;
        }
        if (dateRangePreset === 'LAST_7_DAYS' && rec.date < sevenDaysKey) {
          return false;
        }
        if (dateRangePreset === 'LAST_30_DAYS' && rec.date < thirtyDaysKey) {
          return false;
        }
        if (dateRangePreset === 'THIS_MONTH' && !rec.date.startsWith(currentMonthPrefix)) {
          return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesDate =
            rec.date.toLowerCase().includes(q) ||
            rec.displayDate.toLowerCase().includes(q) ||
            rec.dayOfWeek.toLowerCase().includes(q);

          if (matchesDate) return true;

          // Check inside underlying income records
          const matchesIncome = rec.incomeRecords.some(
            (i) =>
              i.contributor.toLowerCase().includes(q) ||
              i.type.toLowerCase().includes(q) ||
              (i.description && i.description.toLowerCase().includes(q)) ||
              (i.notes && i.notes.toLowerCase().includes(q))
          );
          if (matchesIncome) return true;

          // Check inside underlying expense records
          const matchesExpense = rec.expenseRecords.some(
            (e) =>
              e.paid_by.toLowerCase().includes(q) ||
              e.category.toLowerCase().includes(q) ||
              (e.description && e.description.toLowerCase().includes(q)) ||
              (e.notes && e.notes.toLowerCase().includes(q))
          );
          if (matchesExpense) return true;

          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'asc') {
          return a.date.localeCompare(b.date);
        }
        return b.date.localeCompare(a.date);
      });
  }, [dailyRecords, dateRangePreset, searchQuery, sortOrder]);

  const selectedInspectingRecord = useMemo(() => {
    if (!inspectingDate) return null;
    return dailyRecords.find((r) => r.date === inspectingDate) || null;
  }, [inspectingDate, dailyRecords]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Daily Flow</h1>
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
              Cash & UPI Tracker
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Track daily incoming, outgoing expenses, and net cashflow balance across Cash & UPI.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1.5 text-xs"
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
            {isRefreshing ? 'Syncing…' : 'Sync'}
          </Button>

          <ExportCsvDialog
            title="Export Daily Cash Flow"
            description="Export day-by-day cash, UPI, and total net flow summaries to CSV."
            defaultFilename={`orah_daily_flow_${new Date().toISOString().slice(0, 10)}.csv`}
            data={dailyRecords}
            filteredData={filteredRecords}
            fields={DAILY_FLOW_EXPORT_FIELDS}
            storageKey="daily_flow"
          />

          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push('/income')}
            className="gap-1.5 text-xs"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Income
          </Button>

          <Button
            size="sm"
            onClick={() => router.push('/expenses')}
            className="gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Expense
          </Button>
        </div>
      </div>

      {/* Top Hero KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Income KPI */}
        <KpiCard
          title="Total Income"
          value={formatINR(summary.totalIncome)}
          subtitle={`Cash: ${formatINR(summary.incomeCash)} · UPI: ${formatINR(summary.incomeUpi)}`}
          accentClass="from-emerald-500 to-teal-600"
          trend="up"
          trendLabel="All Income"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />

        {/* Total Outgoing KPI */}
        <KpiCard
          title="Total Outgoing"
          value={formatINR(summary.totalExpense)}
          subtitle={`Cash: ${formatINR(summary.expenseCash)} · UPI: ${formatINR(summary.expenseUpi)}`}
          accentClass="from-rose-500 to-red-600"
          trend="down"
          trendLabel="All Expenses"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          }
        />

        {/* Net Flow KPI */}
        <KpiCard
          title="Net Cashflow"
          value={`${summary.netFlow >= 0 ? '+' : ''}${formatINR(summary.netFlow)}`}
          subtitle={`Net Cash: ${formatINR(summary.netCash)} · Net UPI: ${formatINR(summary.netUpi)}`}
          accentClass={
            summary.netFlow >= 0
              ? 'from-teal-500 to-emerald-600'
              : 'from-amber-500 to-rose-600'
          }
          trend={summary.netFlow >= 0 ? 'up' : 'down'}
          trendLabel={summary.netFlow >= 0 ? 'Surplus' : 'Deficit'}
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
          }
        />

        {/* Today's Activity KPI */}
        <KpiCard
          title="Today's Flow"
          value={`${summary.todayNet >= 0 ? '+' : ''}${formatINR(summary.todayNet)}`}
          subtitle={`In: +${formatINR(summary.todayIncome)} · Out: -${formatINR(summary.todayExpense)}`}
          accentClass="from-indigo-500 to-violet-600"
          trend={summary.todayNet >= 0 ? 'up' : 'down'}
          trendLabel="Today"
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          }
        />
      </section>

      {/* Cash vs UPI Side-by-Side Summary Bar */}
      <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-border/50">
          {/* Cash Summary */}
          <div className="flex items-center justify-between gap-4 pr-0 md:pr-4 pt-2 md:pt-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-sm">
                💵
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cash Flow
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    +{formatINR(summary.incomeCash)} In
                  </span>
                  <span>·</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    -{formatINR(summary.expenseCash)} Out
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Net Cash</span>
              <span
                className={`text-sm sm:text-base font-bold ${
                  summary.netCash >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {summary.netCash >= 0 ? '+' : ''}
                {formatINR(summary.netCash)}
              </span>
            </div>
          </div>

          {/* UPI Summary */}
          <div className="flex items-center justify-between gap-4 pl-0 md:pl-4 pt-3 md:pt-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-sm">
                📱
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  UPI Flow
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    +{formatINR(summary.incomeUpi)} In
                  </span>
                  <span>·</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    -{formatINR(summary.expenseUpi)} Out
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Net UPI</span>
              <span
                className={`text-sm sm:text-base font-bold ${
                  summary.netUpi >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {summary.netUpi >= 0 ? '+' : ''}
                {formatINR(summary.netUpi)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
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
              placeholder="Search by date (e.g. 25 Aug), payee, contributor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
            {/* Date Range Preset */}
            <Select value={dateRangePreset} onValueChange={(v) => setDateRangePreset(v ?? 'ALL')}>
              <SelectTrigger className="text-xs h-8 min-w-[130px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Time ({dailyRecords.length} days)</SelectItem>
                <SelectItem value="TODAY">Today Only</SelectItem>
                <SelectItem value="LAST_7_DAYS">Last 7 Days</SelectItem>
                <SelectItem value="LAST_30_DAYS">Last 30 Days</SelectItem>
                <SelectItem value="THIS_MONTH">This Month</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="text-xs h-8 px-2.5 gap-1 text-muted-foreground hover:text-foreground"
              title="Toggle sort order"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 16 4 4 4-4" />
                <path d="M7 20V4" />
                <path d="m21 8-4-4-4 4" />
                <path d="M17 4v16" />
              </svg>
              <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </Button>

            {/* View Mode Toggle (Cards for mobile default, Table for desktop default) */}
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Active filter indicators */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
          <span>
            Showing <strong className="text-foreground">{filteredRecords.length}</strong> active{' '}
            {filteredRecords.length === 1 ? 'day' : 'days'}
          </span>
          {(searchQuery || dateRangePreset !== 'ALL') && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSearchQuery('');
                setDateRangePreset('ALL');
              }}
              className="text-[11px] text-primary h-6 px-1.5"
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {/* Main Content View: Cards vs Table */}
      {filteredRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground text-xl">
            📅
          </div>
          <h3 className="mt-3 text-base font-semibold text-foreground">No daily records found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery || dateRangePreset !== 'ALL'
              ? 'No transactions matched your search or date filter. Try clearing the filters.'
              : 'Record your first income or expense to see daily cashflow tracking.'}
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View (Default for Mobile) */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecords.map((record) => (
            <DailyCardItem key={record.date} record={record} />
          ))}
        </div>
      ) : (
        /* Table View (Default for Desktop) */
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[160px] text-xs font-bold uppercase tracking-wider">
                    Date
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Income (Total)
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    Income (Cash / UPI)
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                    Outgoing (Total)
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    Outgoing (Cash / UPI)
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right">
                    Net Flow
                  </TableHead>
                  <TableHead className="w-[120px] text-right text-xs font-bold uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => {
                  const isExpanded = expandedDate === record.date;
                  const isNetPositive = record.netTotal >= 0;
                  const totalCount = record.incomeCount + record.expenseCount;

                  return (
                    <>
                      <TableRow
                        key={record.date}
                        className={`transition-colors cursor-pointer ${
                          isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20'
                        }`}
                        onClick={() =>
                          setExpandedDate(isExpanded ? null : record.date)
                        }
                      >
                        {/* Date Column */}
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-bold text-foreground">
                                {record.displayDate}
                              </span>
                              {record.isToday && (
                                <Badge className="bg-emerald-500 text-white text-[9px] py-0 px-1.5 animate-pulse">
                                  Today
                                </Badge>
                              )}
                              {record.isYesterday && (
                                <Badge variant="secondary" className="text-[9px] py-0 px-1.5">
                                  Yesterday
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {record.dayOfWeek}
                            </span>
                          </div>
                        </TableCell>

                        {/* Income Total Column */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              +{formatINR(record.incomeTotal)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {record.incomeCount} {record.incomeCount === 1 ? 'entry' : 'entries'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Income Split Column (Desktop) */}
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                              Cash: <strong className="text-foreground">{formatINR(record.incomeCash)}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
                              UPI: <strong className="text-foreground">{formatINR(record.incomeUpi)}</strong>
                            </span>
                          </div>
                        </TableCell>

                        {/* Outgoing Total Column */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400">
                              -{formatINR(record.expenseTotal)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {record.expenseCount} {record.expenseCount === 1 ? 'entry' : 'entries'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Outgoing Split Column (Desktop) */}
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                              Cash: <strong className="text-foreground">{formatINR(record.expenseCash)}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
                              UPI: <strong className="text-foreground">{formatINR(record.expenseUpi)}</strong>
                            </span>
                          </div>
                        </TableCell>

                        {/* Net Flow Column */}
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span
                              className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-black ${
                                isNetPositive
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              {isNetPositive ? '+' : ''}
                              {formatINR(record.netTotal)}
                            </span>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>Cash: {formatINR(record.netCash)}</span>
                              <span>·</span>
                              <span>UPI: {formatINR(record.netUpi)}</span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Actions Column */}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setInspectingDate(record.date)}
                              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                              title="Inspect transactions"
                            >
                              {totalCount} details
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              onClick={() =>
                                setExpandedDate(isExpanded ? null : record.date)
                              }
                              className="h-7 w-7 p-0"
                              title={isExpanded ? 'Collapse' : 'Expand'}
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
                                className={`transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expandable Sub-Row */}
                      {isExpanded && (
                        <TableRow className="bg-muted/15 hover:bg-muted/15 border-b border-border/60">
                          <TableCell colSpan={7} className="p-3 sm:p-4">
                            <div className="rounded-xl border border-border/50 bg-background/80 p-3 sm:p-4 shadow-inner">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                  Transactions on {record.displayDate} ({record.dayOfWeek})
                                </h4>
                                <Button
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setExpandedDate(null)}
                                  className="text-xs text-muted-foreground hover:text-foreground h-6"
                                >
                                  Close
                                </Button>
                              </div>
                              <DailyTransactionsList
                                incomeRecords={record.incomeRecords}
                                expenseRecords={record.expenseRecords}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Transaction Inspection Dialog */}
      {selectedInspectingRecord && (
        <Dialog open={Boolean(selectedInspectingRecord)} onOpenChange={() => setInspectingDate(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Transactions for {selectedInspectingRecord.displayDate}</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {selectedInspectingRecord.dayOfWeek}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Detailed itemized breakdown of income and outgoing expenses.
              </DialogDescription>
            </DialogHeader>

            {/* Quick KPI recap for this specific day */}
            <div className="grid grid-cols-3 gap-2.5 rounded-xl border border-border/50 bg-muted/20 p-3 my-2">
              <div className="text-center">
                <span className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400 block">
                  Income
                </span>
                <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                  +{formatINR(selectedInspectingRecord.incomeTotal)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Cash: {formatINR(selectedInspectingRecord.incomeCash)} · UPI: {formatINR(selectedInspectingRecord.incomeUpi)}
                </span>
              </div>

              <div className="text-center border-x border-border/50 px-1">
                <span className="text-[10px] uppercase font-semibold text-rose-700 dark:text-rose-400 block">
                  Outgoing
                </span>
                <span className="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400">
                  -{formatINR(selectedInspectingRecord.expenseTotal)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Cash: {formatINR(selectedInspectingRecord.expenseCash)} · UPI: {formatINR(selectedInspectingRecord.expenseUpi)}
                </span>
              </div>

              <div className="text-center">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                  Net Balance
                </span>
                <span
                  className={`text-sm sm:text-base font-black ${
                    selectedInspectingRecord.netTotal >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {selectedInspectingRecord.netTotal >= 0 ? '+' : ''}
                  {formatINR(selectedInspectingRecord.netTotal)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Net Cash: {formatINR(selectedInspectingRecord.netCash)}
                </span>
              </div>
            </div>

            {/* Itemized listing */}
            <div className="mt-3">
              <DailyTransactionsList
                incomeRecords={selectedInspectingRecord.incomeRecords}
                expenseRecords={selectedInspectingRecord.expenseRecords}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
