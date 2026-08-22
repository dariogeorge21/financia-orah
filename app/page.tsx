// Root redirect — the actual dashboard is in app/(app)/page.tsx
// The middleware handles auth; this file should not be needed but is kept
// as a safety net to avoid a 404 at the root before middleware runs.
import { redirect } from 'next/navigation';

export default function Root() {
  redirect('/');
}
