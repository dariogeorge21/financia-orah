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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createIncome } from '@/features/income';
import { formatINR } from '@/lib/calculations';
import type { IncomeType, MoneyType } from '@/lib/types';

const INCOME_TYPES: IncomeType[] = [
  'Registration',
  'Donation',
  'Personal Commitment',
  'Finance Call',
  'Church',
  'Coupon',
  'Sponsor',
  'Other',
];

interface AddIncomeDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactElement;
}

export function AddIncomeDialog({ onSuccess, trigger }: AddIncomeDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Registration' as IncomeType,
    contributor: '',
    mobile_number: '',
    description: '',
    amount: '',
    money_type: 'Cash' as MoneyType,
    notes: '',
    reference_id: '',
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.type || !form.money_type || !form.contributor || !form.description) {
      setError('Please fill in all required fields.');
      return;
    }

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    startTransition(async () => {
      try {
        await createIncome({
          date: form.date,
          type: form.type,
          contributor: form.contributor.trim(),
          mobile_number: form.mobile_number.trim() || null,
          description: form.description.trim(),
          amount: amountNum,
          money_type: form.money_type,
          notes: form.notes.trim() || null,
          reference_id: form.reference_id.trim() || null,
        });

        setOpen(false);
        setForm({
          date: new Date().toISOString().split('T')[0],
          type: 'Registration',
          contributor: '',
          mobile_number: '',
          description: '',
          amount: '',
          money_type: 'Cash',
          notes: '',
          reference_id: '',
        });
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to add income record');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button
              id="add-income-btn"
              className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-500/20"
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
              Add Income
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Income</DialogTitle>
          <DialogDescription>
            Record a new income transaction for the event via server API.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inc-date">Date</Label>
              <Input
                id="inc-date"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-type">Type</Label>
              <Select value={form.type} onValueChange={(v) => set('type', v ?? '')}>
                <SelectTrigger id="inc-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inc-contributor">Contributor / Source</Label>
              <Input
                id="inc-contributor"
                placeholder="Name of contributor"
                value={form.contributor}
                onChange={(e) => set('contributor', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-mobile">Mobile Number (Optional)</Label>
              <Input
                id="inc-mobile"
                type="tel"
                placeholder="Mobile number"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-desc">Description</Label>
            <Input
              id="inc-desc"
              placeholder="Brief description of payment"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="inc-amount">Amount (₹)</Label>
                {form.amount && !isNaN(parseFloat(form.amount)) && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(form.amount))}
                  </span>
                )}
              </div>
              <Input
                id="inc-amount"
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inc-money-type">Money Type</Label>
              <Select value={form.money_type} onValueChange={(v) => set('money_type', v ?? '')}>
                <SelectTrigger id="inc-money-type">
                  <SelectValue placeholder="Cash / UPI" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-reference">Reference ID (PCOM-XXXX or FC-XXXX)</Label>
            <Input
              id="inc-reference"
              placeholder="e.g. PCOM-0001 or FC-0002"
              value={form.reference_id}
              onChange={(e) => set('reference_id', e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inc-notes">Notes (Optional)</Label>
            <Textarea
              id="inc-notes"
              placeholder="Optional notes..."
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
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white"
            >
              {isPending ? 'Saving to Server…' : 'Add Income'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
