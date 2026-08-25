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
import { updateReimbursement } from '@/features/reimbursements';
import { formatINR } from '@/lib/calculations';
import type { ReimbursementRecord, ReimbursementStatus, MoneyType } from '@/lib/types';

interface EditReimbursementDialogProps {
  reimbursement: ReimbursementRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditReimbursementDialog({
  reimbursement,
  open,
  onOpenChange,
  onSuccess,
}: EditReimbursementDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState('');
  const [person, setPerson] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [expenseId, setExpenseId] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<ReimbursementStatus>('Pending');
  const [moneyTypePaid, setMoneyTypePaid] = useState<MoneyType | ''>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (reimbursement) {
      setDate(reimbursement.date || '');
      setPerson(reimbursement.person || '');
      setMobileNumber(reimbursement.mobile_number || '');
      setExpenseId(reimbursement.expense_id || '');
      setAmount(String(reimbursement.amount ?? 0));
      setStatus(reimbursement.status || 'Pending');
      setMoneyTypePaid(reimbursement.money_type_paid || '');
      setNotes(reimbursement.notes || '');
      setError(null);
    }
  }, [reimbursement, open]);

  if (!reimbursement) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!reimbursement) {
      setError('Reimbursement record not found.');
      return;
    }

    if (!person.trim() || !expenseId.trim()) {
      setError('Person name and Expense ID are required.');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    startTransition(async () => {
      try {
        await updateReimbursement(reimbursement.id, {
          date: date || undefined,
          person: person.trim(),
          mobile_number: mobileNumber.trim() || null,
          expense_id: expenseId.trim().toUpperCase(),
          amount: amountNum,
          status,
          money_type_paid: status === 'Paid' && moneyTypePaid ? (moneyTypePaid as MoneyType) : null,
          notes: notes.trim() || null,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update reimbursement record');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Reimbursement ({reimbursement.id})</DialogTitle>
          <DialogDescription>
            Update reimbursement status, settlement mode, or recipient details via server API.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-reimb-date">Date</Label>
              <Input
                id="edit-reimb-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-reimb-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus((v as ReimbursementStatus) ?? 'Pending')}
              >
                <SelectTrigger id="edit-reimb-status">
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
              <Label htmlFor="edit-reimb-person">Person Name</Label>
              <Input
                id="edit-reimb-person"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-reimb-mobile">Mobile Number</Label>
              <Input
                id="edit-reimb-mobile"
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-reimb-exp">Expense ID</Label>
              <Input
                id="edit-reimb-exp"
                value={expenseId}
                onChange={(e) => setExpenseId(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="edit-reimb-amount">Amount (₹)</Label>
                {amount && !isNaN(parseFloat(amount)) && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(amount))}
                  </span>
                )}
              </div>
              <Input
                id="edit-reimb-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          {status === 'Paid' && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-reimb-money-type">Paid Via</Label>
              <Select
                value={moneyTypePaid}
                onValueChange={(v) => setMoneyTypePaid((v as MoneyType) ?? '')}
              >
                <SelectTrigger id="edit-reimb-money-type">
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
            <Label htmlFor="edit-reimb-notes">Notes</Label>
            <Textarea
              id="edit-reimb-notes"
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
              className="bg-gradient-to-r from-cyan-600 to-sky-600 text-white"
            >
              {isPending ? 'Updating…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
