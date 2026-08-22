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
import { createBudgetCategory } from '@/features/budget';
import { formatINR } from '@/lib/calculations';

const DEFAULT_CATEGORIES = [
  'Food',
  'Venue',
  'Transport',
  'Accommodation',
  'Printing',
  'Decoration',
  'Equipment',
  'Media',
  'Marketing',
  'Stationery',
  'Security',
  'Medical',
  'Miscellaneous',
  'Custom',
];

interface AddBudgetDialogProps {
  onSuccess?: () => void;
  existingCategories?: string[];
  trigger?: React.ReactElement;
}

export function AddBudgetDialog({
  onSuccess,
  existingCategories = [],
  trigger,
}: AddBudgetDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [categoryType, setCategoryType] = useState('Food');
  const [customCategory, setCustomCategory] = useState('');
  const [planned, setPlanned] = useState('');
  const [description, setDescription] = useState('');

  const finalCategoryName =
    categoryType === 'Custom' ? customCategory.trim() : categoryType;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!finalCategoryName) {
      setError('Please provide a category name.');
      return;
    }

    const plannedNum = parseFloat(planned);
    if (isNaN(plannedNum) || plannedNum < 0) {
      setError('Please enter a valid planned amount (>= 0).');
      return;
    }

    startTransition(async () => {
      try {
        await createBudgetCategory({
          category: finalCategoryName,
          planned: plannedNum,
          description: description.trim() || undefined,
        });

        setOpen(false);
        setCategoryType('Food');
        setCustomCategory('');
        setPlanned('');
        setDescription('');
        onSuccess?.();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to add budget category');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button
              id="add-budget-btn"
              className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Add Budget Category
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Budget Category</DialogTitle>
          <DialogDescription>
            Allocate planned funds for an event category. This is processed via server API routes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="category-select">Category</Label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 rounded-lg border border-border/50 bg-muted/20">
              {DEFAULT_CATEGORIES.map((cat) => {
                const isAlreadyAdded =
                  cat !== 'Custom' &&
                  existingCategories.some((c) => c.toLowerCase() === cat.toLowerCase());

                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={isAlreadyAdded}
                    onClick={() => setCategoryType(cat)}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                      categoryType === cat
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : isAlreadyAdded
                        ? 'bg-muted/40 text-muted-foreground/50 cursor-not-allowed line-through'
                        : 'bg-card border border-border/60 hover:bg-muted text-foreground'
                    }`}
                  >
                    {cat} {isAlreadyAdded ? '(Added)' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {categoryType === 'Custom' && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-200">
              <Label htmlFor="custom-category">Custom Category Name</Label>
              <Input
                id="custom-category"
                placeholder="e.g. Guest Hospitality, Merch..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="planned-amount">Planned Budget Allocation (₹)</Label>
              {planned && !isNaN(parseFloat(planned)) && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatINR(parseFloat(planned))}
                </span>
              )}
            </div>
            <Input
              id="planned-amount"
              type="number"
              min="0"
              step="100"
              placeholder="e.g. 25000"
              value={planned}
              onChange={(e) => setPlanned(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="budget-description">Description / Notes (Optional)</Label>
            <Textarea
              id="budget-description"
              placeholder="What this budget allocation is intended for..."
              rows={2}
              value={description}
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
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
            >
              {isPending ? 'Saving to Server…' : 'Add Category'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
