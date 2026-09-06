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
import { formatINR, calcMoneyPosition, isEventExpense } from '@/lib/calculations';
import {
  type ExpenseRecord,
  type MoneyType,
  type PaymentSource,
  type ExpenseStatus,
  type SettlementStatus,
  type MoneyPosition,
  EXPENSE_CATEGORIES,
} from '@/lib/types';

const CATEGORIES = [
  ...EXPENSE_CATEGORIES,
  'Other',
];

interface EditExpenseDialogProps {
  expense: ExpenseRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  moneyPosition?: MoneyPosition;
}

export function EditExpenseDialog({
  expense,
  open,
  onOpenChange,
  onSuccess,
  moneyPosition,
}: EditExpenseDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hasReceipt, setHasReceipt] = useState(false);
  const [otherCategory, setOtherCategory] = useState('');
  const [livePosition, setLivePosition] = useState<MoneyPosition | null>(null);

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
    description: '',
    amount: '',
    money_type: 'Cash' as MoneyType,
    paid_by: '',
    mobile_number: '',
    payment_source: 'Event' as PaymentSource,
    status: 'Approved' as ExpenseStatus,
    settlement_status: 'Direct' as SettlementStatus,
    advance_amount: '',
    advance_money_type: 'Cash' as MoneyType,
    balance_amount: '0',
    balance_money_type: 'Cash' as MoneyType,
    receipt_link: '',
    notes: '',
  });

  useEffect(() => {
    if (expense) {
      const standardCategories = EXPENSE_CATEGORIES as string[];

      const isOther = expense.category && !standardCategories.includes(expense.category);

      setForm({
        category: isOther ? 'Other' : expense.category || '',
        description: expense.description || '',
        amount: String(expense.amount ?? 0),
        money_type: expense.money_type || 'Cash',
        paid_by: expense.paid_by || '',
        mobile_number: expense.mobile_number || '',
        payment_source: (expense.payment_source as PaymentSource) || 'Event',
        status: expense.status || 'Approved',
        settlement_status: (expense.settlement_status as SettlementStatus) || 'Direct',
        advance_amount: expense.advance_amount !== null && expense.advance_amount !== undefined
          ? String(expense.advance_amount)
          : '',
        advance_money_type: (expense.advance_money_type as MoneyType) || expense.money_type || 'Cash',
        balance_amount: String(expense.balance_amount ?? 0),
        balance_money_type: (expense.balance_money_type as MoneyType) || expense.money_type || 'Cash',
        receipt_link: expense.receipt_link || '',
        notes: expense.notes || '',
      });

      setOtherCategory(isOther && expense.category !== 'Other' ? expense.category : '');
      setHasReceipt(Boolean(expense.has_receipt));
      setError(null);
    }
  }, [expense, open]);

  if (!expense) return null;

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const activePosition = moneyPosition ?? livePosition;
  const currentCash = activePosition?.cashAvailable ?? 0;
  const currentUpi = activePosition?.upiAvailable ?? 0;
  const wasDeducted = Boolean(
    expense &&
    expense.status === 'Approved' &&
    isEventExpense(expense.payment_source) &&
    expense.money_type === form.money_type
  );
  const baseBalance = form.money_type === 'Cash' ? currentCash : currentUpi;
  const beforeAmount = baseBalance + (wasDeducted ? Number(expense?.amount ?? 0) : 0);
  const enteredAmount = parseFloat(form.amount) || 0;
  const afterAmount = beforeAmount - enteredAmount;
  const isNegative = enteredAmount > 0 && afterAmount < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!expense) {
      setError('Expense not found.');
      return;
    }

    const finalCategory = form.category === 'Other' ? otherCategory.trim() : form.category;

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

    const advNum = form.advance_amount ? parseFloat(form.advance_amount) : null;
    const balNum = form.balance_amount ? parseFloat(form.balance_amount) : 0;

    startTransition(async () => {
      try {
        await updateExpense(expense.id, {
          category: finalCategory,
          description: form.description.trim(),
          amount: amountNum,
          money_type: form.money_type,
          paid_by: form.paid_by.trim(),
          mobile_number: form.mobile_number.trim() || null,
          payment_source: form.payment_source,
          status: form.status,
          settlement_status: form.settlement_status,
          advance_amount: advNum,
          advance_money_type: form.advance_money_type,
          balance_amount: balNum,
          balance_money_type: form.balance_money_type,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Expense ({expense.id})</DialogTitle>
          <DialogDescription>
            Update expenditure record, settlement status, and balances via server API.
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

          {form.category === 'Other' && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <Label htmlFor="edit-exp-other-cat">Specify Other Category</Label>
              <Input
                id="edit-exp-other-cat"
                placeholder="e.g. Sound Engineer, Stage Backdrop, Momento..."
                value={otherCategory}
                onChange={(e) => setOtherCategory(e.target.value)}
                required
              />
            </div>
          )}

          {/* Settlement Status Selector */}
          <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-3">
            <Label htmlFor="edit-exp-settlement-status" className="text-xs font-semibold">
              Advance & Settlement Tracking
            </Label>
            <Select
              value={form.settlement_status}
              onValueChange={(v) => set('settlement_status', v ?? 'Direct')}
            >
              <SelectTrigger id="edit-exp-settlement-status" className="text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Direct">Direct Expense (Standard / No Advance)</SelectItem>
                <SelectItem value="Advance Given">Advance Given (Pending Final Bill)</SelectItem>
                <SelectItem value="Settled">Settled (Reconciled & Balanced)</SelectItem>
              </SelectContent>
            </Select>

            {form.settlement_status !== 'Direct' && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
                <div>
                  <Label htmlFor="edit-advance-amount" className="text-[11px]">
                    Advance Amount (₹)
                  </Label>
                  <Input
                    id="edit-advance-amount"
                    type="number"
                    min="0"
                    step="1"
                    value={form.advance_amount}
                    onChange={(e) => set('advance_amount', e.target.value)}
                    className="h-8 text-xs"
                    placeholder="Advance amount"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-advance-type" className="text-[11px]">
                    Advance Mode
                  </Label>
                  <Select
                    value={form.advance_money_type}
                    onValueChange={(v) => set('advance_money_type', v ?? 'Cash')}
                  >
                    <SelectTrigger id="edit-advance-type" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-exp-desc">Description (Optional)</Label>
            <Input
              id="edit-exp-desc"
              placeholder="What was this for? (Optional)"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-exp-paid-by">Paid By / Volunteer</Label>
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
                <Label htmlFor="edit-exp-amount">
                  {form.settlement_status === 'Advance Given' ? 'Amount (₹)' : 'Actual Amount (₹)'}
                </Label>
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
              <div className="flex justify-between items-center">
                <Label htmlFor="edit-exp-money-type">Money Type</Label>
                {livePosition && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Avail: {formatINR(beforeAmount)}
                  </span>
                )}
              </div>
              <Select value={form.money_type} onValueChange={(v) => set('money_type', v ?? '')}>
                <SelectTrigger id="edit-exp-money-type">
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
                Your current <strong className="font-semibold">{form.money_type}</strong> balance of{' '}
                <strong className="font-semibold text-foreground">{formatINR(beforeAmount)}</strong> will become negative:{' '}
                <strong className="font-bold text-rose-600 dark:text-rose-400">{formatINR(afterAmount)}</strong> after updating this expense.
              </p>
            </div>
          )}

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
