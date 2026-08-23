// lib/types.ts
// Central TypeScript types for all financial data

export type MoneyType = 'Cash' | 'UPI';

export type IncomeType =
  | 'Registration'
  | 'Donation'
  | 'Personal Commitment'
  | 'Finance Call'
  | 'Commitment'
  | 'Church'
  | 'Coupon'
  | 'Sponsor'
  | 'Other';

export type ExpenseCategory =
  | 'Food'
  | 'Venue'
  | 'Transport'
  | 'Accommodation'
  | 'Printing'
  | 'Decoration'
  | 'Equipment'
  | 'Media'
  | 'Marketing'
  | 'Stationery'
  | 'Security'
  | 'Medical'
  | 'Miscellaneous'
  | string;

export type PaymentSource = 'Personal' | 'Event' | 'Personal Money' | 'Event Money';
export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected';
export type CommitmentStatus = 'Pending' | 'Partially Received' | 'Fully Received' | 'Cancelled';
export type ReimbursementStatus = 'Pending' | 'Paid';
export type SettlementStatus = 'Direct' | 'Advance Given' | 'Settled';

export interface IncomeRecord {
  id: string;
  date: string;
  type: IncomeType;
  contributor: string;
  mobile_number?: string | null;
  description: string;
  amount: number;
  money_type: MoneyType;
  is_handed_over?: boolean | null;
  screenshot_link?: string | null;
  notes?: string | null;
  reference_id?: string | null;
  commitment_id?: string | null;
  created_at?: string;
}

export interface PersonalCommitmentRecord {
  id: string;
  person_name: string;
  mobile_number?: string | null;
  caller_name?: string | null;
  promised: number;
  received: number;
  money_type?: MoneyType | null;
  is_handed_over?: boolean | null;
  screenshot_link?: string | null;
  status: CommitmentStatus;
  notes?: string | null;
  created_at?: string;
}

export interface FinanceCallRecord {
  id: string;
  person_name: string;
  mobile_number?: string | null;
  caller_name?: string | null;
  promised: number;
  received: number;
  money_type?: MoneyType | null;
  is_handed_over?: boolean | null;
  screenshot_link?: string | null;
  status: CommitmentStatus;
  notes?: string | null;
  created_at?: string;
}

export interface CouponRecord {
  id: string;
  contributor_name: string;
  mobile_number?: string | null;
  date: string;
  money_type: MoneyType;
  amount: number;
  is_handed_over?: boolean | null;
  collected_by?: string | null;
  booklet_number?: string | null;
  notes?: string | null;
  screenshot_link?: string | null;
  created_at?: string;
}

export interface ChurchDonationRecord {
  id: string;
  church_name: string;
  contact_number?: string | null;
  date: string;
  collected_by?: string | null;
  money_type: MoneyType;
  amount: number;
  is_handed_over?: boolean | null;
  notes?: string | null;
  screenshot_link?: string | null;
  created_at?: string;
}

// Alias for generic commitment calculations
export type CommitmentRecord = PersonalCommitmentRecord;

export interface ExpenseRecord {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  money_type: MoneyType;
  paid_by: string;
  mobile_number?: string | null;
  payment_source: PaymentSource;
  status: ExpenseStatus;
  has_receipt: boolean;
  receipt_link?: string | null;
  notes?: string | null;
  created_at?: string;

  // Advance disbursement & multi-channel settlement tracking
  advance_amount?: number | null;
  advance_money_type?: MoneyType | null;
  settlement_status?: SettlementStatus | null;
  balance_amount?: number | null;
  balance_money_type?: MoneyType | null;
  settled_at?: string | null;
}

export interface BudgetCategory {
  id?: number;
  category: ExpenseCategory;
  description?: string | null;
  planned: number;
  created_at?: string;
}

export interface ReimbursementRecord {
  id: string;
  date: string;
  person: string;
  mobile_number?: string | null;
  expense_id: string;
  amount: number;
  status: ReimbursementStatus;
  money_type_paid?: MoneyType | null;
  notes?: string | null;
  created_at?: string;
}

// Dashboard computed types
export interface MoneyPosition {
  cashAvailable: number;
  cashPendingHandover: number;
  totalCash: number;
  upiAvailable: number;
  total: number;
}

export interface IncomeSummary {
  totalExpected: number;
  totalReceived: number;
  totalPending: number;
}

export interface CommitmentSummary {
  totalPromised: number;
  totalReceived: number;
  totalPending: number;
  fullyReceivedCount: number;
  pendingCount: number;
}

export interface FinanceCallSummary {
  totalPromised: number;
  totalReceived: number;
  totalPending: number;
  fullyReceivedCount: number;
  pendingCount: number;
}

export interface AdvanceSummary {
  totalAdvanceDisbursed: number;
  totalPendingSettlement: number;
  pendingCount: number;
  settledCount: number;
}

export interface BudgetRow extends BudgetCategory {
  actual: number;
  remaining: number;
  utilizationPct: number;
  statusLabel: 'Healthy' | 'Warning' | 'Critical';
}
