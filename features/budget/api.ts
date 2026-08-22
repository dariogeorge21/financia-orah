// features/budget/api.ts
// Client-side API functions for interacting with the /api/budget endpoints

import type { BudgetCategory, ExpenseRecord, BudgetRow } from '@/lib/types';

export interface BudgetSummary {
  totalPlanned: number;
  totalActual: number;
  totalRemaining: number;
  overallPct: number;
}

export interface BudgetApiResponse {
  success: boolean;
  data?: {
    budgets: BudgetCategory[];
    expenses: ExpenseRecord[];
    rows: BudgetRow[];
    summary: BudgetSummary;
  };
  error?: string;
  message?: string;
}

export interface BudgetMutationResponse {
  success: boolean;
  data?: BudgetCategory;
  error?: string;
  message?: string;
}

export interface CreateBudgetInput {
  category: string;
  planned: number;
  description?: string | null;
}

export interface UpdateBudgetInput {
  category?: string;
  planned?: number;
  description?: string | null;
}

/**
 * Fetches the entire budget data bundle (budgets, expenses, calculated rows, summary)
 * from the server API endpoint.
 */
export async function fetchBudgetData(): Promise<BudgetApiResponse> {
  const res = await fetch('/api/budget', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch budget: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a POST request to /api/budget to create a new budget category.
 */
export async function createBudgetCategory(input: CreateBudgetInput): Promise<BudgetMutationResponse> {
  const res = await fetch('/api/budget', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to create budget category: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a PATCH request to /api/budget/[id] to update an existing budget category.
 */
export async function updateBudgetCategory(
  id: number,
  input: UpdateBudgetInput
): Promise<BudgetMutationResponse> {
  const res = await fetch(`/api/budget/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to update budget category: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a DELETE request to /api/budget/[id] to delete a budget category.
 */
export async function deleteBudgetCategory(id: number): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/budget/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to delete budget category: ${res.statusText}`);
  }

  return json;
}
