'use client';

import { ExportCsvDialog, type ExportField } from '@/components/finance/export';

export interface DashboardTransaction {
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

interface DashboardExportDialogProps {
  data: DashboardTransaction[];
}

export function DashboardExportDialog({ data }: DashboardExportDialogProps) {
  return (
    <ExportCsvDialog
      title="Export Master Financial Ledger"
      description="Export all unified income and expenditure transactions across Campus Meet 2026."
      defaultFilename={`orah_master_transactions_${new Date().toISOString().slice(0, 10)}.csv`}
      data={data}
      fields={DASHBOARD_EXPORT_FIELDS}
      storageKey="dashboard_transactions"
    />
  );
}

