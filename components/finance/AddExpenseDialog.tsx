'use client';

import { useState, useTransition, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { createExpense } from '@/features/expenses';
import { formatINR, calcMoneyPosition } from '@/lib/calculations';
import type { MoneyType, PaymentSource, ExpenseStatus, MoneyPosition } from '@/lib/types';

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
  'Other',
];

interface AddExpenseDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactElement;
  moneyPosition?: MoneyPosition;
}

export function AddExpenseDialog({ onSuccess, trigger, moneyPosition }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasReceipt, setHasReceipt] = useState(false);
  const [livePosition, setLivePosition] = useState<MoneyPosition | null>(moneyPosition ?? null);

  useEffect(() => {
    if (moneyPosition) {
      setLivePosition(moneyPosition);
    }
  }, [moneyPosition]);

  useEffect(() => {
    if (open && !moneyPosition) {
      Promise.all([
        fetch('/api/income').then((r) => r.json()).catch(() => ({ data: { income: [] } })),
        fetch('/api/expenses').then((r) => r.json()).catch(() => ({ data: { expenses: [] } })),
        fetch('/api/reimbursements').then((r) => r.json()).catch(() => ({ data: { reimbursements: [] } })),
      ]).then(([incRes, expRes, reimbRes]) => {
        const incList = incRes.data?.income ?? [];
        const expList = expRes.data?.expenses ?? [];
        const reimbList = reimbRes.data?.reimbursements ?? [];
        setLivePosition(calcMoneyPosition(incList, expList, reimbList));
      });
    }
  }, [open, moneyPosition]);

  const [form, setForm] = useState({
    category: '',
    other_category: '',
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

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const currentCash = livePosition?.cashAvailable ?? 0;
  const currentUpi = livePosition?.upiAvailable ?? 0;
  const beforeAmount = form.money_type === 'Cash' ? currentCash : currentUpi;
  const enteredAmount = parseFloat(form.amount) || 0;
  const afterAmount = beforeAmount - enteredAmount;
  const isNegative = enteredAmount > 0 && afterAmount < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const finalCategory = form.category === 'Other' ? form.other_category.trim() : form.category;

    if (form.category === 'Other' && !finalCategory) {
      setError('Please specify what the other category is.');
      return;
    }

    if (!finalCategory || !form.money_type || !form.paid_by) {
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
        await createExpense({
          category: finalCategory,
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

        setOpen(false);
        setForm({
          category: '',
          other_category: '',
          description: '',
          amount: '',
          money_type: 'Cash',
          paid_by: '',
          mobile_number: '',
          payment_source: 'Event',
          status: 'Approved',
          receipt_link: '',
          notes: '',
        });
        setHasReceipt(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to add expense');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button
              id="add-expense-btn"
              className="gap-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-md shadow-rose-500/20"
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
              Add Expense
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            Record a new expenditure item for the event via server API.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-cat">Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v ?? '')}>
                <SelectTrigger id="exp-cat">
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
              <Label htmlFor="exp-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
                <SelectTrigger id="exp-status">
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

          {form.category === 'Other' && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <Label htmlFor="exp-other-cat">Specify Other Category</Label>
              <Input
                id="exp-other-cat"
                placeholder="e.g. Sound Engineer, Stage Backdrop, Momento..."
                value={form.other_category}
                onChange={(e) => set('other_category', e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">Description</Label>
            <Input
              id="exp-desc"
              placeholder="What was this for?"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-paid-by">Paid By</Label>
              <Input
                id="exp-paid-by"
                placeholder="Person / Treasurer"
                value={form.paid_by}
                onChange={(e) => set('paid_by', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-mobile">Mobile Number (Optional)</Label>
              <Input
                id="exp-mobile"
                type="tel"
                placeholder="Mobile number"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="exp-amount">Amount (₹)</Label>
                {form.amount && !isNaN(parseFloat(form.amount)) && (
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {formatINR(parseFloat(form.amount))}
                  </span>
                )}
              </div>
              <Input
                id="exp-amount"
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
              <div className="flex justify-between items-center">
                <Label htmlFor="exp-money-type">Money Type</Label>
                {livePosition && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Avail: {formatINR(form.money_type === 'Cash' ? currentCash : currentUpi)}
                  </span>
                )}
              </div>
              <Select value={form.money_type} onValueChange={(v) => set('money_type', v ?? '')}>
                <SelectTrigger id="exp-money-type">
                  <SelectValue placeholder="Cash / UPI" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash ({formatINR(currentCash)})</SelectItem>
                  <SelectItem value="UPI">UPI ({formatINR(currentUpi)})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Negative Balance Warning Banner */}
          {isNegative && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 animate-in fade-in-50 duration-200 space-y-1.5 shadow-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
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
                  className="text-amber-600 dark:text-amber-400 shrink-0"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
                <span>Warning: Insufficient {form.money_type} Balance</span>
              </div>
              <p className="leading-relaxed">
                Your current <strong className="font-semibold">{form.money_type}</strong> balance of <strong className="font-semibold text-foreground">{formatINR(beforeAmount)}</strong> will become negative: <strong className="font-bold text-rose-600 dark:text-rose-400">{formatINR(afterAmount)}</strong> after recording this expense.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="exp-source">Payment Source</Label>
            <Select value={form.payment_source} onValueChange={(v) => set('payment_source', v ?? '')}>
              <SelectTrigger id="exp-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Event">Event (Direct from Event balance)</SelectItem>
                <SelectItem value="Personal">Personal (Paid from pocket - needs reimbursement)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="exp-receipt" checked={hasReceipt} onCheckedChange={setHasReceipt} />
            <Label htmlFor="exp-receipt">Has Receipt / Invoice</Label>
          </div>

          {hasReceipt && (
            <div className="space-y-1.5">
              <Label htmlFor="exp-receipt-link">Receipt Image URL / Drive Link</Label>
              <Input
                id="exp-receipt-link"
                placeholder="https://..."
                value={form.receipt_link}
                onChange={(e) => set('receipt_link', e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="exp-notes">Notes</Label>
            <Textarea
              id="exp-notes"
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
              className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white"
            >
              {isPending ? 'Saving to Server…' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
