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
import { createFinanceCall } from '@/features/finance-calls';
import { formatINR } from '@/lib/calculations';

interface AddFinanceCallDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactElement;
}

export function AddFinanceCallDialog({ onSuccess, trigger }: AddFinanceCallDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    person_name: '',
    mobile_number: '',
    caller_name: '',
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
        await createFinanceCall({
          person_name: form.person_name.trim(),
          mobile_number: form.mobile_number.trim() || null,
          caller_name: form.caller_name.trim() || null,
          promised: promisedNum,
          received: receivedNum,
          money_type: form.money_type,
          status: receivedNum >= promisedNum ? 'Fully Received' : receivedNum > 0 ? 'Partially Received' : 'Pending',
          notes: form.notes.trim() || null,
        });

        setOpen(false);
        setForm({
          person_name: '',
          mobile_number: '',
          caller_name: '',
          promised: '',
          received: '',
          money_type: 'UPI',
          notes: '',
        });
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to add finance call');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button
              id="add-finance-call-btn"
              className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20"
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
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Add Finance Call
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Finance Call Entry</DialogTitle>
          <DialogDescription>
            Record a pledge or commitment received during finance calling drives. Received funds are automatically logged to Incomes and the Dashboard.
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
              <Label htmlFor="fc-mobile">Mobile Number (Optional)</Label>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="fc-amount">Promised (₹)</Label>
                {form.promised && !isNaN(parseFloat(form.promised)) && (
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    {formatINR(parseFloat(form.promised))}
                  </span>
                )}
              </div>
              <Input
                id="fc-amount"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 10000"
                value={form.promised}
                onChange={(e) => set('promised', e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="fc-received">Received Now (₹)</Label>
                {form.received && !isNaN(parseFloat(form.received)) && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(form.received))}
                  </span>
                )}
              </div>
              <Input
                id="fc-received"
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
              <Label htmlFor="fc-money-type">Payment Mode (Received Funds)</Label>
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
            <Label htmlFor="fc-notes">Call Notes / Follow-up Details (Optional)</Label>
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
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white"
            >
              {isPending ? 'Saving to Server…' : 'Add Finance Call'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
