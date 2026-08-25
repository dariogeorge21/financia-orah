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
import { updateBudgetCategory } from '@/features/budget';
import type { BudgetRow, BudgetCategory } from '@/lib/types';
import { formatINR } from '@/lib/calculations';

interface EditBudgetDialogProps {
  budget: BudgetRow | BudgetCategory | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditBudgetDialog({
  budget,
  open,
  onOpenChange,
  onSuccess,
}: EditBudgetDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState('');
  const [planned, setPlanned] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (budget) {
      setCategory(budget.category || '');
      setPlanned(String(budget.planned ?? 0));
      setDescription(budget.description || '');
      setError(null);
    }
  }, [budget, open]);

  if (!budget) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!budget?.id) {
      setError('Budget ID is missing.');
      return;
    }

    if (!category.trim()) {
      setError('Category name cannot be empty.');
      return;
    }

    const plannedNum = parseFloat(planned);
    if (isNaN(plannedNum) || plannedNum < 0) {
      setError('Please enter a valid planned amount (>= 0).');
      return;
    }

    startTransition(async () => {
      try {
        await updateBudgetCategory(budget.id!, {
          category: category.trim(),
          planned: plannedNum,
          description: description.trim() || null,
        });

        onOpenChange(false);
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to update budget category');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Budget: {budget.category}</DialogTitle>
          <DialogDescription>
            Update planned allocation or details for this category via API.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-category">Category Name</Label>
            <Input
              id="edit-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="edit-planned">Planned Allocation (₹)</Label>
              {planned && !isNaN(parseFloat(planned)) && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatINR(parseFloat(planned))}
                </span>
              )}
            </div>
            <Input
              id="edit-planned"
              type="number"
              min="0"
              step="100"
              placeholder="0"
              value={planned}
              onChange={(e) => setPlanned(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description / Notes</Label>
            <Textarea
              id="edit-description"
              rows={2}
              value={description}
              placeholder="Notes on this budget..."
              onChange={(e) => setDescription(e.target.value)}
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
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
            >
              {isPending ? 'Updating…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
