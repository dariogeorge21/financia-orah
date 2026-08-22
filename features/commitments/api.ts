// features/commitments/api.ts
// Client-side API functions for interacting with the /api/commitments endpoints

import type { PersonalCommitmentRecord, CommitmentStatus } from '@/lib/types';

export interface CommitmentSummary {
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

export interface CommitmentApiResponse {
  success: boolean;
  data?: {
    commitments: PersonalCommitmentRecord[];
    summary: CommitmentSummary;
  };
  error?: string;
  message?: string;
}

export interface CommitmentMutationResponse {
  success: boolean;
  data?: PersonalCommitmentRecord;
  error?: string;
  message?: string;
}

export interface CreateCommitmentInput {
  person_name: string;
  mobile_number?: string | null;
  promised: number;
  received?: number;
  status?: CommitmentStatus;
  notes?: string | null;
}

export interface UpdateCommitmentInput {
  person_name?: string;
  mobile_number?: string | null;
  promised?: number;
  received?: number;
  status?: CommitmentStatus;
  notes?: string | null;
}

/**
 * Fetches all commitments and computed summary metrics from the server API endpoint.
 */
export async function fetchCommitmentsData(): Promise<CommitmentApiResponse> {
  const res = await fetch('/api/commitments', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch commitments: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a POST request to /api/commitments to create a new commitment.
 */
export async function createCommitment(input: CreateCommitmentInput): Promise<CommitmentMutationResponse> {
  const res = await fetch('/api/commitments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to create commitment: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a PATCH request to /api/commitments/[id] to update an existing commitment.
 */
export async function updateCommitment(
  id: string,
  input: UpdateCommitmentInput
): Promise<CommitmentMutationResponse> {
  const res = await fetch(`/api/commitments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to update commitment: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a DELETE request to /api/commitments/[id] to delete a commitment.
 */
export async function deleteCommitment(id: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/commitments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to delete commitment: ${res.statusText}`);
  }

  return json;
}
