'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AddCommitmentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ person_name: '', promised: '' });
  function set(key: string, value: string) { setForm((f) => ({ ...f, [key]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { count: rawCount } = await supabase.from('commitments').select('*', { count: 'exact', head: true });
    const nextId = `COM-${String((Number(rawCount ?? 0) + 1)).padStart(4, '0')}`;

    startTransition(async () => {
      const { error: err } = await supabase.from('commitments').insert({
        id: nextId,
        person_name: form.person_name,
        promised: parseFloat(form.promised),
        received: 0,
        status: 'Pending',
      });
      if (err) setError(err.message);
      else { setOpen(false); router.refresh(); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            id="add-commitment-btn"
            className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-md shadow-amber-500/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Add Commitment
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Commitment</DialogTitle>
          <DialogDescription>Record a new financial commitment (promised amount). Log actual payment in Income when received.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="com-person">Person Name</Label>
            <Input id="com-person" placeholder="Full name" value={form.person_name} onChange={(e) => set('person_name', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="com-amount">Promised Amount (₹)</Label>
            <Input id="com-amount" type="number" min="1" step="1" placeholder="0" value={form.promised} onChange={(e) => set('promised', e.target.value)} required />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              {isPending ? 'Saving…' : 'Add Commitment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
