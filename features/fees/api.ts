// features/fees/api.ts
// Client & server API functions for checked-in fee collections and dues

import type { FeeRecord, FeeSummary } from '@/lib/types';

export interface FeeApiResponse {
  success: boolean;
  data?: {
    fees: FeeRecord[];
    summary: FeeSummary;
  };
  error?: string;
  message?: string;
}

/**
 * Fetches all checked-in fee collection records and computed summary statistics from /api/fees.
 */
export async function fetchFeeData(): Promise<FeeApiResponse> {
  const res = await fetch('/api/fees', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch fees data: ${res.statusText}`);
  }

  return json;
}
