'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function AddFinanceCallDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    person_name: '',
    mobile_number: '',
    caller_name: '',
    promised: '',
    notes: '',
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = createClient();
    const { count: rawCount } = await supabase
      .from('finance_calls')
      .select('*', { count: 'exact', head: true });

    const nextId = `FC-${String(Number(rawCount ?? 0) + 1).padStart(4, '0')}`;

    startTransition(async () => {
      const { error: err } = await supabase.from('finance_calls').insert({
        id: nextId,
        person_name: form.person_name,
        mobile_number: form.mobile_number || null,
        caller_name: form.caller_name || null,
        promised: parseFloat(form.promised),
        received: 0,
        status: 'Pending',
        notes: form.notes || null,
      });

      if (err) {
        setError(err.message);
      } else {
        setOpen(false);
        setForm({ person_name: '', mobile_number: '', caller_name: '', promised: '', notes: '' });
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            id="add-finance-call-btn"
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Add Finance Call
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Finance Call Entry</DialogTitle>
          <DialogDescription>
            Record a pledge or commitment received during finance calling drives.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="fc-person">Contact / Donor Name</Label>
            <Input
              id="fc-person"
              placeholder="Name of donor / well-wisher"
              value={form.person_name}
              onChange={(e) => set('person_name', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fc-mobile">Mobile Number</Label>
              <Input
                id="fc-mobile"
                type="tel"
                placeholder="Mobile number"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fc-caller">Caller (Volunteer)</Label>
              <Input
                id="fc-caller"
                placeholder="Who made call?"
                value={form.caller_name}
                onChange={(e) => set('caller_name', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fc-amount">Promised Amount (₹)</Label>
            <Input
              id="fc-amount"
              type="number"
              min="1"
              step="1"
              placeholder="0"
              value={form.promised}
              onChange={(e) => set('promised', e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fc-notes">Call Notes / Follow-up</Label>
            <Textarea
              id="fc-notes"
              placeholder="e.g., will transfer next week via GPay, requested brochure..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
            >
              {isPending ? 'Saving…' : 'Add Finance Call'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
