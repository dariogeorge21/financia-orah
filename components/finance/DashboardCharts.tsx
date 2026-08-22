'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { BudgetRow, CommitmentSummary, FinanceCallSummary } from '@/lib/types';
import { formatINR } from '@/lib/calculations';

const CHART_COLORS = [
  '#7c3aed', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ef4444', // red
  '#06b6d4', // cyan
  '#8b5cf6', // purple
  '#14b8a6', // teal
];

interface Props {
  incomeByType: { name: string; value: number }[];
  expenseByCategory: { name: string; value: number }[];
  budgetRows: BudgetRow[];
  personalCommitments?: CommitmentSummary;
  financeCalls?: FinanceCallSummary;
}

function INRTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
        {label && <p className="font-medium text-foreground mb-1">{label}</p>}
        {payload.map((p, i) => (
          <p key={i} className="text-muted-foreground">
            {p.name}: <span className="font-semibold text-foreground">{formatINR(p.value)}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function DashboardCharts({
  incomeByType,
  expenseByCategory,
  budgetRows,
  personalCommitments,
  financeCalls,
}: Props) {
  const budgetChartData = budgetRows.map((r) => ({
    name: r.category.slice(0, 7),
    Planned: r.planned,
    Actual: r.actual,
  }));

  const driveComparisonData = [
    {
      name: 'Personal Pledges',
      Promised: personalCommitments?.totalPromised ?? 0,
      Received: personalCommitments?.totalReceived ?? 0,
      Pending: personalCommitments?.totalPending ?? 0,
    },
    {
      name: 'Finance Calls',
      Promised: financeCalls?.totalPromised ?? 0,
      Received: financeCalls?.totalReceived ?? 0,
      Pending: financeCalls?.totalPending ?? 0,
    },
  ];

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      {/* Income by Type — Donut Chart */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Income Sources Distribution</h3>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={incomeByType}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
            >
              {incomeByType.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<INRTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Commitments & Calls Drive Comparison */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Pledges vs Calls Drive Comparison</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={driveComparisonData} margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<INRTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
            <Bar dataKey="Promised" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Pending" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Expense by Category — Horizontal Bar */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Top Approved Expenses</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            layout="vertical"
            data={expenseByCategory.slice(0, 8)}
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="opacity-10" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
            <Tooltip content={<INRTooltip />} />
            <Bar dataKey="value" name="Spent" radius={[0, 4, 4, 0]} fill="#7c3aed" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Budget Utilization — Stacked Bar */}
      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Budget Utilization — Planned vs Actual</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={budgetChartData} margin={{ left: 8, right: 16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<INRTooltip />} />
            <Legend
              iconType="square"
              iconSize={10}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
            <Bar dataKey="Planned" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Actual" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
