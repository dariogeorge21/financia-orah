import { createClient } from '@/lib/supabase/server';
import {
  calcMoneyPosition,
  calcIncomeSummary,
  calcPersonalCommitmentSummary,
  calcFinanceCallSummary,
  calcChurchSummary,
  calcCouponSummary,
  calcBudgetRows,
  calcFeeSummary,
  formatINR,
  incomeByType,
  expenseByCategory,
} from '@/lib/calculations';
import { fetchServerFees } from '@/app/api/fees/route';
import { KpiCard } from '@/components/finance/KpiCard';
import { DashboardCharts } from '@/components/finance/DashboardCharts';
import { RecentTransactions } from '@/components/finance/RecentTransactions';
import type {
  IncomeRecord,
  ExpenseRecord,
  PersonalCommitmentRecord,
  FinanceCallRecord,
  ChurchDonationRecord,
  CouponRecord,
  ReimbursementRecord,
  BudgetCategory,
} from '@/lib/types';
import Link from 'next/link';
import { ExportCsvDialog, type ExportField } from '@/components/finance/export';

interface DashboardTransaction {
  id: string;
  type: 'Income' | 'Expense';
  categoryOrType: string;
  party: string;
  amount: number;
  money_type: string;
  date: string;
  status: string;
  notes: string;
}

