import { createClient } from '@/lib/supabase/server';
import {
  calcMoneyPosition,
  calcIncomeSummary,
  calcPersonalCommitmentSummary,
  calcFinanceCallSummary,
  calcBudgetRows,
  formatINR,
  incomeByType,
  expenseByCategory,
} from '@/lib/calculations';
import { KpiCard } from '@/components/finance/KpiCard';
import { DashboardCharts } from '@/components/finance/DashboardCharts';
import { RecentTransactions } from '@/components/finance/RecentTransactions';
import type {
  IncomeRecord,
  ExpenseRecord,
  PersonalCommitmentRecord,
  FinanceCallRecord,
  ReimbursementRecord,
  BudgetCategory,
} from '@/lib/types';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();

  const [incRes, expRes, pComRes, fcRes, reimRes, budRes] = await Promise.all([
    supabase.from('income').select('*').order('date', { ascending: false }),
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('personal_commitments').select('*').order('created_at', { ascending: false }),
    supabase.from('finance_calls').select('*').order('created_at', { ascending: false }),
    supabase.from('reimbursements').select('*').order('date', { ascending: false }),
    supabase.from('budget').select('*').order('category'),
  ]);

  const income = (incRes.data ?? []) as IncomeRecord[];
  const expenses = (expRes.data ?? []) as ExpenseRecord[];
  const personalCommitments = (pComRes.data ?? []) as PersonalCommitmentRecord[];
  const financeCalls = (fcRes.data ?? []) as FinanceCallRecord[];
  const reimbursements = (reimRes.data ?? []) as ReimbursementRecord[];
  const budgets = (budRes.data ?? []) as BudgetCategory[];

  const money = calcMoneyPosition(income, expenses, reimbursements);
  const incomeSummary = calcIncomeSummary(income, personalCommitments, financeCalls);
  const pComSummary = calcPersonalCommitmentSummary(personalCommitments);
  const fcSummary = calcFinanceCallSummary(financeCalls);
  const budgetRows = calcBudgetRows(budgets, expenses);

  const incomeChart = incomeByType(income);
  const expenseChart = expenseByCategory(expenses);

  const recentIncome = income.slice(0, 5);
  const recentExpenses = expenses.slice(0, 5);

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
            subtitle="Physical cash in hand"
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

      {/* Charts */}
      <DashboardCharts
        incomeByType={incomeChart}
        expenseByCategory={expenseChart}
        budgetRows={budgetRows}
        personalCommitments={pComSummary}
        financeCalls={fcSummary}
      />

      {/* Recent Transactions */}
      <RecentTransactions income={recentIncome} expenses={recentExpenses} />
    </div>
  );
}
