'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type DateFlagType = 'today' | 'yesterday' | 'recent' | 'future' | 'overdue' | 'due_today' | 'upcoming';

export interface DateFlagInfo {
  type: DateFlagType;
  label: string;
  diffDays: number;
}

export function parseDateNormalized(input?: string | Date | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  const str = String(input).trim();
  // Handle YYYY-MM-DD
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10) - 1;
    const d = parseInt(ymdMatch[3], 10);
    return new Date(y, m, d);
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function getDateFlag(
  input?: string | Date | null,
  options?: { mode?: 'standard' | 'due'; isCompleted?: boolean }
): DateFlagInfo | null {
  const d = parseDateNormalized(input);
  if (!d) return null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const diffMs = todayStart - dateStart;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (options?.mode === 'due') {
    if (options.isCompleted) return null;
    if (diffDays > 0) {
      return { type: 'overdue', label: diffDays === 1 ? '1d Overdue' : `${diffDays}d Overdue`, diffDays };
    }
    if (diffDays === 0) {
      return { type: 'due_today', label: 'Due Today', diffDays: 0 };
    }
    const futureDays = Math.abs(diffDays);
    return { type: 'upcoming', label: futureDays === 1 ? 'Due Tomorrow' : `Due in ${futureDays}d`, diffDays };
  }

  // Standard transaction date mode
  if (diffDays === 0) {
    return { type: 'today', label: 'Today', diffDays: 0 };
  }
  if (diffDays === 1) {
    return { type: 'yesterday', label: 'Yesterday', diffDays: 1 };
  }
  if (diffDays > 1 && diffDays <= 7) {
    return { type: 'recent', label: `${diffDays}d ago`, diffDays };
  }
  if (diffDays < 0) {
    const futureDays = Math.abs(diffDays);
    return { type: 'future', label: futureDays === 1 ? 'Tomorrow' : `In ${futureDays}d`, diffDays };
  }

  return null;
}

interface DateFlagBadgeProps {
  date?: string | Date | null;
  mode?: 'standard' | 'due';
  isCompleted?: boolean;
  className?: string;
  showDot?: boolean;
}

export function DateFlagBadge({
  date,
  mode = 'standard',
  isCompleted = false,
  className,
  showDot = true,
}: DateFlagBadgeProps) {
  const flag = getDateFlag(date, { mode, isCompleted });
  if (!flag) return null;

  let colorClasses = '';
  let dotColor = '';

  switch (flag.type) {
    case 'today':
      colorClasses = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      dotColor = 'bg-emerald-500';
      break;
    case 'yesterday':
      colorClasses = 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25';
      dotColor = 'bg-amber-500';
      break;
    case 'recent':
      colorClasses = 'bg-muted/80 text-muted-foreground border-border/50';
      dotColor = 'bg-muted-foreground/60';
      break;
    case 'overdue':
      colorClasses = 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-semibold';
      dotColor = 'bg-rose-500 animate-pulse';
      break;
    case 'due_today':
      colorClasses = 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/35 font-semibold';
      dotColor = 'bg-amber-500 animate-pulse';
      break;
    case 'upcoming':
    case 'future':
      colorClasses = 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25';
      dotColor = 'bg-blue-500';
      break;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none border transition-colors shrink-0',
        colorClasses,
        className
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotColor)} />}
      <span>{flag.label}</span>
    </span>
  );
}
