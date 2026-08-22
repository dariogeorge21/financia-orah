// features/personal-commitments/api.ts
// Client-side API functions for interacting with the /api/personal-commitments endpoints

import type { PersonalCommitmentRecord, CommitmentStatus } from '@/lib/types';

export interface PersonalCommitmentSummary {
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

export interface PersonalCommitmentApiResponse {
  success: boolean;
  data?: {
    commitments: PersonalCommitmentRecord[];
    summary: PersonalCommitmentSummary;
  };
  error?: string;
  message?: string;
}

export interface PersonalCommitmentMutationResponse {
  success: boolean;
  data?: PersonalCommitmentRecord;
  error?: string;
  message?: string;
}

export interface CreatePersonalCommitmentInput {
  person_name: string;
  mobile_number?: string | null;
  caller_name?: string | null;
  promised: number;
  received?: number;
  money_type?: 'Cash' | 'UPI';
  screenshot_link?: string | null;
  date?: string;
  status?: CommitmentStatus;
  notes?: string | null;
}

export interface UpdatePersonalCommitmentInput {
  person_name?: string;
  mobile_number?: string | null;
  caller_name?: string | null;
  promised?: number;
  received?: number;
  money_type?: 'Cash' | 'UPI';
  screenshot_link?: string | null;
  date?: string;
  status?: CommitmentStatus;
  notes?: string | null;
}

/**
 * Fetches all personal commitments and computed summary statistics from the server API endpoint.
 */
export async function fetchPersonalCommitmentsData(): Promise<PersonalCommitmentApiResponse> {
  const res = await fetch('/api/personal-commitments', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch personal commitments: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a POST request to /api/personal-commitments to create a new commitment.
 */
export async function createPersonalCommitment(
  input: CreatePersonalCommitmentInput
): Promise<PersonalCommitmentMutationResponse> {
  const res = await fetch('/api/personal-commitments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to create personal commitment: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a PATCH request to /api/personal-commitments/[id] to update an existing commitment.
 */
export async function updatePersonalCommitment(
  id: string,
  input: UpdatePersonalCommitmentInput
): Promise<PersonalCommitmentMutationResponse> {
  const res = await fetch(`/api/personal-commitments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to update personal commitment: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a DELETE request to /api/personal-commitments/[id] to delete a commitment.
 */
export async function deletePersonalCommitment(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/personal-commitments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to delete personal commitment: ${res.statusText}`);
  }

  return json;
}
