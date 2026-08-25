'use client';

import { useState, useTransition } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createPrayerRequest } from '@/features/prayer-requests';
import type { PrayerStatus } from '@/lib/types';
import { getTodayDateString } from '@/lib/calculations';

interface AddPrayerRequestDialogProps {
  onSuccess?: () => void;
  trigger?: React.ReactElement;
}

export function AddPrayerRequestDialog({
  onSuccess,
  trigger,
}: AddPrayerRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    person_name: '',
    mobile_number: '',
    prayer_request: '',
    date: getTodayDateString(),
    status: 'Active' as PrayerStatus,
    source: 'Direct',
    notes: '',
  });

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resetForm() {
    setForm({
      person_name: '',
      mobile_number: '',
      prayer_request: '',
      date: getTodayDateString(),
      status: 'Active',
      source: 'Direct',
      notes: '',
    });
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.person_name.trim()) {
      setError('Person name is required.');
      return;
    }
    if (!form.prayer_request.trim()) {
      setError('Prayer request / intention is required.');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await createPrayerRequest({
          person_name: form.person_name.trim(),
          mobile_number: form.mobile_number.trim() || null,
          prayer_request: form.prayer_request.trim(),
          date: form.date,
          status: form.status,
          source: form.source,
          notes: form.notes.trim() || null,
        });

        resetForm();
        setOpen(false);
        onSuccess?.();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save prayer request.';
        setError(msg);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground text-xs shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Prayer Request
            </Button>
          )
        }
      />

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span>🙏</span>
            <span>Record Prayer Request</span>
          </DialogTitle>
          <DialogDescription>
            Record a prayer intention for a supporter, contributor, or seeker.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Person Name & Mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr_name" className="text-xs">
                Person Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pr_name"
                placeholder="e.g. John Doe"
                value={form.person_name}
                onChange={(e) => set('person_name', e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pr_mobile" className="text-xs">
                Mobile Number
              </Label>
              <Input
                id="pr_mobile"
                placeholder="e.g. 9876543210"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Date & Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pr_date" className="text-xs">
                Date
              </Label>
              <Input
                id="pr_date"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pr_source" className="text-xs">
                Source / Channel
              </Label>
              <Select value={form.source} onValueChange={(v) => set('source', v ?? 'Direct')}>
                <SelectTrigger id="pr_source" className="text-xs">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direct">Direct Request</SelectItem>
                  <SelectItem value="Donation">Donation</SelectItem>
                  <SelectItem value="Personal Commitment">Personal Commitment</SelectItem>
                  <SelectItem value="Finance Call">Finance Call</SelectItem>
                  <SelectItem value="Coupon">Coupon</SelectItem>
                  <SelectItem value="Church / Convent">Church / Convent</SelectItem>
                  <SelectItem value="Volunteer">Volunteer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prayer Request Intention Text */}
          <div className="space-y-1.5">
            <Label htmlFor="pr_request" className="text-xs">
              Prayer Request / Intention <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="pr_request"
              placeholder="Enter what they want us to pray for (e.g. for upcoming exams, family peace, good health, healing, job interview)..."
              value={form.prayer_request}
              onChange={(e) => set('prayer_request', e.target.value)}
              rows={3}
              required
              className="text-xs"
            />
          </div>

          {/* Additional Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="pr_notes" className="text-xs">
              Notes / Context (Optional)
            </Label>
            <Input
              id="pr_notes"
              placeholder="Any additional notes or updates..."
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="text-xs bg-primary"
            >
              {isPending ? 'Saving…' : 'Save Prayer Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
