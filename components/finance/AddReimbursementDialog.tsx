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
import { createReimbursement } from '@/features/reimbursements';
import { formatINR } from '@/lib/calculations';
import type { ReimbursementStatus, MoneyType } from '@/lib/types';

interface AddReimbursementDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactElement;
}

export function AddReimbursementDialog({ onSuccess, trigger }: AddReimbursementDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    person: '',
    mobile_number: '',
    expense_id: '',
    amount: '',
    status: 'Pending' as ReimbursementStatus,
    money_type_paid: '' as MoneyType | '',
    notes: '',
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.person.trim() || !form.expense_id.trim()) {
      setError('Person name and Expense ID are required.');
      return;
    }

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    startTransition(async () => {
      try {
        await createReimbursement({
          date: form.date,
          person: form.person.trim(),
          mobile_number: form.mobile_number.trim() || null,
          expense_id: form.expense_id.trim().toUpperCase(),
          amount: amountNum,
          status: form.status,
          money_type_paid: form.status === 'Paid' && form.money_type_paid ? form.money_type_paid : null,
          notes: form.notes.trim() || null,
        });

        setOpen(false);
        setForm({
          date: new Date().toISOString().split('T')[0],
          person: '',
          mobile_number: '',
          expense_id: '',
          amount: '',
          status: 'Pending',
          money_type_paid: '',
          notes: '',
        });
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to add reimbursement');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button
              id="add-reimb-btn"
              className="gap-2 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white shadow-md shadow-cyan-500/20"
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
              Add Reimbursement
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Reimbursement Record</DialogTitle>
          <DialogDescription>
            Log a personal expense reimbursement settlement via server API.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reimb-date">Date</Label>
              <Input
                id="reimb-date"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reimb-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set('status', (v as ReimbursementStatus) ?? 'Pending')}
              >
                <SelectTrigger id="reimb-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reimb-person">Person Name</Label>
              <Input
                id="reimb-person"
                placeholder="Person being reimbursed"
                value={form.person}
                onChange={(e) => set('person', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reimb-mobile">Mobile Number</Label>
              <Input
                id="reimb-mobile"
                type="tel"
                placeholder="Mobile (optional)"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reimb-exp">Expense ID</Label>
              <Input
                id="reimb-exp"
                placeholder="EXP-XXXX"
                value={form.expense_id}
                onChange={(e) => set('expense_id', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="reimb-amount">Amount (₹)</Label>
                {form.amount && !isNaN(parseFloat(form.amount)) && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(form.amount))}
                  </span>
                )}
              </div>
              <Input
                id="reimb-amount"
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                required
              />
            </div>
          </div>

          {form.status === 'Paid' && (
            <div className="space-y-1.5">
              <Label htmlFor="reimb-money-type">Paid Via</Label>
              <Select
                value={form.money_type_paid}
                onValueChange={(v) => set('money_type_paid', v ?? '')}
              >
                <SelectTrigger id="reimb-money-type">
                  <SelectValue placeholder="Cash / UPI" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reimb-notes">Notes</Label>
            <Textarea
              id="reimb-notes"
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
              className="bg-gradient-to-r from-cyan-600 to-sky-600 text-white"
            >
              {isPending ? 'Saving to Server…' : 'Add Reimbursement'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
