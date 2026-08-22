// features/finance-calls/api.ts
// Client-side API functions for interacting with the /api/finance-calls endpoints

import type { FinanceCallRecord, CommitmentStatus } from '@/lib/types';

export interface FinanceCallSummary {
  totalPromised: number;
  totalReceived: number;
  totalPending: number;
  fulfillmentPct: number;
  totalCount: number;
  activeCount: number;
  fullyReceivedCount: number;
  partiallyReceivedCount: number;
  pendingCount: number;
  cancelledCount: number;
}

export interface FinanceCallApiResponse {
  success: boolean;
  data?: {
    calls: FinanceCallRecord[];
    summary: FinanceCallSummary;
  };
  error?: string;
  message?: string;
}

export interface FinanceCallMutationResponse {
  success: boolean;
  data?: FinanceCallRecord;
  error?: string;
  message?: string;
}

export interface CreateFinanceCallInput {
  person_name: string;
  mobile_number?: string | null;
  caller_name?: string | null;
  promised: number;
  received?: number;
  status?: CommitmentStatus;
  notes?: string | null;
}

export interface UpdateFinanceCallInput {
  person_name?: string;
  mobile_number?: string | null;
  caller_name?: string | null;
  promised?: number;
  received?: number;
  status?: CommitmentStatus;
  notes?: string | null;
}

/**
 * Fetches all finance calls and computed summary statistics from the server API endpoint.
 */
export async function fetchFinanceCallsData(): Promise<FinanceCallApiResponse> {
  const res = await fetch('/api/finance-calls', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch finance calls: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a POST request to /api/finance-calls to create a new finance call pledge.
 */
export async function createFinanceCall(
  input: CreateFinanceCallInput
): Promise<FinanceCallMutationResponse> {
  const res = await fetch('/api/finance-calls', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to create finance call: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a PATCH request to /api/finance-calls/[id] to update an existing finance call.
 */
export async function updateFinanceCall(
  id: string,
  input: UpdateFinanceCallInput
): Promise<FinanceCallMutationResponse> {
  const res = await fetch(`/api/finance-calls/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to update finance call: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a DELETE request to /api/finance-calls/[id] to delete a finance call record.
 */
export async function deleteFinanceCall(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/finance-calls/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to delete finance call: ${res.statusText}`);
  }

  return json;
}
