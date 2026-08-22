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
import type { CommitmentStatus } from '@/lib/types';

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

  const [paymentStatus, setPaymentStatus] = useState<'Pending' | 'Fully Received' | 'Partially Received'>('Pending');
  const [form, setForm] = useState({
    person_name: '',
    mobile_number: '',
    caller_name: '',
    promised: '',
    received: '',
    money_type: 'UPI' as 'Cash' | 'UPI',
    screenshot_link: '',
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

    let finalReceived = 0;
    let finalStatus: CommitmentStatus = 'Pending';

    if (paymentStatus === 'Fully Received') {
      finalReceived = promisedNum;
      finalStatus = 'Fully Received';
    } else if (paymentStatus === 'Partially Received') {
      finalReceived = form.received ? parseFloat(form.received) : 0;
      if (isNaN(finalReceived) || finalReceived <= 0) {
        setError('Please enter a valid received amount greater than 0 for partial payment.');
        return;
      }
      if (finalReceived > promisedNum) {
        setError(`Received amount (${formatINR(finalReceived)}) cannot be greater than the promised amount (${formatINR(promisedNum)}).`);
        return;
      }
      if (finalReceived === promisedNum) {
        finalStatus = 'Fully Received';
      } else {
        finalStatus = 'Partially Received';
      }
    } else {
      finalReceived = 0;
      finalStatus = 'Pending';
    }

    startTransition(async () => {
      try {
        await createCommitment({
          person_name: form.person_name.trim(),
          mobile_number: form.mobile_number.trim() || null,
          caller_name: form.caller_name.trim() || null,
          promised: promisedNum,
          received: finalReceived,
          money_type: finalReceived > 0 ? form.money_type : undefined,
          screenshot_link: form.screenshot_link.trim() || null,
          status: finalStatus,
          notes: form.notes.trim() || null,
        });

        setOpen(false);
        setPaymentStatus('Pending');
        setForm({
          person_name: '',
          mobile_number: '',
          caller_name: '',
          promised: '',
          received: '',
          money_type: 'UPI',
          screenshot_link: '',
          notes: '',
        });
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Personal Commitment</DialogTitle>
          <DialogDescription>
            Record a new individual pledge. If already paid (partially or fully), funds are automatically logged to Incomes and Dashboard.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="pcom-person">Person Name <span className="text-destructive">*</span></Label>
            <Input
              id="pcom-person"
              placeholder="Full name of contributor"
              value={form.person_name}
              onChange={(e) => set('person_name', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pcom-mobile">Mobile Number (Optional)</Label>
              <Input
                id="pcom-mobile"
                type="tel"
                placeholder="10-digit mobile"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pcom-caller">Caller / Volunteer</Label>
              <Input
                id="pcom-caller"
                placeholder="Who took pledge?"
                value={form.caller_name}
                onChange={(e) => set('caller_name', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="pcom-amount">Promised Amount (₹) <span className="text-destructive">*</span></Label>
              {form.promised && !isNaN(parseFloat(form.promised)) && (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
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

          {/* Payment Received Status selection */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <Label className="text-xs font-medium text-foreground">
              Is the promised amount already received?
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'Pending', label: 'Not Yet' },
                { value: 'Fully Received', label: 'Paid in Full' },
                { value: 'Partially Received', label: 'Partially Paid' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setPaymentStatus(opt.value as typeof paymentStatus);
                    if (opt.value === 'Fully Received' && form.promised) {
                      set('received', form.promised);
                    }
                  }}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all ${
                    paymentStatus === opt.value
                      ? opt.value === 'Fully Received'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : opt.value === 'Partially Received'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border hover:bg-muted text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {paymentStatus === 'Partially Received' && (
              <div className="space-y-1.5 pt-2 animate-in fade-in-50 duration-200">
                <div className="flex justify-between items-center">
                  <Label htmlFor="pcom-partial-received" className="text-xs">
                    Amount Received Now (₹)
                  </Label>
                  {form.received && !isNaN(parseFloat(form.received)) && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatINR(parseFloat(form.received))}
                    </span>
                  )}
                </div>
                <Input
                  id="pcom-partial-received"
                  type="number"
                  min="1"
                  max={form.promised ? parseFloat(form.promised) : undefined}
                  step="1"
                  placeholder="e.g. 2000"
                  value={form.received}
                  onChange={(e) => set('received', e.target.value)}
                  required
                />
              </div>
            )}

            {paymentStatus !== 'Pending' && (
              <div className="space-y-3 pt-2 animate-in fade-in-50 duration-200 border-t border-border/40 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Payment Mode</Label>
                  <div className="flex gap-2">
                    {(['UPI', 'Cash'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => set('money_type', m)}
                        className={`flex-1 py-1 text-xs font-medium rounded-md border transition-all ${
                          form.money_type === m
                            ? 'bg-primary text-primary-foreground border-primary font-semibold'
                            : 'bg-card border-border hover:bg-muted text-foreground'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="pcom-screenshot" className="text-xs">
                    Payment Screenshot / Receipt Link (Optional)
                  </Label>
                  <Input
                    id="pcom-screenshot"
                    type="url"
                    placeholder="https://drive.google.com/... or image link"
                    value={form.screenshot_link}
                    onChange={(e) => set('screenshot_link', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

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
