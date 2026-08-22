// features/income/api.ts
// Client-side API functions for interacting with the /api/income endpoints

import type { IncomeRecord, IncomeType, MoneyType } from '@/lib/types';

export interface IncomeSummary {
  totalIncome: number;
  cashTotal: number;
  upiTotal: number;
  totalCount: number;
}

export interface IncomeApiResponse {
  success: boolean;
  data?: {
    income: IncomeRecord[];
    summary: IncomeSummary;
  };
  error?: string;
  message?: string;
}

export interface IncomeMutationResponse {
  success: boolean;
  data?: IncomeRecord;
  error?: string;
  message?: string;
}

export interface CreateIncomeInput {
  date?: string;
  type: IncomeType;
  contributor: string;
  mobile_number?: string | null;
  description: string;
  amount: number;
  money_type: MoneyType;
  screenshot_link?: string | null;
  notes?: string | null;
  reference_id?: string | null;
}

export interface UpdateIncomeInput {
  date?: string;
  type?: IncomeType;
  contributor?: string;
  mobile_number?: string | null;
  description?: string;
  amount?: number;
  money_type?: MoneyType;
  screenshot_link?: string | null;
  notes?: string | null;
  reference_id?: string | null;
}

/**
 * Fetches all income records and computed summary statistics from the server API endpoint.
 */
export async function fetchIncomeData(): Promise<IncomeApiResponse> {
  const res = await fetch('/api/income', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch income: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a POST request to /api/income to create a new income transaction.
 */
export async function createIncome(input: CreateIncomeInput): Promise<IncomeMutationResponse> {
  const res = await fetch('/api/income', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to create income record: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a PATCH request to /api/income/[id] to update an existing income record.
 */
export async function updateIncome(
  id: string,
  input: UpdateIncomeInput
): Promise<IncomeMutationResponse> {
  const res = await fetch(`/api/income/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to update income record: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a DELETE request to /api/income/[id] to delete an income record.
 */
export async function deleteIncome(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/income/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to delete income record: ${res.statusText}`);
  }

  return json;
}
