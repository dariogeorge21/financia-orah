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
import { Badge } from '@/components/ui/badge';
import { settleExpense } from '@/features/expenses';
import { formatINR, calcMoneyPosition } from '@/lib/calculations';
import type { ExpenseRecord, MoneyType, MoneyPosition } from '@/lib/types';
import { useBalanceNotification } from '@/components/finance/BalanceNotificationProvider';

interface SettleExpenseDialogProps {
  expense: ExpenseRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  moneyPosition?: MoneyPosition;
}

export function SettleExpenseDialog({
  expense,
  open,
  onOpenChange,
  onSuccess,
  moneyPosition,
}: SettleExpenseDialogProps) {
  const { notifyTransaction } = useBalanceNotification();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [actualAmount, setActualAmount] = useState('');
  const [balanceMoneyType, setBalanceMoneyType] = useState<MoneyType>('Cash');
  const [hasReceipt, setHasReceipt] = useState(false);
  const [receiptLink, setReceiptLink] = useState('');
  const [notes, setNotes] = useState('');
  const [livePosition, setLivePosition] = useState<MoneyPosition | null>(null);

  const advanceAmt = Number(expense?.advance_amount ?? expense?.amount ?? 0);
  const advanceType = (expense?.advance_money_type || expense?.money_type || 'Cash') as MoneyType;

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

  useEffect(() => {
    if (expense) {
      setActualAmount(String(expense.advance_amount ?? expense.amount ?? ''));
      setBalanceMoneyType(advanceType);
      setHasReceipt(Boolean(expense.has_receipt));
      setReceiptLink(expense.receipt_link || '');
      setNotes(expense.notes || '');
      setError(null);
    }
  }, [expense, open, advanceType]);

  if (!expense) return null;

  const actualNum = parseFloat(actualAmount) || 0;
  const balanceDiff = actualNum - advanceAmt; // Negative = refund to desk, Positive = extra paid to volunteer
  const isRefund = balanceDiff < 0;
  const isExtra = balanceDiff > 0;
  const isExact = balanceDiff === 0 && actualNum > 0;

  const activePosition = moneyPosition ?? livePosition;
  const currentCash = activePosition?.cashAvailable ?? 0;
  const currentUpi = activePosition?.upiAvailable ?? 0;

  // Check if extra payment would cause negative balance in chosen balance money type
  const availableInChannel = balanceMoneyType === 'Cash' ? currentCash : currentUpi;
  const isNegative = isExtra && balanceDiff > availableInChannel;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!expense) {
      setError('Expense record not found.');
      return;
    }

    if (isNaN(actualNum) || actualNum <= 0) {
      setError('Please enter a valid actual bill amount greater than 0.');
      return;
    }

    startTransition(async () => {
      try {
        await settleExpense(
          expense.id,
          {
            actual_amount: actualNum,
            balance_money_type: balanceDiff !== 0 ? balanceMoneyType : advanceType,
            has_receipt: hasReceipt,
            receipt_link: receiptLink.trim() || null,
            notes: notes.trim() || null,
          },
          advanceAmt
        );

        notifyTransaction({
          type: 'expense',
          title: 'Advance Settled',
          description: `${expense.category} • ${expense.paid_by} (Bill: ${formatINR(actualNum)})`,
          moneyType: balanceDiff !== 0 ? balanceMoneyType : advanceType,
          beforeAmount: availableInChannel,
          deltaAmount: Math.abs(balanceDiff),
          afterAmount: isRefund
            ? availableInChannel + Math.abs(balanceDiff)
            : availableInChannel - balanceDiff,
          durationMs: 3500,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to settle expense');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <DialogTitle className="text-lg">Settle Volunteer Advance</DialogTitle>
              <DialogDescription className="text-xs">
                Reconcile actual purchase bill and balance exchange with volunteer.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Advance Details Card */}
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="font-mono text-[11px]">
                {expense.id}
              </Badge>
              <span className="font-medium text-foreground">{expense.category}</span>
            </div>
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 gap-1 text-[11px]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Advance in Progress
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs">
            <div>
              <span className="text-muted-foreground text-[11px]">Volunteer:</span>
              <p className="font-semibold text-foreground truncate">
                {expense.paid_by}
                {expense.mobile_number && (
                  <span className="font-normal text-muted-foreground ml-1">
                    ({expense.mobile_number})
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground text-[11px]">Advance Disbursed:</span>
              <p className="font-bold text-foreground">
                {formatINR(advanceAmt)}{' '}
                <Badge
                  variant={advanceType === 'Cash' ? 'secondary' : 'outline'}
                  className="text-[10px] px-1.5 py-0 ml-0.5"
                >
                  {advanceType}
                </Badge>
              </p>
            </div>
          </div>

          {expense.description && (
            <p className="text-[11px] text-muted-foreground italic border-t border-border/30 pt-1.5 line-clamp-1">
              Purpose: “{expense.description}”
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          {/* Actual Bill Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="actual-amount" className="font-semibold text-xs">
                Actual Purchase Bill Amount (₹) <span className="text-rose-500">*</span>
              </Label>
              {actualNum > 0 && (
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  {formatINR(actualNum)}
                </span>
              )}
            </div>
            <Input
              id="actual-amount"
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 489 or 540"
              value={actualAmount}
              onChange={(e) => setActualAmount(e.target.value)}
              className="text-base font-semibold"
              required
              autoFocus
            />
          </div>

          {/* Dynamic Reconciliation Card */}
          {actualNum > 0 && (
            <div
              className={`rounded-2xl border p-3.5 space-y-2.5 transition-all animate-in fade-in-50 duration-200 ${
                isRefund
                  ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : isExtra
                  ? 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {isRefund && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs font-bold">
                      ↓
                    </div>
                  )}
                  {isExtra && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs font-bold">
                      ↑
                    </div>
                  )}
                  {isExact && (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs font-bold">
                      ✓
                    </div>
                  )}
                  <span
                    className={`font-bold text-xs ${
                      isRefund
                        ? 'text-emerald-800 dark:text-emerald-300'
                        : isExtra
                        ? 'text-amber-800 dark:text-amber-300'
                        : 'text-blue-800 dark:text-blue-300'
                    }`}
                  >
                    {isRefund && `Refund from Volunteer: ${formatINR(Math.abs(balanceDiff))}`}
                    {isExtra && `Extra to Pay Volunteer: ${formatINR(balanceDiff)}`}
                    {isExact && 'Exact Settlement (₹0 Balance)'}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Adv: {formatINR(advanceAmt)} → Bill: {formatINR(actualNum)}
                </span>
              </div>

              {/* Channel Selector for Balance Transfer */}
              {!isExact && (
                <div className="pt-2 border-t border-border/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bal-money-type" className="text-xs">
                      {isRefund ? 'Refund Received Via:' : 'Pay Additional Balance Via:'}
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      Avail: {formatINR(balanceMoneyType === 'Cash' ? currentCash : currentUpi)}
                    </span>
                  </div>

                  <Select
                    value={balanceMoneyType}
                    onValueChange={(v) => setBalanceMoneyType((v ?? 'Cash') as MoneyType)}
                  >
                    <SelectTrigger id="bal-money-type" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">
                        Cash Box ({formatINR(currentCash)} avail) —{' '}
                        {isRefund
                          ? `Will +${formatINR(Math.abs(balanceDiff))}`
                          : `Will -${formatINR(balanceDiff)}`}
                      </SelectItem>
                      <SelectItem value="UPI">
                        UPI Account ({formatINR(currentUpi)} avail) —{' '}
                        {isRefund
                          ? `Will +${formatINR(Math.abs(balanceDiff))}`
                          : `Will -${formatINR(balanceDiff)}`}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Insufficient Balance Warning */}
          {isNegative && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <strong>Warning:</strong> Available {balanceMoneyType} balance ({formatINR(availableInChannel)}) is less than the extra amount to pay ({formatINR(balanceDiff)}).
            </div>
          )}

          {/* Receipt toggle & link */}
          <div className="flex items-center gap-3 pt-1">
            <Switch id="settle-receipt" checked={hasReceipt} onCheckedChange={setHasReceipt} />
            <Label htmlFor="settle-receipt" className="text-xs cursor-pointer">
              Attach Receipt / Purchase Bill Link
            </Label>
          </div>

          {hasReceipt && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <Label htmlFor="settle-receipt-link" className="text-xs">
                Receipt Image URL / Drive Link
              </Label>
              <Input
                id="settle-receipt-link"
                placeholder="https://..."
                value={receiptLink}
                onChange={(e) => setReceiptLink(e.target.value)}
                className="text-xs"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="settle-notes" className="text-xs">
              Settlement Notes / Remarks (Optional)
            </Label>
            <Textarea
              id="settle-notes"
              placeholder="e.g. Returned ₹11 change to desk, receipt uploaded..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
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
              disabled={isPending || !actualNum}
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20"
            >
              {isPending ? (
                'Settling…'
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Complete Settlement
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
