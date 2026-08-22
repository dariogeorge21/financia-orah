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

export function AddPersonalCommitmentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    person_name: '',
    mobile_number: '',
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
      .from('personal_commitments')
      .select('*', { count: 'exact', head: true });

    const nextId = `PCOM-${String(Number(rawCount ?? 0) + 1).padStart(4, '0')}`;

    startTransition(async () => {
      const { error: err } = await supabase.from('personal_commitments').insert({
        id: nextId,
        person_name: form.person_name,
        mobile_number: form.mobile_number || null,
        promised: parseFloat(form.promised),
        received: 0,
        status: 'Pending',
        notes: form.notes || null,
      });

      if (err) {
        setError(err.message);
      } else {
        setOpen(false);
        setForm({ person_name: '', mobile_number: '', promised: '', notes: '' });
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            id="add-personal-commitment-btn"
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-md shadow-amber-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            Add Personal Commitment
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Personal Commitment</DialogTitle>
          <DialogDescription>
            Record a new individual commitment/pledge. When money is received, log it in Income with this commitment reference.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pcom-person">Person Name</Label>
            <Input
              id="pcom-person"
              placeholder="Full name of person"
              value={form.person_name}
              onChange={(e) => set('person_name', e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pcom-mobile">Mobile Number</Label>
            <Input
              id="pcom-mobile"
              type="tel"
              placeholder="10-digit mobile number"
              value={form.mobile_number}
              onChange={(e) => set('mobile_number', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pcom-amount">Promised Amount (₹)</Label>
            <Input
              id="pcom-amount"
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
            <Label htmlFor="pcom-notes">Notes / Follow-up Details</Label>
            <Textarea
              id="pcom-notes"
              placeholder="e.g., promised by 25th Aug, will pay via bank..."
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
              className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
            >
              {isPending ? 'Saving…' : 'Add Commitment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
