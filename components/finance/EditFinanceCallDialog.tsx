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
import { updateFinanceCall } from '@/features/finance-calls';
import type { FinanceCallRecord, CommitmentStatus } from '@/lib/types';
import { formatINR } from '@/lib/calculations';

interface EditFinanceCallDialogProps {
  call: FinanceCallRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditFinanceCallDialog({
  call,
  open,
  onOpenChange,
  onSuccess,
}: EditFinanceCallDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [personName, setPersonName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [callerName, setCallerName] = useState('');
  const [promised, setPromised] = useState('');
  const [received, setReceived] = useState('');
  const [status, setStatus] = useState<CommitmentStatus>('Pending');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (call) {
      setPersonName(call.person_name || '');
      setMobileNumber(call.mobile_number || '');
      setCallerName(call.caller_name || '');
      setPromised(String(call.promised ?? 0));
      setReceived(String(call.received ?? 0));
      setStatus(call.status || 'Pending');
      setNotes(call.notes || '');
      setError(null);
    }
  }, [call, open]);

  if (!call) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!call) {
      setError('Finance call not found.');
      return;
    }

    if (!personName.trim()) {
      setError('Contact / Donor name cannot be empty.');
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
        await updateFinanceCall(call.id, {
          person_name: personName.trim(),
          mobile_number: mobileNumber.trim() || null,
          caller_name: callerName.trim() || null,
          promised: promisedNum,
          received: receivedNum,
          status,
          notes: notes.trim() || null,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update finance call');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Finance Call ({call.id})</DialogTitle>
          <DialogDescription>
            Update pledge details, caller info, or collection status via server API.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-fc-person">Contact / Donor Name</Label>
            <Input
              id="edit-fc-person"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-fc-mobile">Mobile Number</Label>
              <Input
                id="edit-fc-mobile"
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-fc-caller">Caller (Volunteer)</Label>
              <Input
                id="edit-fc-caller"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="edit-fc-promised">Promised (₹)</Label>
                {promised && !isNaN(parseFloat(promised)) && (
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {formatINR(parseFloat(promised))}
                  </span>
                )}
              </div>
              <Input
                id="edit-fc-promised"
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
                <Label htmlFor="edit-fc-received">Received (₹)</Label>
                {received && !isNaN(parseFloat(received)) && (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(received))}
                  </span>
                )}
              </div>
              <Input
                id="edit-fc-received"
                type="number"
                min="0"
                step="1"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-fc-status">Status</Label>
            <Select value={status} onValueChange={(val) => setStatus(val as CommitmentStatus)}>
              <SelectTrigger id="edit-fc-status">
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
            <Label htmlFor="edit-fc-notes">Notes / Follow-up Details</Label>
            <Textarea
              id="edit-fc-notes"
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
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white"
            >
              {isPending ? 'Updating…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
