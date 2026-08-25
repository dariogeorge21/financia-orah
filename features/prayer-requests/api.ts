// features/prayer-requests/api.ts
import type { PrayerRequestRecord, PrayerStatus, DailyPrayerGroup, PrayerSummary } from '@/lib/types';

export interface PrayerApiResponse {
  success: boolean;
  data?: {
    requests: PrayerRequestRecord[];
    groups: DailyPrayerGroup[];
    summary: PrayerSummary;
  };
  error?: string;
  message?: string;
}

export interface CreatePrayerInput {
  person_name: string;
  mobile_number?: string | null;
  prayer_request: string;
  date?: string;
  status?: PrayerStatus;
  source?: string | null;
  reference_id?: string | null;
  notes?: string | null;
}

export interface UpdatePrayerInput {
  person_name?: string;
  mobile_number?: string | null;
  prayer_request?: string;
  date?: string;
  status?: PrayerStatus;
  notes?: string | null;
}

export async function fetchPrayerRequestsData(): Promise<PrayerApiResponse> {
  const res = await fetch('/api/prayer-requests', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to fetch prayer requests');
  return json;
}

export async function createPrayerRequest(input: CreatePrayerInput) {
  const res = await fetch('/api/prayer-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to create prayer request');
  return json;
}

export async function updatePrayerRequest(id: string, input: UpdatePrayerInput) {
  const res = await fetch(`/api/prayer-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update prayer request');
  return json;
}

export async function deletePrayerRequest(id: string) {
  const res = await fetch(`/api/prayer-requests/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to delete prayer request');
  return json;
}