const DASHBOARD_EXPORT_FIELDS: ExportField<DashboardTransaction>[] = [
  {
    key: 'date',
    label: 'Date',
    group: 'Transaction Info',
    accessor: (t) => t.date,
  },
  {
    key: 'type',
    label: 'Entry Type (Income/Expense)',
    group: 'Transaction Info',
    accessor: (t) => t.type,
  },
  {
    key: 'categoryOrType',
    label: 'Category / Source',
    group: 'Transaction Info',
    accessor: (t) => t.categoryOrType,
  },
  {
    key: 'party',
    label: 'Contributor / Paid By',
    group: 'Transaction Info',
    accessor: (t) => t.party,
  },
  {
    key: 'amount',
    label: 'Amount (₹)',
    group: 'Financials',
    accessor: (t) => t.amount,
  },
  {
    key: 'money_type',
    label: 'Payment Mode',
    group: 'Financials',
    accessor: (t) => t.money_type,
  },
  {
    key: 'status',
    label: 'Status',
    group: 'Financials',
    accessor: (t) => t.status,
  },
  {
    key: 'notes',
    label: 'Remarks / Notes',
    group: 'Additional Info',
    defaultSelected: true,
    accessor: (t) => t.notes || '',
  },
  {
    key: 'id',
    label: 'Transaction ID',
    group: 'Audit & System',
    defaultSelected: false,
    accessor: (t) => t.id,
  },
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const [incRes, expRes, pComRes, fcRes, reimRes, budRes, churchRes, couponRes, fees] = await Promise.all([
    supabase.from('income').select('*').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('personal_commitments').select('*').order('created_at', { ascending: false }),
    supabase.from('finance_calls').select('*').order('created_at', { ascending: false }),
    supabase.from('reimbursements').select('*').order('date', { ascending: false }),
    supabase.from('budget').select('*').order('category'),
    supabase.from('church_donations').select('*').order('created_at', { ascending: false }),
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
    fetchServerFees(),
  ]);

  const income = (incRes.data ?? []) as IncomeRecord[];
  const expenses = (expRes.data ?? []) as ExpenseRecord[];
  const personalCommitments = (pComRes.data ?? []) as PersonalCommitmentRecord[];
  const financeCalls = (fcRes.data ?? []) as FinanceCallRecord[];
  const reimbursements = (reimRes.data ?? []) as ReimbursementRecord[];
  const budgets = (budRes.data ?? []) as BudgetCategory[];
  const churchDonations = (churchRes.data ?? []) as ChurchDonationRecord[];
  const coupons = (couponRes.data ?? []) as CouponRecord[];

  const money = calcMoneyPosition(income, expenses, reimbursements);
  const incomeSummary = calcIncomeSummary(income, personalCommitments, financeCalls);
  const pComSummary = calcPersonalCommitmentSummary(personalCommitments);
  const fcSummary = calcFinanceCallSummary(financeCalls);
  const churchSummary = calcChurchSummary(churchDonations);
  const couponSummary = calcCouponSummary(coupons);
  const budgetRows = calcBudgetRows(budgets, expenses);
  const feeSummary = calcFeeSummary(fees);

  const incomeChart = incomeByType(income);
  const expenseChart = expenseByCategory(expenses);

  const recentIncome = income.slice(0, 5);
  const recentExpenses = expenses.slice(0, 5);

  const masterTransactions: DashboardTransaction[] = [
    ...income.map((i) => ({
      id: i.id,
      type: 'Income' as const,
      categoryOrType: i.type,
      party: i.contributor,
      amount: Number(i.amount),
      money_type: i.money_type,
      date: i.date,
      status: i.is_handed_over === false ? 'Cash Pending Handover' : 'Received',
      notes: i.notes || i.description || '',
    })),
    ...expenses.map((e) => ({
      id: e.id,
      type: 'Expense' as const,
      categoryOrType: e.category,
      party: e.paid_by,
      amount: -Number(e.amount),
      money_type: e.money_type,
      date: e.created_at ? e.created_at.slice(0, 10) : '',
      status: e.status,
      notes: e.notes || e.description || '',
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Financial command center for Orah – Campus Meet 2026
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvDialog
            title="Export Master Financial Ledger"
            description="Export all unified income and expenditure transactions across Campus Meet 2026."
            defaultFilename={`orah_master_transactions_${new Date().toISOString().slice(0, 10)}.csv`}
            data={masterTransactions}
            fields={DASHBOARD_EXPORT_FIELDS}
            storageKey="dashboard_transactions"
          />
          <Link
            href="/income"
            className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            + New Income
          </Link>
          <Link
            href="/expenses"
            className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            + New Expense
          </Link>
        </div>
      </div>

      {/* Money Position — Hero KPIs */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Money Position
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Cash Available"
            value={formatINR(money.cashAvailable)}
            subtitle={
              money.cashPendingHandover > 0
                ? `In hand (${formatINR(money.cashPendingHandover)} pending handover)`
                : 'Physical cash in hand'
            }
            accentClass="from-emerald-500 to-teal-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            }
          />
          <KpiCard
            title="UPI / Digital Balance"
            value={formatINR(money.upiAvailable)}
            subtitle="Bank & UPI balance"
            accentClass="from-indigo-500 to-violet-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />
          <KpiCard
            title="Total Available Funds"
            value={formatINR(money.total)}
            subtitle="Cash + UPI combined"
            accentClass="from-violet-500 to-purple-700"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" /><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Income & Overview Summary */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Overall Income Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Total Received Income"
            value={formatINR(incomeSummary.totalReceived)}
            subtitle="All collected funds"
            accentClass="from-emerald-500 to-green-600"
            trend="up"
            trendLabel="Received"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
          />
          <KpiCard
            title="Total Pending Commitments"
            value={formatINR(incomeSummary.totalPending)}
            subtitle="Personal + Finance Calls"
            accentClass="from-amber-500 to-orange-600"
            trend="neutral"
            trendLabel="Pending"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
          <KpiCard
            title="Projected Total Income"
            value={formatINR(incomeSummary.totalExpected)}
            subtitle="Received + all pending pledges"
            accentClass="from-sky-500 to-cyan-600"
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Two-Column Breakdown: Personal Commitments & Finance Calls */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Personal Commitments Box */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Personal Commitments</h3>
              <p className="text-xs text-muted-foreground">Individual pledges & contributions</p>
            </div>
            <Link href="/personal-commitments" className="text-xs font-medium text-primary hover:underline">
              View all ({personalCommitments.length}) →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Promised</p>
              <p className="text-base font-bold text-foreground">{formatINR(pComSummary.totalPromised)}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Received</p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatINR(pComSummary.totalReceived)}</p>
            </div>
            <div className="rounded-xl bg-rose-500/10 p-3">
              <p className="text-xs text-rose-600 dark:text-rose-400">Pending</p>
              <p className="text-base font-bold text-rose-600 dark:text-rose-400">{formatINR(pComSummary.totalPending)}</p>
            </div>
          </div>
        </div>

        {/* Finance Calls Box */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Finance Calls</h3>
              <p className="text-xs text-muted-foreground">Telethon & sponsor outreach calls</p>
            </div>
            <Link href="/finance-calls" className="text-xs font-medium text-primary hover:underline">
              View all ({financeCalls.length}) →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Promised</p>
              <p className="text-base font-bold text-foreground">{formatINR(fcSummary.totalPromised)}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Received</p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatINR(fcSummary.totalReceived)}</p>
            </div>
            <div className="rounded-xl bg-rose-500/10 p-3">
              <p className="text-xs text-rose-600 dark:text-rose-400">Pending</p>
              <p className="text-base font-bold text-rose-600 dark:text-rose-400">{formatINR(fcSummary.totalPending)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Column Breakdown: Church & Convents and Coupons */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Church & Convents Box */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Church & Convents</h3>
              <p className="text-xs text-muted-foreground">Parish, church & convent collections</p>
            </div>
            <Link href="/church-donations" className="text-xs font-medium text-primary hover:underline">
              View all ({churchDonations.length}) →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="text-base font-bold text-foreground">{formatINR(churchSummary.totalAmount)}</p>
            </div>
            <div className="rounded-xl bg-indigo-500/10 p-3">
              <p className="text-xs text-indigo-600 dark:text-indigo-400">UPI Received</p>
              <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">{formatINR(churchSummary.upiAmount)}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Cash Received</p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(churchSummary.cashHandedOver)}
                {churchSummary.cashPending > 0 && (
                  <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                    +{formatINR(churchSummary.cashPending)} pending
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Coupons Box */}
        <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Coupons</h3>
              <p className="text-xs text-muted-foreground">Coupon booklet & stall sales</p>
            </div>
            <Link href="/coupons" className="text-xs font-medium text-primary hover:underline">
              View all ({coupons.length}) →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Total Collected</p>
              <p className="text-base font-bold text-foreground">{formatINR(couponSummary.totalAmount)}</p>
            </div>
            <div className="rounded-xl bg-indigo-500/10 p-3">
              <p className="text-xs text-indigo-600 dark:text-indigo-400">UPI Received</p>
              <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">{formatINR(couponSummary.upiAmount)}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3">
              <p className="text-xs text-emerald-600 dark:text-emerald-400">Cash Received</p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(couponSummary.cashHandedOver)}
                {couponSummary.cashPending > 0 && (
                  <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                    +{formatINR(couponSummary.cashPending)} pending
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Charts */}
      <DashboardCharts
        incomeByType={incomeChart}
        expenseByCategory={expenseChart}
        budgetRows={budgetRows}
        personalCommitments={pComSummary}
        financeCalls={fcSummary}
      />

      {/* Registration Fees & Check-In Dues KPI (Minimal Summary) */}
      <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
                <path d="M12 14v2" />
                <path d="M16 14v2" />
                <path d="M8 14v2" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                Event Registration Fees & Dues
              </h3>
              <p className="text-xs text-muted-foreground">
                Live desk collections from {feeSummary.checkedInCount} checked-in attendee{feeSummary.checkedInCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <Link
            href="/fees"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Open Fees Manager ({fees.length}) →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="rounded-xl bg-muted/40 p-3.5">
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <p className="text-base font-bold text-foreground tabular-nums">
              {formatINR(feeSummary.totalCollected)}
            </p>
            <span className="text-[10px] text-muted-foreground font-medium">
              Rate: {feeSummary.collectionRate}%
            </span>
          </div>

          <div className="rounded-xl bg-teal-500/10 p-3.5">
            <p className="text-xs text-teal-700 dark:text-teal-300">Cash Collected</p>
            <p className="text-base font-bold text-teal-700 dark:text-teal-300 tabular-nums">
              {formatINR(feeSummary.cashCollected)}
            </p>
            <span className="text-[10px] text-teal-600/80 dark:text-teal-400/80 font-medium">
              {feeSummary.cashCount} cash payer{feeSummary.cashCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="rounded-xl bg-indigo-500/10 p-3.5">
            <p className="text-xs text-indigo-700 dark:text-indigo-300">UPI Collected</p>
            <p className="text-base font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
              {formatINR(feeSummary.upiCollected)}
            </p>
            <span className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 font-medium">
              {feeSummary.upiCount} UPI QR payer{feeSummary.upiCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="rounded-xl bg-rose-500/10 p-3.5">
            <p className="text-xs text-rose-700 dark:text-rose-300">Pending Dues</p>
            <p className="text-base font-bold text-rose-700 dark:text-rose-300 tabular-nums">
              {formatINR(feeSummary.totalDue)}
            </p>
            <span className="text-[10px] text-rose-600/80 dark:text-rose-400/80 font-medium">
              {feeSummary.partiallyPaidCount + feeSummary.laterPayCount + feeSummary.notPaidCount} attendee{feeSummary.partiallyPaidCount + feeSummary.laterPayCount + feeSummary.notPaidCount === 1 ? '' : 's'} with dues
            </span>
          </div>
        </div>
      </section>

      {/* Recent Transactions */}
      <RecentTransactions income={recentIncome} expenses={recentExpenses} />
    </div>
  );
}
