'use client';

import { useState, useTransition } from 'react';
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
import { createPersonalCommitment as createCommitment } from '@/features/personal-commitments';
import { formatINR } from '@/lib/calculations';

interface AddPersonalCommitmentDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactElement;
}

export function AddPersonalCommitmentDialog({
  onSuccess,
  trigger,
}: AddPersonalCommitmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    person_name: '',
    mobile_number: '',
    promised: '',
    received: '',
    money_type: 'UPI' as 'Cash' | 'UPI',
    notes: '',
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const promisedNum = parseFloat(form.promised);
    if (isNaN(promisedNum) || promisedNum <= 0) {
      setError('Please enter a valid promised amount greater than 0.');
      return;
    }

    const receivedNum = form.received ? parseFloat(form.received) : 0;
    if (isNaN(receivedNum) || receivedNum < 0) {
      setError('Received amount must be 0 or greater.');
      return;
    }

    startTransition(async () => {
      try {
        await createCommitment({
          person_name: form.person_name.trim(),
          mobile_number: form.mobile_number.trim() || null,
          promised: promisedNum,
          received: receivedNum,
          money_type: form.money_type,
          status: receivedNum >= promisedNum ? 'Fully Received' : receivedNum > 0 ? 'Partially Received' : 'Pending',
          notes: form.notes.trim() || null,
        });

        setOpen(false);
        setForm({ person_name: '', mobile_number: '', promised: '', received: '', money_type: 'UPI', notes: '' });
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to add commitment');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button
              id="add-personal-commitment-btn"
              className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white shadow-md shadow-amber-500/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Add Personal Commitment
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Personal Commitment</DialogTitle>
          <DialogDescription>
            Record a new individual commitment/pledge. Any received amount will automatically be added to Incomes and the Dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pcom-person">Person Name</Label>
            <Input
              id="pcom-person"
              placeholder="Full name of contributor"
              value={form.person_name}
              onChange={(e) => set('person_name', e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pcom-mobile">Mobile Number (Optional)</Label>
            <Input
              id="pcom-mobile"
              type="tel"
              placeholder="10-digit mobile number"
              value={form.mobile_number}
              onChange={(e) => set('mobile_number', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="pcom-amount">Promised (₹)</Label>
                {form.promised && !isNaN(parseFloat(form.promised)) && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    {formatINR(parseFloat(form.promised))}
                  </span>
                )}
              </div>
              <Input
                id="pcom-amount"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 5000"
                value={form.promised}
                onChange={(e) => set('promised', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="pcom-received">Received Now (₹)</Label>
                {form.received && !isNaN(parseFloat(form.received)) && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(form.received))}
                  </span>
                )}
              </div>
              <Input
                id="pcom-received"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.received}
                onChange={(e) => set('received', e.target.value)}
              />
            </div>
          </div>

          {form.received && parseFloat(form.received) > 0 ? (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <Label htmlFor="pcom-money-type">Payment Mode (Received Funds)</Label>
              <div className="flex gap-2">
                {(['UPI', 'Cash'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('money_type', m)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      form.money_type === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="pcom-notes">Notes / Follow-up Details (Optional)</Label>
            <Textarea
              id="pcom-notes"
              placeholder="e.g., promised by 25th Aug, will pay via UPI..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white"
            >
              {isPending ? 'Saving to Server…' : 'Add Commitment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
