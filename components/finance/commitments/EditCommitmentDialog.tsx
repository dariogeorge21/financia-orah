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
import { Switch } from '@/components/ui/switch';
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
  const [callerName, setCallerName] = useState('');
  const [promised, setPromised] = useState('');
  const [received, setReceived] = useState('');
  const [moneyType, setMoneyType] = useState<'Cash' | 'UPI'>('UPI');
  const [isHandedOver, setIsHandedOver] = useState(false);
  const [screenshotLink, setScreenshotLink] = useState('');
  const [status, setStatus] = useState<CommitmentStatus>('Pending');
  const [notes, setNotes] = useState('');
  const [prayerRequest, setPrayerRequest] = useState('');

  useEffect(() => {
    if (commitment) {
      setPersonName(commitment.person_name || '');
      setMobileNumber(commitment.mobile_number || '');
      setCallerName(commitment.caller_name || '');
      const promisedVal = String(commitment.promised ?? 0);
      setPromised(promisedVal);
      const currentStatus = commitment.status || 'Pending';
      setStatus(currentStatus);
      if (currentStatus === 'Fully Received') {
        setReceived(promisedVal);
      } else {
        setReceived(String(commitment.received ?? 0));
      }
      setMoneyType(commitment.money_type === 'Cash' ? 'Cash' : 'UPI');
      setIsHandedOver(commitment.is_handed_over !== false);
      setScreenshotLink(commitment.screenshot_link || '');
      setNotes(commitment.notes || '');
      setPrayerRequest(commitment.prayer_request || '');
      setError(null);
    }
  }, [commitment, open]);

  // When status changes, adjust received amount automatically
  function handleStatusChange(newStatus: CommitmentStatus) {
    setStatus(newStatus);
    if (newStatus === 'Fully Received') {
      setReceived(promised);
    } else if (newStatus === 'Pending' || newStatus === 'Cancelled') {
      setReceived('0');
    } else if (newStatus === 'Partially Received') {
      if (!received || parseFloat(received) >= parseFloat(promised) || parseFloat(received) === 0) {
        setReceived(commitment?.received && commitment.received < (commitment?.promised ?? 0) ? String(commitment.received) : '');
      }
    }
  }

  // When promised amount changes, if Fully Received, keep received synced
  function handlePromisedChange(val: string) {
    setPromised(val);
    if (status === 'Fully Received') {
      setReceived(val);
    }
  }

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

    let finalReceived = 0;
    if (status === 'Fully Received') {
      finalReceived = promisedNum;
    } else if (status === 'Partially Received') {
      finalReceived = received ? parseFloat(received) : 0;
      if (isNaN(finalReceived) || finalReceived <= 0) {
        setError('Please enter a valid received amount greater than 0 for partial payment.');
        return;
      }
      if (finalReceived > promisedNum) {
        setError(`Received amount (${formatINR(finalReceived)}) cannot be greater than the promised amount (${formatINR(promisedNum)}).`);
        return;
      }
      if (finalReceived === promisedNum) {
        setStatus('Fully Received');
      }
    } else {
      finalReceived = 0;
    }

    startTransition(async () => {
      try {
        await updateCommitment(commitment.id, {
          person_name: personName.trim(),
          mobile_number: mobileNumber.trim() || null,
          caller_name: callerName.trim() || null,
          promised: promisedNum,
          received: finalReceived,
          money_type: finalReceived > 0 ? moneyType : undefined,
          is_handed_over: finalReceived > 0 && moneyType === 'Cash' ? isHandedOver : true,
          screenshot_link: screenshotLink.trim() || null,
          status,
          notes: notes.trim() || null,
          prayer_request: prayerRequest.trim() || null,
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
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Personal Commitment</DialogTitle>
          <DialogDescription>
            Update donor details, committed amount, and payment progress for {commitment.id}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Person Name *</Label>
              <Input
                id="edit-name"
                placeholder="Full name"
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
                placeholder="Mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-caller">Caller / Follow-up Volunteer</Label>
            <Input
              id="edit-caller"
              placeholder="Name of volunteer following up"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="edit-promised">Promised Amount (₹) *</Label>
              {promised && !isNaN(parseFloat(promised)) && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatINR(parseFloat(promised))}
                </span>
              )}
            </div>
            <Input
              id="edit-promised"
              type="number"
              min="1"
              step="1"
              placeholder="0"
              value={promised}
              onChange={(e) => handlePromisedChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={status}
              onValueChange={(val) => handleStatusChange(val as CommitmentStatus)}
            >
              <SelectTrigger id="edit-status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending (Not Yet Received)</SelectItem>
                <SelectItem value="Partially Received">Partially Received</SelectItem>
                <SelectItem value="Fully Received">Fully Received (Paid in Full)</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status === 'Partially Received' ? (
            <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 animate-in fade-in-50 duration-200">
              <div className="flex justify-between items-center">
                <Label htmlFor="edit-received" className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Partially Received Amount (₹) <span className="text-destructive">*</span>
                </Label>
                {received && !isNaN(parseFloat(received)) && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(received))}
                  </span>
                )}
              </div>
              <Input
                id="edit-received"
                type="number"
                min="1"
                max={promised ? parseFloat(promised) - 1 : undefined}
                step="1"
                placeholder="Enter partial amount received"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                className="bg-background"
                required
              />
            </div>
          ) : status === 'Fully Received' ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 animate-in fade-in-50 duration-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Fully Received (100% Collected)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Promised amount is automatically marked as received in full.
                </p>
              </div>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {promised ? formatINR(parseFloat(promised)) : '₹0'}
              </span>
            </div>
          ) : null}

          {(status === 'Fully Received' || status === 'Partially Received') && (
            <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3 animate-in fade-in-50 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Payment Mode</Label>
                <div className="flex gap-2">
                  {(['UPI', 'Cash'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMoneyType(m)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        moneyType === m
                          ? 'bg-primary text-primary-foreground border-primary font-semibold'
                          : 'bg-card border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {moneyType === 'Cash' && (
                <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3">
                  <div className="space-y-0.5 pr-2">
                    <Label htmlFor="edit-pcom-handed-over" className="text-xs font-semibold text-foreground cursor-pointer">
                      Cash Handed Over to Finance Team?
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Toggle ON if the cash has reached the finance team.
                    </p>
                  </div>
                  <Switch
                    id="edit-pcom-handed-over"
                    checked={isHandedOver}
                    onCheckedChange={(checked) => setIsHandedOver(checked)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="edit-pcom-screenshot" className="text-xs font-medium">
                  Payment Screenshot / Receipt Link (Optional)
                </Label>
                <Input
                  id="edit-pcom-screenshot"
                  type="url"
                  placeholder="https://drive.google.com/... or image link"
                  value={screenshotLink}
                  onChange={(e) => setScreenshotLink(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5 rounded-xl border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20 p-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🙏</span>
              <Label htmlFor="edit-pcom-prayer-request" className="text-xs font-semibold text-foreground">
                Prayer Request / Intention (Optional)
              </Label>
            </div>
            <Textarea
              id="edit-pcom-prayer-request"
              rows={2}
              value={prayerRequest}
              placeholder="e.g. for family health, peace, success in career..."
              onChange={(e) => setPrayerRequest(e.target.value)}
              className="text-xs bg-background"
            />
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
