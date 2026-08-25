// features/coupons/api.ts
// Client-side API functions for interacting with the /api/coupons endpoints

import type { CouponRecord, MoneyType } from '@/lib/types';

export interface CouponSummary {
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  totalCount: number;
}

export interface CouponApiResponse {
  success: boolean;
  data?: {
    coupons: CouponRecord[];
    summary: CouponSummary;
  };
  error?: string;
  message?: string;
}

export interface CouponMutationResponse {
  success: boolean;
  data?: CouponRecord;
  error?: string;
  message?: string;
}

export interface CreateCouponInput {
  contributor_name: string;
  mobile_number?: string | null;
  date?: string;
  money_type: MoneyType;
  amount: number;
  is_handed_over?: boolean | null;
  collected_by?: string | null;
  booklet_number?: string | null;
  notes?: string | null;
  prayer_request?: string | null;
  screenshot_link?: string | null;
}

export interface UpdateCouponInput {
  contributor_name?: string;
  mobile_number?: string | null;
  date?: string;
  money_type?: MoneyType;
  amount?: number;
  is_handed_over?: boolean | null;
  collected_by?: string | null;
  booklet_number?: string | null;
  notes?: string | null;
  prayer_request?: string | null;
  screenshot_link?: string | null;
}

/**
 * Fetches all coupons and computed summary statistics from the server API endpoint.
 */
export async function fetchCouponsData(): Promise<CouponApiResponse> {
  const res = await fetch('/api/coupons', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to fetch coupons: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a POST request to /api/coupons to create a new coupon entry.
 */
export async function createCoupon(
  input: CreateCouponInput
): Promise<CouponMutationResponse> {
  const res = await fetch('/api/coupons', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to create coupon: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a PATCH request to /api/coupons/[id] to update an existing coupon.
 */
export async function updateCoupon(
  id: string,
  input: UpdateCouponInput
): Promise<CouponMutationResponse> {
  const res = await fetch(`/api/coupons/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to update coupon: ${res.statusText}`);
  }

  return json;
}

/**
 * Sends a DELETE request to /api/coupons/[id] to delete a coupon.
 */
export async function deleteCoupon(id: string): Promise<CouponMutationResponse> {
  const res = await fetch(`/api/coupons/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `Failed to delete coupon: ${res.statusText}`);
  }

  return json;
}
