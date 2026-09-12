// lib/types.ts
// Central TypeScript types for all financial data

export type MoneyType = 'Cash' | 'UPI';

export type IncomeType =
  | 'Donation'
  | 'Registration'
  | 'Personal Commitment'
  | 'Finance Call'
  | 'Commitment'
  | 'Church'
  | 'Church/Convent'
  | 'Coupon'
  | 'Sponsor'
  | 'Other'
  | (string & {});

export type ExpenseCategory =
  | 'Food'
  | 'Light and Sound'
  | 'Decoration (Arts)'
  | 'Material'
  | 'Mobilisation'
  | 'Confession + Counselling'
  | 'Resource Caring'
  | 'Office'
  | 'Registration'
  | 'AV'
  | 'Music'
  | 'Rent'
  | 'Volunteers Training'
  | 'Medical'
  | 'Intercession'
  | 'Media'
  | 'Venue'
  | 'Fuel'
  | 'Local Arrangement & Purchase'
  | 'Accommodation'
  | 'Extra (Miscellaneous)'
  | 'Cleaning'
  | 'Band'
  | 'Other'
  | string;

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Light and Sound',
  'Decoration (Arts)',
  'Material',
  'Mobilisation',
  'Confession + Counselling',
  'Resource Caring',
  'Office',
  'Registration',
  'AV',
  'Music',
  'Rent',
  'Volunteers Training',
  'Medical',
  'Intercession',
  'Media',
  'Venue',
  'Fuel',
  'Local Arrangement & Purchase',
  'Accommodation',
  'Extra (Miscellaneous)',
  'Cleaning',
  'Band',
];

export const BUDGET_CATEGORIES = EXPENSE_CATEGORIES;

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
  description?: string | null;
  amount: number;
  money_type: MoneyType;
  is_handed_over?: boolean | null;
  screenshot_link?: string | null;
  notes?: string | null;
  prayer_request?: string | null;
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
  due_date?: string | null;
  notes?: string | null;
  prayer_request?: string | null;
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
  prayer_request?: string | null;
  created_at?: string;
}

export type CouponPaymentMode = 'Cash' | 'UPI' | 'Cash + UPI';

export interface CouponRecord {
  id: string;
  contributor_name: string;
  mobile_number?: string | null;
  date: string;
  money_type: CouponPaymentMode;
  amount: number;
  cash_amount?: number | null;
  upi_amount?: number | null;
  is_handed_over?: boolean | null;
  collected_by?: string | null;
  booklet_number?: string | null;
  notes?: string | null;
  prayer_request?: string | null;
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
  prayer_request?: string | null;
  screenshot_link?: string | null;
  created_at?: string;
}

// Alias for generic commitment calculations
export type CommitmentRecord = PersonalCommitmentRecord;

export interface ExpenseRecord {
  id: string;
  category: ExpenseCategory;
  description?: string | null;
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

export interface ChurchSummary {
  totalAmount: number;
  upiAmount: number;
  cashHandedOver: number;
  cashPending: number;
  count: number;
}

export interface CouponSummary {
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  cashHandedOver: number;
  cashPending: number;
  count: number;
  splitCount: number;
}

export interface BudgetRow extends BudgetCategory {
  actual: number;
  remaining: number;
  utilizationPct: number;
  statusLabel: 'Healthy' | 'Warning' | 'Critical';
}

export interface DailyFlowRecord {
  date: string; // 'YYYY-MM-DD'
  displayDate: string; // formatted date
  dayOfWeek: string; // 'Monday', etc.
  isToday: boolean;
  isYesterday: boolean;

  // Income Breakdown
  incomeCash: number;
  incomeUpi: number;
  incomeTotal: number;
  incomeCount: number;

  // Outgoing / Expense Breakdown
  expenseCash: number;
  expenseUpi: number;
  expenseTotal: number;
  expenseCount: number;

  // Net Cash Flow for the Day
  netCash: number;
  netUpi: number;
  netTotal: number;

  // Raw records for detailed drilldowns
  incomeRecords: IncomeRecord[];
  expenseRecords: ExpenseRecord[];
}

export interface DailyFlowSummary {
  totalIncome: number;
  incomeCash: number;
  incomeUpi: number;

  totalExpense: number;
  expenseCash: number;
  expenseUpi: number;

  netFlow: number;
  netCash: number;
  netUpi: number;

  todayIncome: number;
  todayExpense: number;
  todayNet: number;

  totalDaysWithActivity: number;
}

export type PrayerStatus = 'Active' | 'Answered' | 'Archived';

export interface PrayerRequestRecord {
  id: string;
  person_name: string;
  mobile_number?: string | null;
  prayer_request: string;
  date: string; // 'YYYY-MM-DD'
  status: PrayerStatus;
  source?: string | null; // e.g. 'Direct', 'Donation', 'Personal Commitment', 'Finance Call', 'Coupon', 'Church'
  reference_id?: string | null;
  notes?: string | null;
  amount?: number | null;
  created_at?: string;
  isDirect?: boolean;
}

export interface DailyPrayerGroup {
  date: string; // 'YYYY-MM-DD'
  displayDate: string;
  dayOfWeek: string;
  isToday: boolean;
  isYesterday: boolean;
  requests: PrayerRequestRecord[];
  count: number;
}

export interface PrayerSummary {
  totalRequests: number;
  todayRequests: number;
  activeRequests: number;
  answeredRequests: number;
  archivedRequests: number;
  totalPeople: number;
  totalDaysWithRequests: number;
}

// ============================================================
// REGISTRATION FEES & CHECK-IN DUES TYPES
// ============================================================

export type FeePaymentStatus =
  | 'paid'
  | 'fully_paid'
  | 'partially_paid'
  | 'half_paid'
  | 'later_pay'
  | 'pay_later'
  | 'not_paid'
  | 'no_pay';

export type FeePaymentMethod = 'CASH' | 'UPI';

export interface FeeRecord {
  id: string; // checkin id
  event_id?: string | null;
  registration_id?: string | null;
  volunteer_registration_id?: string | null;
  registration_option?: string | null;
  payment_status: FeePaymentStatus;
  payment_method?: FeePaymentMethod | null;
  amount_paid: number;
  amount_due: number;
  payment_note?: string | null;
  checked_in_at?: string | null;
  checked_in_by?: string | null;
  created_at?: string | null;

  // Participant metadata
  participant_name?: string | null;
  participant_phone?: string | null;
  participant_email?: string | null;
  participant_parish?: string | null;
  participant_diocese?: string | null;
  participant_registration_type?: string | null;
  participant_college?: string | null;
  participant_affiliation?: string | null;

  // Volunteer metadata
  volunteer_name?: string | null;
  volunteer_phone?: string | null;
  volunteer_ministry?: string | null;
  volunteer_role?: string | null;
  volunteer_registration_type?: string | null;

  // Unified convenience fields
  display_name?: string | null;
  display_phone?: string | null;
  person_type: 'participant' | 'volunteer';
}

export interface FeeSummary {
  totalCollected: number;
  cashCollected: number;
  cashCount: number;
  upiCollected: number;
  upiCount: number;
  totalDue: number;
  totalExpected: number;
  checkedInCount: number;

  // Status-specific breakdowns
  fullyPaidCount: number;
  fullyPaidAmount: number;

  partiallyPaidCount: number;
  partiallyPaidAmount: number;
  partiallyPaidDue: number;

  laterPayCount: number;
  laterPayDue: number;

  notPaidCount: number;
  notPaidDue: number;

  // Percentage collection rate (0-100)
  collectionRate: number;
}
