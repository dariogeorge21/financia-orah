'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface TableSelectionBarProps {
  selectedCount: number;
  totalFilteredCount: number;
  cashTotal?: number;
  upiTotal?: number;
  grandTotal?: number;
  extraTotalLabel?: string;
  extraTotalAmount?: number;
  onSelectAll: () => void;
  onClear: () => void;
  isAllSelected: boolean;
  className?: string;
}

export function TableSelectionBar({
  selectedCount,
  totalFilteredCount,
  cashTotal,
  upiTotal,
  grandTotal,
  extraTotalLabel,
  extraTotalAmount,
  onSelectAll,
  onClear,
  isAllSelected,
  className,
}: TableSelectionBarProps) {
  if (selectedCount === 0) return null;

  const computedGrandTotal = grandTotal ?? ((cashTotal ?? 0) + (upiTotal ?? 0));

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-[95vw] w-auto pointer-events-auto',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-2xl border border-border/80 bg-background/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md dark:bg-slate-900/95 dark:border-slate-800 text-xs ring-1 ring-black/5 dark:ring-white/10">
        {/* Count badge */}
        <div className="flex items-center gap-1.5 font-medium pr-1.5 border-r border-border/60">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {selectedCount}
          </span>
          <span className="text-foreground whitespace-nowrap font-semibold">Selected</span>
        </div>

        {/* Financial Breakdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {cashTotal !== undefined && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300 font-medium border border-teal-500/20">
              <span className="text-[10px] uppercase tracking-wide text-teal-600 dark:text-teal-400 font-semibold">Cash:</span>
              <span className="font-bold tabular-nums">{formatINR(cashTotal)}</span>
            </div>
          )}

          {upiTotal !== undefined && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-500/20">
              <span className="text-[10px] uppercase tracking-wide text-indigo-600 dark:text-indigo-400 font-semibold">UPI:</span>
              <span className="font-bold tabular-nums">{formatINR(upiTotal)}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/40 text-foreground font-bold border border-emerald-500/30">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Total (Cash+UPI):</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold tabular-nums">
              {formatINR(computedGrandTotal)}
            </span>
          </div>

          {extraTotalLabel && extraTotalAmount !== undefined && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium border border-rose-500/20">
              <span className="text-[10px] uppercase tracking-wide text-rose-600 dark:text-rose-400 font-semibold">{extraTotalLabel}:</span>
              <span className="font-bold tabular-nums">{formatINR(extraTotalAmount)}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pl-1.5 border-l border-border/60 ml-auto">
          {!isAllSelected ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={onSelectAll}
              className="text-[11px] h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer font-medium"
            >
              Select all ({totalFilteredCount})
            </Button>
          ) : (
            <span className="text-[10px] text-muted-foreground px-1 font-medium whitespace-nowrap">
              All {totalFilteredCount} selected
            </span>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={onClear}
            className="text-[11px] h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer font-medium"
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

