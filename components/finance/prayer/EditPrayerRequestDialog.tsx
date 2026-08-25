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
import { updatePrayerRequest } from '@/features/prayer-requests';
import type { PrayerRequestRecord, PrayerStatus } from '@/lib/types';

interface EditPrayerRequestDialogProps {
  request: PrayerRequestRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditPrayerRequestDialog({
  request,
  open,
  onOpenChange,
  onSuccess,
}: EditPrayerRequestDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    person_name: '',
    mobile_number: '',
    prayer_request: '',
    date: '',
    status: 'Active' as PrayerStatus,
    notes: '',
  });

  useEffect(() => {
    if (request) {
      setForm({
        person_name: request.person_name || '',
        mobile_number: request.mobile_number || '',
        prayer_request: request.prayer_request || '',
        date: request.date || new Date().toISOString().split('T')[0],
        status: request.status || 'Active',
        notes: request.notes || '',
      });
      setError(null);
    }
  }, [request]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;

    if (!form.person_name.trim()) {
      setError('Person name is required.');
      return;
    }
    if (!form.prayer_request.trim()) {
      setError('Prayer request is required.');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await updatePrayerRequest(request.id, {
          person_name: form.person_name.trim(),
          mobile_number: form.mobile_number.trim() || null,
          prayer_request: form.prayer_request.trim(),
          date: form.date,
          status: form.status,
          notes: form.notes.trim() || null,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update prayer request.';
        setError(msg);
      }
    });
  }

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span>✏️</span>
            <span>Edit Prayer Request</span>
          </DialogTitle>
          <DialogDescription>
            Update prayer request details or mark as answered.
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
              <Label htmlFor="edit_pr_name" className="text-xs">
                Person Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit_pr_name"
                value={form.person_name}
                onChange={(e) => set('person_name', e.target.value)}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit_pr_mobile" className="text-xs">
                Mobile Number
              </Label>
              <Input
                id="edit_pr_mobile"
                value={form.mobile_number}
                onChange={(e) => set('mobile_number', e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit_pr_date" className="text-xs">
                Date
              </Label>
              <Input
                id="edit_pr_date"
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit_pr_status" className="text-xs">
                Status
              </Label>
              <Select
                value={form.status}
                onValueChange={(v) => set('status', (v ?? 'Active') as PrayerStatus)}
              >
                <SelectTrigger id="edit_pr_status" className="text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active (In Prayer)</SelectItem>
                  <SelectItem value="Answered">✓ Answered (Praise God!)</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prayer Request Intention Text */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_pr_request" className="text-xs">
              Prayer Request / Intention <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="edit_pr_request"
              value={form.prayer_request}
              onChange={(e) => set('prayer_request', e.target.value)}
              rows={3}
              required
              className="text-xs"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit_pr_notes" className="text-xs">
              Notes / Testimonial
            </Label>
            <Input
              id="edit_pr_notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Testimonial or progress notes..."
              className="text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
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
              {isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
