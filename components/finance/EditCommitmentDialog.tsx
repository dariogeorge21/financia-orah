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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updatePersonalCommitment as updateCommitment } from '@/features/personal-commitments';
import type { PersonalCommitmentRecord, CommitmentStatus } from '@/lib/types';
import { formatINR } from '@/lib/calculations';

interface EditCommitmentDialogProps {
  commitment: PersonalCommitmentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditCommitmentDialog({
  commitment,
  open,
  onOpenChange,
  onSuccess,
}: EditCommitmentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [personName, setPersonName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [promised, setPromised] = useState('');
  const [received, setReceived] = useState('');
  const [moneyType, setMoneyType] = useState<'Cash' | 'UPI'>('UPI');
  const [status, setStatus] = useState<CommitmentStatus>('Pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (commitment) {
      setPersonName(commitment.person_name || '');
      setMobileNumber(commitment.mobile_number || '');
      setPromised(String(commitment.promised ?? 0));
      setReceived(String(commitment.received ?? 0));
      setStatus(commitment.status || 'Pending');
      setNotes(commitment.notes || '');
      setError(null);
    }
  }, [commitment, open]);

  if (!commitment) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!commitment?.id) {
      setError('Commitment ID is missing.');
      return;
    }

    if (!personName.trim()) {
      setError('Person name cannot be empty.');
      return;
    }

    const promisedNum = parseFloat(promised);
    if (isNaN(promisedNum) || promisedNum <= 0) {
      setError('Please enter a valid promised amount greater than 0.');
      return;
    }

    const receivedNum = parseFloat(received);
    if (isNaN(receivedNum) || receivedNum < 0) {
      setError('Received amount must be 0 or greater.');
      return;
    }

    startTransition(async () => {
      try {
        await updateCommitment(commitment.id, {
          person_name: personName.trim(),
          mobile_number: mobileNumber.trim() || null,
          promised: promisedNum,
          received: receivedNum,
          money_type: moneyType,
          status,
          notes: notes.trim() || null,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update commitment');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Commitment ({commitment.id})</DialogTitle>
          <DialogDescription>
            Update donor details, promised amount, received funds, or status. Any received amounts will be reflected automatically in Incomes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-person">Person Name</Label>
            <Input
              id="edit-person"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-mobile">Mobile Number</Label>
            <Input
              id="edit-mobile"
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="edit-promised">Promised (₹)</Label>
                {promised && !isNaN(parseFloat(promised)) && (
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {formatINR(parseFloat(promised))}
                  </span>
                )}
              </div>
              <Input
                id="edit-promised"
                type="number"
                min="1"
                step="1"
                value={promised}
                onChange={(e) => setPromised(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="edit-received">Received (₹)</Label>
                {received && !isNaN(parseFloat(received)) && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(received))}
                  </span>
                )}
              </div>
              <Input
                id="edit-received"
                type="number"
                min="0"
                step="1"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                required
              />
            </div>
          </div>

          {parseFloat(received) > 0 && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <Label htmlFor="edit-pcom-money-type">Payment Mode (for newly received funds)</Label>
              <div className="flex gap-2">
                {(['UPI', 'Cash'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMoneyType(m)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      moneyType === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:bg-muted text-foreground'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-status">Status</Label>
            <Select value={status} onValueChange={(val) => setStatus(val as CommitmentStatus)}>
              <SelectTrigger id="edit-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partially Received">Partially Received</SelectItem>
                <SelectItem value="Fully Received">Fully Received</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Notes / Follow-up Details</Label>
            <Textarea
              id="edit-notes"
              rows={2}
              value={notes}
              placeholder="Notes..."
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
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
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white"
            >
              {isPending ? 'Updating…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
