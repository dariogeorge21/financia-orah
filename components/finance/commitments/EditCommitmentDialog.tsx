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
  const [dueDate, setDueDate] = useState('');
  const [moneyType, setMoneyType] = useState<'Cash' | 'UPI'>('UPI');
  const [isHandedOver, setIsHandedOver] = useState(true);
  const [screenshotLink, setScreenshotLink] = useState('');
  const [status, setStatus] = useState<CommitmentStatus>('Pending');
  const [notes, setNotes] = useState('');
  const [prayerRequest, setPrayerRequest] = useState('');

  function getFutureDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(dateStr: string): string {
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      if (!y || !m || !d) return dateStr;
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  useEffect(() => {
    if (commitment) {
      setPersonName(commitment.person_name || '');
      setMobileNumber(commitment.mobile_number || '');
      setCallerName(commitment.caller_name || '');
      const promisedVal = String(commitment.promised ?? 0);
      setPromised(promisedVal);
      const currentStatus = commitment.status || 'Pending';
      setStatus(currentStatus);
      setReceived(String(commitment.received ?? (currentStatus === 'Fully Received' ? promisedVal : 0)));
      setDueDate(commitment.due_date ? String(commitment.due_date).split('T')[0] : '');
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
      if (!received || parseFloat(received) < parseFloat(promised)) {
        setReceived(promised);
      }
    } else if (newStatus === 'Pending' || newStatus === 'Cancelled') {
      setReceived('0');
    } else if (newStatus === 'Partially Received') {
      if (!received || parseFloat(received) === 0) {
        setReceived(commitment?.received ? String(commitment.received) : '');
      }
    }
  }

  // When promised amount changes, if Fully Received and not overpaid, keep received synced
  function handlePromisedChange(val: string) {
    setPromised(val);
    if (status === 'Fully Received' && (!received || parseFloat(received) <= parseFloat(val))) {
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
    let finalStatus: CommitmentStatus = status;

    if (status === 'Fully Received') {
      finalReceived = received ? parseFloat(received) : promisedNum;
      if (isNaN(finalReceived) || finalReceived < 0) {
        finalReceived = promisedNum;
      }
      finalStatus = 'Fully Received';
    } else if (status === 'Partially Received') {
      finalReceived = received ? parseFloat(received) : 0;
      if (isNaN(finalReceived) || finalReceived <= 0) {
        setError('Please enter a valid received amount greater than 0.');
        return;
      }
      if (finalReceived >= promisedNum) {
        finalStatus = 'Fully Received';
      } else {
        finalStatus = 'Partially Received';
      }
    } else {
      finalReceived = 0;
      finalStatus = status;
    }

    startTransition(async () => {
      try {
        await updateCommitment(commitment.id, {
          person_name: personName.trim(),
          mobile_number: mobileNumber.trim() || null,
          caller_name: callerName.trim() || null,
          promised: promisedNum,
          received: finalReceived,
          due_date: dueDate.trim() || null,
          money_type: finalReceived > 0 ? moneyType : undefined,
          is_handed_over: finalReceived > 0 && moneyType === 'Cash' ? isHandedOver : true,
          screenshot_link: screenshotLink.trim() || null,
          status: finalStatus,
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
            Update donor details, committed amount, target follow-up date, and payment progress for {commitment.id}.
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

          {/* Time Period / Promised By Date with Quick Date Setters */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-due-date" className="text-xs font-medium text-foreground">
                Promised By / Follow-up Date
              </Label>
              {dueDate && (
                <span className="text-[11px] font-semibold text-primary">
                  {formatDisplayDate(dueDate)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="text-xs h-8 bg-background"
              />
              {dueDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => setDueDate('')}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive shrink-0 cursor-pointer"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Quick date setters */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-muted-foreground font-medium mr-1">Quick Set:</span>
              {[
                { label: '+3 Days', days: 3 },
                { label: '+1 Week', days: 7 },
                { label: '+2 Weeks', days: 14 },
                { label: '+1 Month', days: 30 },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDueDate(getFutureDate(q.days))}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-border/70 bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                >
                  {q.label}
                </button>
              ))}
            </div>
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
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 animate-in fade-in-50 duration-200">
              <div className="flex justify-between items-center">
                <Label htmlFor="edit-received" className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Received Amount (₹) <span className="text-destructive">*</span>
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
                step="1"
                placeholder="Enter amount received"
                value={received}
                onChange={(e) => setReceived(e.target.value)}
                className="bg-background"
                required
              />

              {/* Overpayment banner */}
              {promised && received && parseFloat(received) > parseFloat(promised) && (
                <div className="rounded-lg bg-emerald-100/70 dark:bg-emerald-950/60 p-2.5 text-xs space-y-1.5 border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                      <span>🎉</span> Overpayment: +{formatINR(parseFloat(received) - parseFloat(promised))} Surplus!
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      {Math.round((parseFloat(received) / parseFloat(promised)) * 100)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                    Received exceeds promised. Status will be marked as Fully Received.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPromised(received)}
                    className="text-xs font-semibold px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Adjust Promised Amount to {formatINR(parseFloat(received))}
                  </button>
                </div>
              )}
            </div>
          ) : status === 'Fully Received' ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Fully Received
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Actual collected amount (can be higher if donor overpaid)
                  </p>
                </div>
                {received && !isNaN(parseFloat(received)) && (
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatINR(parseFloat(received))}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="edit-received-full"
                  type="number"
                  min="1"
                  step="1"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                  placeholder={promised}
                  className="bg-background h-8 text-xs"
                />
                {received && parseFloat(received) !== parseFloat(promised) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setReceived(promised)}
                    className="text-[11px] h-8 px-2 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  >
                    Reset to {formatINR(parseFloat(promised))}
                  </Button>
                )}
              </div>

              {/* Overpayment banner */}
              {promised && received && parseFloat(received) > parseFloat(promised) && (
                <div className="rounded-lg bg-emerald-100/70 dark:bg-emerald-950/60 p-2.5 text-xs space-y-1.5 border border-emerald-500/30">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                      <span>🎉</span> Overpayment: +{formatINR(parseFloat(received) - parseFloat(promised))} Surplus!
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                      {Math.round((parseFloat(received) / parseFloat(promised)) * 100)}%
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPromised(received)}
                    className="text-xs font-semibold px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    Adjust Promised Amount to {formatINR(parseFloat(received))}
                  </button>
                </div>
              )}
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
