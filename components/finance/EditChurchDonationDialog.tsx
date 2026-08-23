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
import { updateChurchDonation } from '@/features/church-donations';
import type { ChurchDonationRecord, MoneyType } from '@/lib/types';

interface EditChurchDonationDialogProps {
  donation: ChurchDonationRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditChurchDonationDialog({
  donation,
  open,
  onOpenChange,
  onSuccess,
}: EditChurchDonationDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    church_name: '',
    contact_number: '',
    date: '',
    collected_by: '',
    money_type: 'Cash' as MoneyType,
    is_handed_over: false,
    amount: '',
    notes: '',
    screenshot_link: '',
  });

  useEffect(() => {
    if (donation) {
      setForm({
        church_name: donation.church_name || '',
        contact_number: donation.contact_number || '',
        date: donation.date || new Date().toISOString().split('T')[0],
        collected_by: donation.collected_by || '',
        money_type: donation.money_type || 'Cash',
        is_handed_over: donation.is_handed_over !== false,
        amount: String(donation.amount || ''),
        notes: donation.notes || '',
        screenshot_link: donation.screenshot_link || '',
      });
      setError(null);
    }
  }, [donation]);

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!donation) return;
    setError(null);

    const amountNum = parseFloat(form.amount);
    if (!form.church_name.trim()) {
      setError('Please enter the church / convent name.');
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    startTransition(async () => {
      try {
        await updateChurchDonation(donation.id, {
          church_name: form.church_name.trim(),
          contact_number: form.contact_number.trim() || null,
          date: form.date,
          collected_by: form.collected_by.trim() || null,
          money_type: form.money_type,
          amount: amountNum,
          is_handed_over: form.money_type === 'UPI' ? true : form.is_handed_over,
          notes: form.notes.trim() || null,
          screenshot_link: form.screenshot_link.trim() || null,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update church donation.');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Church / Convent Donation</DialogTitle>
          <DialogDescription>
            Modify details for <strong className="text-foreground">{donation?.id}</strong>. Changes will automatically sync to Income.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-lg bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
              {error}
            </div>
          )}

          {/* Church/Convent Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_church_name">Church / Convent Name *</Label>
            <Input
              id="edit_church_name"
              value={form.church_name}
              onChange={(e) => set('church_name', e.target.value)}
              required
            />
          </div>

          {/* Contact Number & Collected By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_contact_number">Contact / Phone Number</Label>
              <Input
                id="edit_contact_number"
                type="tel"
                value={form.contact_number}
                onChange={(e) => set('contact_number', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit_collected_by">Collected By (Volunteer)</Label>
              <Input
                id="edit_collected_by"
                value={form.collected_by}
                onChange={(e) => set('collected_by', e.target.value)}
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
                <Label htmlFor="edit_chu_handed_over" className="text-xs font-semibold text-foreground cursor-pointer">
                  Cash Handed Over to Finance Team?
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Toggle ON if the volunteer has handed over the collected donation to the finance team.
                </p>
              </div>
              <Switch
                id="edit_chu_handed_over"
                checked={form.is_handed_over}
                onCheckedChange={(checked) => set('is_handed_over', checked)}
              />
            </div>
          )}

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
