// features/reimbursements/api.ts
// Client-side API functions for interacting with the /api/reimbursements endpoints

import type { ReimbursementRecord, ReimbursementStatus, MoneyType } from '@/lib/types';

export interface ReimbursementSummary {
  totalClaims: number;
  paidTotal: number;
  pendingTotal: number;
  settlementPct: number;
  totalCount: number;
  paidCount: number;
  pendingCount: number;
}

export interface ReimbursementApiResponse {
  success: boolean;
  data?: {
    reimbursements: ReimbursementRecord[];
    summary: ReimbursementSummary;
  };
  error?: string;
  message?: string;
}

export interface ReimbursementMutationResponse {
  success: boolean;
  data?: ReimbursementRecord;
  error?: string;
  message?: string;
}

export interface CreateReimbursementInput {
  date?: string;
  person: string;
  mobile_number?: string | null;
  expense_id: string;
  amount: number;
  status?: ReimbursementStatus;
  money_type_paid?: MoneyType | null;
  notes?: string | null;
}

export interface UpdateReimbursementInput {
  date?: string;
  person?: string;
  mobile_number?: string | null;
  expense_id?: string;
  amount?: number;
  status?: ReimbursementStatus;
  money_type_paid?: MoneyType | null;
  notes?: string | null;
}

/**
 * Fetches all reimbursement records and computed summary statistics from the server API endpoint.
 */
export async function fetchReimbursementsData(): Promise<ReimbursementApiResponse> {
  const res = await fetch('/api/reimbursements', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch reimbursements: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a POST request to /api/reimbursements to create a new reimbursement claim.
 */
export async function createReimbursement(
  input: CreateReimbursementInput
): Promise<ReimbursementMutationResponse> {
  const res = await fetch('/api/reimbursements', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to create reimbursement: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a PATCH request to /api/reimbursements/[id] to update an existing reimbursement record.
 */
export async function updateReimbursement(
  id: string,
  input: UpdateReimbursementInput
): Promise<ReimbursementMutationResponse> {
  const res = await fetch(`/api/reimbursements/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to update reimbursement: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a DELETE request to /api/reimbursements/[id] to delete a reimbursement record.
 */
export async function deleteReimbursement(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/reimbursements/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to delete reimbursement: ${res.statusText}`);
  }

  return json;
}
