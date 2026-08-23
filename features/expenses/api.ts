// features/expenses/api.ts
// Client-side API functions for interacting with the /api/expenses endpoints

import type { ExpenseRecord, ExpenseStatus, PaymentSource, MoneyType, SettlementStatus } from '@/lib/types';

export interface ExpenseSummary {
  totalApproved: number;
  totalPending: number;
  totalRejected: number;
  eventDirectApproved: number;
  personalApproved: number;
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  activeAdvancesCount?: number;
  totalAdvancesPending?: number;
}

export interface ExpenseApiResponse {
  success: boolean;
  data?: {
    expenses: ExpenseRecord[];
    summary: ExpenseSummary;
  };
  error?: string;
  message?: string;
}

export interface ExpenseMutationResponse {
  success: boolean;
  data?: ExpenseRecord;
  error?: string;
  message?: string;
}

export interface CreateExpenseInput {
  category: string;
  description: string;
  amount: number;
  money_type: MoneyType;
  paid_by: string;
  mobile_number?: string | null;
  payment_source?: PaymentSource;
  status?: ExpenseStatus;
  has_receipt?: boolean;
  receipt_link?: string | null;
  notes?: string | null;
  advance_amount?: number | null;
  advance_money_type?: MoneyType | null;
  settlement_status?: SettlementStatus | null;
  balance_amount?: number | null;
  balance_money_type?: MoneyType | null;
  settled_at?: string | null;
}

export interface UpdateExpenseInput {
  category?: string;
  description?: string;
  amount?: number;
  money_type?: MoneyType;
  paid_by?: string;
  mobile_number?: string | null;
  payment_source?: PaymentSource;
  status?: ExpenseStatus;
  has_receipt?: boolean;
  receipt_link?: string | null;
  notes?: string | null;
  advance_amount?: number | null;
  advance_money_type?: MoneyType | null;
  settlement_status?: SettlementStatus | null;
  balance_amount?: number | null;
  balance_money_type?: MoneyType | null;
  settled_at?: string | null;
}

/**
 * Fetches all expense records and computed summary statistics from the server API endpoint.
 */
export async function fetchExpensesData(): Promise<ExpenseApiResponse> {
  const res = await fetch('/api/expenses', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch expenses: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a POST request to /api/expenses to create a new expense.
 */
export async function createExpense(input: CreateExpenseInput): Promise<ExpenseMutationResponse> {
  const res = await fetch('/api/expenses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to create expense: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a PATCH request to /api/expenses/[id] to update an existing expense.
 */
export async function updateExpense(
  id: string,
  input: UpdateExpenseInput
): Promise<ExpenseMutationResponse> {
  const res = await fetch(`/api/expenses/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to update expense: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a DELETE request to /api/expenses/[id] to delete an expense record.
 */
export async function deleteExpense(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/expenses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to delete expense: ${res.statusText}`);
  }

  return json;
}

export interface SettleExpenseInput {
  actual_amount: number;
  balance_money_type?: MoneyType | null;
  has_receipt?: boolean;
  receipt_link?: string | null;
  notes?: string | null;
}

/**
 * Reconciles an active advance with the actual purchase bill, balance refund/payment, and marks it Settled.
 */
export async function settleExpense(
  id: string,
  input: SettleExpenseInput,
  currentAdvance: number
): Promise<ExpenseMutationResponse> {
  const balance_amount = input.actual_amount - currentAdvance;
  return updateExpense(id, {
    amount: input.actual_amount,
    settlement_status: 'Settled',
    balance_amount,
    balance_money_type: input.balance_money_type || null,
    has_receipt: input.has_receipt,
    receipt_link: input.receipt_link,
    notes: input.notes,
    settled_at: new Date().toISOString(),
  });
}
