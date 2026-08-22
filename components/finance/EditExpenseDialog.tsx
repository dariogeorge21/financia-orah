'use client';

import { useState, useTransition, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { updateExpense } from '@/features/expenses';
import { formatINR } from '@/lib/calculations';
import type { ExpenseRecord, MoneyType, PaymentSource, ExpenseStatus } from '@/lib/types';

const CATEGORIES = [
  'Food',
  'Venue',
  'Transport',
  'Accommodation',
  'Printing',
  'Decoration',
  'Equipment',
  'Media',
  'Marketing',
  'Stationery',
  'Security',
  'Medical',
  'Miscellaneous',
];

interface EditExpenseDialogProps {
  expense: ExpenseRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditExpenseDialog({
  expense,
  open,
  onOpenChange,
  onSuccess,
}: EditExpenseDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasReceipt, setHasReceipt] = useState(false);

  const [form, setForm] = useState({
    category: '',
    description: '',
    amount: '',
    money_type: 'Cash' as MoneyType,
    paid_by: '',
    mobile_number: '',
    payment_source: 'Event' as PaymentSource,
    status: 'Approved' as ExpenseStatus,
    receipt_link: '',
    notes: '',
  });

  useEffect(() => {
    if (expense) {
      setForm({
        category: expense.category || '',
        description: expense.description || '',
        amount: String(expense.amount ?? 0),
        money_type: expense.money_type || 'Cash',
        paid_by: expense.paid_by || '',
        mobile_number: expense.mobile_number || '',
        payment_source: (expense.payment_source as PaymentSource) || 'Event',
        status: expense.status || 'Approved',
        receipt_link: expense.receipt_link || '',
        notes: expense.notes || '',
      });
      setHasReceipt(Boolean(expense.has_receipt));
      setError(null);
    }
  }, [expense, open]);

  if (!expense) return null;

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!expense) {
      setError('Expense not found.');
      return;
    }

    if (!form.category || !form.money_type || !form.paid_by) {
      setError('Please fill all required fields (Category, Paid By, Money Type).');
      return;
    }

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    startTransition(async () => {
      try {
        await updateExpense(expense.id, {
          category: form.category,
          description: form.description.trim(),
          amount: amountNum,
          money_type: form.money_type,
          paid_by: form.paid_by.trim(),
          mobile_number: form.mobile_number.trim() || null,
          payment_source: form.payment_source,
          status: form.status,
          has_receipt: hasReceipt,
          receipt_link: form.receipt_link.trim() || null,
          notes: form.notes.trim() || null,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update expense');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Expense ({expense.id})</DialogTitle>
          <DialogDescription>
            Update expenditure record and status via server API.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-exp-cat">Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v ?? '')}>
                <SelectTrigger id="edit-exp-cat">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-exp-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
                <SelectTrigger id="edit-exp-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-exp-desc">Description</Label>
            <Input
              id="edit-exp-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-exp-paid-by">Paid By</Label>
              <Input
                id="edit-exp-paid-by"
                value={form.paid_by}
                onChange={(e) => set('paid_by', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-exp-mobile">Mobile Number</Label>
              <Input
                id="edit-exp-mobile"
                type="tel"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="edit-exp-amount">Amount (₹)</Label>
                {form.amount && !isNaN(parseFloat(form.amount)) && (
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {formatINR(parseFloat(form.amount))}
                  </span>
                )}
              </div>
              <Input
                id="edit-exp-amount"
                type="number"
                min="1"
                step="1"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-exp-money-type">Money Type</Label>
              <Select value={form.money_type} onValueChange={(v) => set('money_type', v ?? '')}>
                <SelectTrigger id="edit-exp-money-type">
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
            <Label htmlFor="edit-exp-source">Payment Source</Label>
            <Select value={form.payment_source} onValueChange={(v) => set('payment_source', v ?? '')}>
              <SelectTrigger id="edit-exp-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Event">Event (Direct from Event balance)</SelectItem>
                <SelectItem value="Personal">Personal (Paid from pocket - needs reimbursement)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="edit-exp-receipt" checked={hasReceipt} onCheckedChange={setHasReceipt} />
            <Label htmlFor="edit-exp-receipt">Has Receipt / Invoice</Label>
          </div>

          {hasReceipt && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-exp-receipt-link">Receipt Image URL / Drive Link</Label>
              <Input
                id="edit-exp-receipt-link"
                placeholder="https://..."
                value={form.receipt_link}
                onChange={(e) => set('receipt_link', e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-exp-notes">Notes</Label>
            <Textarea
              id="edit-exp-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white"
            >
              {isPending ? 'Updating…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
