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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { createCoupon } from '@/features/coupons';
import { formatINR, calcMoneyPosition, getTodayDateString } from '@/lib/calculations';
import type { CouponPaymentMode, MoneyPosition } from '@/lib/types';
import { useBalanceNotification } from '@/components/finance/BalanceNotificationProvider';

interface AddCouponDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactElement;
  moneyPosition?: MoneyPosition;
}

export function AddCouponDialog({ onSuccess, trigger, moneyPosition }: AddCouponDialogProps) {
  const { notifyTransaction } = useBalanceNotification();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
    contributor_name: '',
    mobile_number: '',
    date: getTodayDateString(),
    money_type: 'Cash' as CouponPaymentMode,
    is_handed_over: false,
    amount: '',
    cash_amount: '',
    upi_amount: '',
    collected_by: '',
    booklet_number: '',
    notes: '',
    prayer_request: '',
    screenshot_link: '',
  });

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const activePosition = moneyPosition ?? livePosition;
  const currentCash = activePosition?.cashAvailable ?? 0;
  const currentUpi = activePosition?.upiAvailable ?? 0;

  const cashSplitNum = parseFloat(form.cash_amount) || 0;
  const upiSplitNum = parseFloat(form.upi_amount) || 0;
  const calculatedSplitTotal = cashSplitNum + upiSplitNum;

  const beforeAmount =
    form.money_type === 'Cash'
      ? currentCash
      : form.money_type === 'UPI'
      ? currentUpi
      : currentCash + currentUpi;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.contributor_name.trim()) {
      setError('Please enter the contributor name.');
      return;
    }

    let finalAmount = 0;
    let finalCashAmt: number | null = null;
    let finalUpiAmt: number | null = null;

    if (form.money_type === 'Cash + UPI') {
      if (cashSplitNum <= 0) {
        setError('Please enter a valid Cash amount greater than 0.');
        return;
      }
      if (upiSplitNum <= 0) {
        setError('Please enter a valid UPI amount greater than 0.');
        return;
      }
      finalAmount = calculatedSplitTotal;
      finalCashAmt = cashSplitNum;
      finalUpiAmt = upiSplitNum;
    } else {
      finalAmount = parseFloat(form.amount);
      if (isNaN(finalAmount) || finalAmount <= 0) {
        setError('Please enter a valid amount greater than 0.');
        return;
      }
      if (form.money_type === 'Cash') {
        finalCashAmt = finalAmount;
        finalUpiAmt = 0;
      } else {
        finalCashAmt = 0;
        finalUpiAmt = finalAmount;
      }
    }

    startTransition(async () => {
      try {
        await createCoupon({
          contributor_name: form.contributor_name.trim(),
          mobile_number: form.mobile_number.trim() || null,
          date: form.date || new Date().toISOString().split('T')[0],
          money_type: form.money_type,
          amount: finalAmount,
          cash_amount: finalCashAmt,
          upi_amount: finalUpiAmt,
          is_handed_over: form.money_type === 'UPI' ? true : form.is_handed_over,
          collected_by: form.collected_by.trim() || null,
          booklet_number: form.booklet_number.trim() || null,
          notes: form.notes.trim() || null,
          prayer_request: form.prayer_request.trim() || null,
          screenshot_link: form.screenshot_link.trim() || null,
        });

        notifyTransaction({
          type: 'income',
          title: `Coupon: ${form.contributor_name.trim()} (${form.money_type})`,
          description:
            form.money_type === 'Cash + UPI'
              ? `${form.booklet_number ? `Booklet #${form.booklet_number} • ` : ''}Cash: ${formatINR(cashSplitNum)} + UPI: ${formatINR(upiSplitNum)}`
              : form.booklet_number
              ? `Booklet #${form.booklet_number}`
              : 'Coupon collection',
          moneyType: form.money_type === 'Cash + UPI' ? 'Cash' : form.money_type,
          beforeAmount: beforeAmount,
          deltaAmount: finalAmount,
          afterAmount: beforeAmount + finalAmount,
        });

        setForm({
          contributor_name: '',
          mobile_number: '',
          date: getTodayDateString(),
          money_type: 'Cash',
          is_handed_over: false,
          amount: '',
          cash_amount: '',
          upi_amount: '',
          collected_by: '',
          booklet_number: '',
          notes: '',
          prayer_request: '',
          screenshot_link: '',
        });
        setOpen(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to record coupon.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" className="gap-1.5 shadow-sm font-semibold">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Record Coupon
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Coupon Collection</DialogTitle>
          <DialogDescription>
            Log a new coupon contribution. This automatically syncs to the Income ledger.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
              {error}
            </div>
          )}

          {/* Contributor Name */}
          <div className="space-y-1.5">
            <Label htmlFor="contributor_name">Contributor Name *</Label>
            <Input
              id="contributor_name"
              placeholder="e.g. John Doe, George Varghese"
              value={form.contributor_name}
              onChange={(e) => set('contributor_name', e.target.value)}
              required
            />
          </div>

          {/* Phone Number & Booklet Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mobile_number">Phone Number</Label>
              <Input
                id="mobile_number"
                type="tel"
                placeholder="e.g. +91 98765 43210"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booklet_number">Coupon Booklet Number</Label>
              <Input
                id="booklet_number"
                placeholder="e.g. BKT-042, 105"
                value={form.booklet_number}
                onChange={(e) => set('booklet_number', e.target.value)}
              />
            </div>
          </div>

          {/* Date & Money Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="money_type">Payment Mode *</Label>
              <Select
                value={form.money_type}
                onValueChange={(val) => set('money_type', val as CouponPaymentMode)}
              >
                <SelectTrigger id="money_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash Only</SelectItem>
                  <SelectItem value="UPI">UPI / Digital Only</SelectItem>
                  <SelectItem value="Cash + UPI">Cash + UPI (Split)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount Inputs: Split Mode vs Single Mode */}
          {form.money_type === 'Cash + UPI' ? (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500" />
                  Split Payment Breakdown
                </span>
                <span className="text-[11px] font-mono font-medium text-muted-foreground">
                  Total: <strong className="text-foreground">{formatINR(calculatedSplitTotal)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cash_amount" className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    Cash Portion (₹) *
                  </Label>
                  <Input
                    id="cash_amount"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 3000"
                    value={form.cash_amount}
                    onChange={(e) => set('cash_amount', e.target.value)}
                    className="border-emerald-500/30 focus-visible:ring-emerald-500"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="upi_amount" className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                    UPI Portion (₹) *
                  </Label>
                  <Input
                    id="upi_amount"
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 2000"
                    value={form.upi_amount}
                    onChange={(e) => set('upi_amount', e.target.value)}
                    className="border-indigo-500/30 focus-visible:ring-indigo-500"
                    required
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (₹) *</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="any"
                placeholder="e.g. 500"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                required
              />
            </div>
          )}

          {/* Cash Handed Over Toggle (for Cash or Cash portion of Cash + UPI) */}
          {(form.money_type === 'Cash' || form.money_type === 'Cash + UPI') && (
            <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="cpn-handed-over" className="text-xs font-semibold text-foreground cursor-pointer">
                  {form.money_type === 'Cash + UPI'
                    ? `Cash Portion Handed Over to Finance?${cashSplitNum > 0 ? ` (${formatINR(cashSplitNum)})` : ''}`
                    : 'Cash Handed Over to Finance Team?'}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {form.money_type === 'Cash + UPI'
                    ? 'Toggle ON if the volunteer has already handed the cash portion over to finance.'
                    : 'Toggle ON if the volunteer has already handed the collected cash to finance.'}
                </p>
              </div>
              <Switch
                id="cpn-handed-over"
                checked={form.is_handed_over}
                onCheckedChange={(checked) => set('is_handed_over', checked)}
              />
            </div>
          )}

          {/* Collected By (Volunteer) */}
          <div className="space-y-1.5">
            <Label htmlFor="collected_by">Collected By (Volunteer)</Label>
            <Input
              id="collected_by"
              placeholder="e.g. Kevin (Pala Subteam)"
              value={form.collected_by}
              onChange={(e) => set('collected_by', e.target.value)}
            />
          </div>

          {/* Payment Screenshot Link */}
          <div className="space-y-1.5">
            <Label htmlFor="screenshot_link">Payment Receipt / Screenshot URL (optional)</Label>
            <Input
              id="screenshot_link"
              type="url"
              placeholder="https://drive.google.com/... or image link"
              value={form.screenshot_link}
              onChange={(e) => set('screenshot_link', e.target.value)}
            />
          </div>

          {/* Prayer Request */}
          <div className="space-y-1.5 rounded-xl border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20 p-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🙏</span>
              <Label htmlFor="coupon-prayer-request" className="text-xs font-semibold text-foreground">
                Prayer Request / Intention (Optional)
              </Label>
            </div>
            <Textarea
              id="coupon-prayer-request"
              rows={2}
              placeholder="e.g. for donor's family, health, intentions..."
              value={form.prayer_request}
              onChange={(e) => set('prayer_request', e.target.value)}
              className="text-xs bg-background"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Optional Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Additional information or context..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Record Coupon'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
