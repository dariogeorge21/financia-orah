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
import { updateIncome } from '@/features/income';
import { formatINR } from '@/lib/calculations';
import type { IncomeRecord, IncomeType, MoneyType } from '@/lib/types';

const INCOME_TYPES: IncomeType[] = [
  'Donation',
  'Registration',
  'Personal Commitment',
  'Finance Call',
  'Church',
  'Coupon',
  'Sponsor',
  'Other',
];

interface EditIncomeDialogProps {
  income: IncomeRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditIncomeDialog({
  income,
  open,
  onOpenChange,
  onSuccess,
}: EditIncomeDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [type, setType] = useState<string>('Donation');
  const [otherType, setOtherType] = useState('');
  const [contributor, setContributor] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [moneyType, setMoneyType] = useState<MoneyType>('Cash');
  const [isHandedOver, setIsHandedOver] = useState(true);
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (income) {
      setDate(income.date || '');
      const standardTypes = ['Donation', 'Registration', 'Personal Commitment', 'Finance Call', 'Church', 'Coupon', 'Sponsor'];
      if (income.type && !standardTypes.includes(income.type)) {
        setType('Other');
        setOtherType(income.type === 'Other' ? '' : income.type);
      } else {
        setType(income.type || 'Donation');
        setOtherType('');
      }
      setContributor(income.contributor || '');
      setMobileNumber(income.mobile_number || '');
      setDescription(income.description || '');
      setAmount(String(income.amount ?? 0));
      setMoneyType(income.money_type || 'Cash');
      setIsHandedOver(income.is_handed_over !== false);
      setReferenceId(income.reference_id || income.commitment_id || '');
      setNotes(income.notes || '');
      setError(null);
    }
  }, [income, open]);

  if (!income) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!income) {
      setError('Income record not found.');
      return;
    }

    const finalType = type === 'Other' ? otherType.trim() : type;

    if (type === 'Other' && !finalType) {
      setError('Please specify what the other income type is.');
      return;
    }

    if (!finalType || !contributor.trim()) {
      setError('Please fill all required fields (Type, Contributor).');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    startTransition(async () => {
      try {
        await updateIncome(income.id, {
          date: date || undefined,
          type: finalType as IncomeType,
          contributor: contributor.trim(),
          mobile_number: mobileNumber.trim() || null,
          description: description.trim(),
          amount: amountNum,
          money_type: moneyType,
          is_handed_over: moneyType === 'UPI' ? true : isHandedOver,
          reference_id: referenceId.trim() || null,
          notes: notes.trim() || null,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update income record');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Income ({income.id})</DialogTitle>
          <DialogDescription>
            Update income transaction details via server API.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-inc-date">Date</Label>
              <Input
                id="edit-inc-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-inc-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v ?? 'Donation')}>
                <SelectTrigger id="edit-inc-type">
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

          {type === 'Other' && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <Label htmlFor="edit-inc-other-type">Specify Other Income Type</Label>
              <Input
                id="edit-inc-other-type"
                placeholder="e.g. Grant, Book Stall, Merchandise..."
                value={otherType}
                onChange={(e) => setOtherType(e.target.value)}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-inc-contributor">Contributor</Label>
              <Input
                id="edit-inc-contributor"
                value={contributor}
                onChange={(e) => setContributor(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-inc-mobile">Mobile Number</Label>
              <Input
                id="edit-inc-mobile"
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-inc-desc">Description (Optional)</Label>
            <Input
              id="edit-inc-desc"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="edit-inc-amount">Amount (₹)</Label>
                {amount && !isNaN(parseFloat(amount)) && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(amount))}
                  </span>
                )}
              </div>
              <Input
                id="edit-inc-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-inc-money-type">Money Type</Label>
              <Select value={moneyType} onValueChange={(v) => setMoneyType((v as MoneyType) ?? 'Cash')}>
                <SelectTrigger id="edit-inc-money-type">
                  <SelectValue placeholder="Cash / UPI" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {moneyType === 'Cash' && (
            <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <div className="space-y-0.5 pr-2">
                <Label htmlFor="edit-inc-handed-over" className="text-xs font-semibold text-foreground cursor-pointer">
                  Cash Handed Over to Finance?
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Toggle ON if cash is in hand with finance team. Toggle OFF if cash is still pending with volunteer.
                </p>
              </div>
              <Switch
                id="edit-inc-handed-over"
                checked={isHandedOver}
                onCheckedChange={(checked) => setIsHandedOver(checked)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-inc-reference">Reference ID (PCOM-XXXX or FC-XXXX)</Label>
            <Input
              id="edit-inc-reference"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-inc-notes">Notes</Label>
            <Textarea
              id="edit-inc-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white"
            >
              {isPending ? 'Updating…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
