// features/church-donations/api.ts
// Client-side API functions for interacting with the /api/church-donations endpoints

import type { ChurchDonationRecord, MoneyType } from '@/lib/types';

export interface ChurchDonationSummary {
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  totalCount: number;
}

export interface ChurchDonationApiResponse {
  success: boolean;
  data?: {
    donations: ChurchDonationRecord[];
    summary: ChurchDonationSummary;
  };
  error?: string;
  message?: string;
}

export interface ChurchDonationMutationResponse {
  success: boolean;
  data?: ChurchDonationRecord;
  error?: string;
  message?: string;
}

export interface CreateChurchDonationInput {
  church_name: string;
  contact_number?: string | null;
  date?: string;
  collected_by?: string | null;
  money_type: MoneyType;
  amount: number;
  notes?: string | null;
  screenshot_link?: string | null;
}

export interface UpdateChurchDonationInput {
  church_name?: string;
  contact_number?: string | null;
  date?: string;
  collected_by?: string | null;
  money_type?: MoneyType;
  amount?: number;
  notes?: string | null;
  screenshot_link?: string | null;
}

/**
 * Fetches all church & convent donations and computed summary statistics from the server API endpoint.
 */
export async function fetchChurchDonationsData(): Promise<ChurchDonationApiResponse> {
  const res = await fetch('/api/church-donations', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch church donations: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a POST request to /api/church-donations to create a new donation record.
 */
export async function createChurchDonation(
  input: CreateChurchDonationInput
): Promise<ChurchDonationMutationResponse> {
  const res = await fetch('/api/church-donations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to create church donation: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a PATCH request to /api/church-donations/[id] to update an existing donation record.
 */
export async function updateChurchDonation(
  id: string,
  input: UpdateChurchDonationInput
): Promise<ChurchDonationMutationResponse> {
  const res = await fetch(`/api/church-donations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to update church donation: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a DELETE request to /api/church-donations/[id] to delete a donation record.
 */
export async function deleteChurchDonation(id: string): Promise<ChurchDonationMutationResponse> {
  const res = await fetch(`/api/church-donations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to delete church donation: ${res.statusText}`);
  }

  return json;
}
