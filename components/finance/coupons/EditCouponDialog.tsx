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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { updateCoupon } from '@/features/coupons';
import type { CouponRecord, MoneyType } from '@/lib/types';

interface EditCouponDialogProps {
  coupon: CouponRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditCouponDialog({
  coupon,
  open,
  onOpenChange,
  onSuccess,
}: EditCouponDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    contributor_name: '',
    mobile_number: '',
    date: '',
    money_type: 'Cash' as MoneyType,
    is_handed_over: false,
    amount: '',
    collected_by: '',
    booklet_number: '',
    notes: '',
    prayer_request: '',
    screenshot_link: '',
  });

  useEffect(() => {
    if (coupon) {
      setForm({
        contributor_name: coupon.contributor_name || '',
        mobile_number: coupon.mobile_number || '',
        date: coupon.date || new Date().toISOString().split('T')[0],
        money_type: coupon.money_type || 'Cash',
        is_handed_over: coupon.is_handed_over !== false,
        amount: String(coupon.amount || ''),
        collected_by: coupon.collected_by || '',
        booklet_number: coupon.booklet_number || '',
        notes: coupon.notes || '',
        prayer_request: coupon.prayer_request || '',
        screenshot_link: coupon.screenshot_link || '',
      });
      setError(null);
    }
  }, [coupon]);

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coupon) return;
    setError(null);

    const amountNum = parseFloat(form.amount);
    if (!form.contributor_name.trim()) {
      setError('Please enter the contributor name.');
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    startTransition(async () => {
      try {
        await updateCoupon(coupon.id, {
          contributor_name: form.contributor_name.trim(),
          mobile_number: form.mobile_number.trim() || null,
          date: form.date,
          money_type: form.money_type,
          amount: amountNum,
          is_handed_over: form.money_type === 'UPI' ? true : form.is_handed_over,
          collected_by: form.collected_by.trim() || null,
          booklet_number: form.booklet_number.trim() || null,
          notes: form.notes.trim() || null,
          prayer_request: form.prayer_request.trim() || null,
          screenshot_link: form.screenshot_link.trim() || null,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update coupon.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Coupon Record</DialogTitle>
          <DialogDescription>
            Modify details for <strong className="text-foreground">{coupon?.id}</strong>. Changes will automatically sync to Income.
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
            <Label htmlFor="edit_contributor_name">Contributor Name *</Label>
            <Input
              id="edit_contributor_name"
              value={form.contributor_name}
              onChange={(e) => set('contributor_name', e.target.value)}
              required
            />
          </div>

          {/* Phone Number & Booklet Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_mobile_number">Phone Number</Label>
              <Input
                id="edit_mobile_number"
                type="tel"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_booklet_number">Coupon Booklet Number</Label>
              <Input
                id="edit_booklet_number"
                value={form.booklet_number}
                onChange={(e) => set('booklet_number', e.target.value)}
              />
            </div>
          </div>

          {/* Date, Money Type & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_date">Date</Label>
              <Input
                id="edit_date"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_money_type">Money Type *</Label>
              <Select
                value={form.money_type}
                onValueChange={(val) => set('money_type', val as MoneyType)}
              >
                <SelectTrigger id="edit_money_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_amount">Amount (₹) *</Label>
              <Input
                id="edit_amount"
                type="number"
                min="1"
                step="any"
                value={form.amount}
                onChange={(e) => set('amount', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Cash Handed Over Toggle */}
          {form.money_type === 'Cash' && (
            <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="edit_cpn_handed_over" className="text-xs font-semibold text-foreground cursor-pointer">
                  Cash Handed Over to Finance Team?
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Toggle ON if the volunteer has handed the cash over to finance.
                </p>
              </div>
              <Switch
                id="edit_cpn_handed_over"
                checked={form.is_handed_over}
                onCheckedChange={(checked) => set('is_handed_over', checked)}
              />
            </div>
          )}

          {/* Collected By (Volunteer) */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_collected_by">Collected By (Volunteer)</Label>
            <Input
              id="edit_collected_by"
              value={form.collected_by}
              onChange={(e) => set('collected_by', e.target.value)}
            />
          </div>

          {/* Payment Screenshot Link */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_screenshot_link">Payment Receipt / Screenshot URL</Label>
            <Input
              id="edit_screenshot_link"
              type="url"
              value={form.screenshot_link}
              onChange={(e) => set('screenshot_link', e.target.value)}
            />
          </div>

          {/* Prayer Request */}
          <div className="space-y-1.5 rounded-xl border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20 p-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🙏</span>
              <Label htmlFor="edit_coupon_prayer" className="text-xs font-semibold text-foreground">
                Prayer Request / Intention (Optional)
              </Label>
            </div>
            <Textarea
              id="edit_coupon_prayer"
              rows={2}
              value={form.prayer_request}
              placeholder="e.g. for donor's family, health, intentions..."
              onChange={(e) => set('prayer_request', e.target.value)}
              className="text-xs bg-background"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_notes">Optional Notes</Label>
            <Textarea
              id="edit_notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Updating...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
