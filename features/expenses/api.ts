// features/expenses/api.ts
// Client-side API functions for interacting with the /api/expenses endpoints

import type { ExpenseRecord, ExpenseStatus, PaymentSource, MoneyType } from '@/lib/types';

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
