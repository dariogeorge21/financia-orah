'use client';

import { useState } from 'react';
import type { DailyFlowRecord } from '@/lib/types';
import { formatINR } from '@/lib/calculations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DailyTransactionsList } from './DailyTransactionsList';

interface DailyCardItemProps {
  record: DailyFlowRecord;
}

export function DailyCardItem({ record }: DailyCardItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalActivityCount = record.incomeCount + record.expenseCount;
  const isNetPositive = record.netTotal >= 0;

  // Calculate visual progress ratio
  const totalVolume = record.incomeTotal + record.expenseTotal;
  const incomePct = totalVolume > 0 ? Math.round((record.incomeTotal / totalVolume) * 100) : 50;
  const expensePct = 100 - incomePct;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:border-border hover:shadow-md">
      {/* Top Banner / Date & Net Balance */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-foreground">{record.displayDate}</h3>
            {record.isToday && (
              <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] py-0 px-2 animate-pulse">
                Today
              </Badge>
            )}
            {record.isYesterday && (
              <Badge variant="secondary" className="text-[10px] py-0 px-2">
                Yesterday
              </Badge>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground">{record.dayOfWeek}</p>
        </div>

        {/* Net Balance Pill */}
        <div
          className={`flex flex-col items-end rounded-xl px-3 py-1.5 ${
            isNetPositive
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
          }`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            Net Daily Flow
          </span>
          <span className="text-sm sm:text-base font-black">
            {isNetPositive ? '+' : ''}
            {formatINR(record.netTotal)}
          </span>
        </div>
      </div>

      {/* Income & Outgoing Side-by-Side Panels */}
      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Income Card */}
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3 transition-colors hover:bg-emerald-500/[0.08]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Income
            </span>
            <span className="text-[10px] text-muted-foreground">
              {record.incomeCount} {record.incomeCount === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="mt-1 text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
            +{formatINR(record.incomeTotal)}
          </div>
          <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground border-t border-emerald-500/15 pt-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                Cash:
              </span>
              <span className="font-semibold text-foreground">{formatINR(record.incomeCash)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
                UPI:
              </span>
              <span className="font-semibold text-foreground">{formatINR(record.incomeUpi)}</span>
            </div>
          </div>
        </div>

        {/* Outgoing Card */}
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.04] p-3 transition-colors hover:bg-rose-500/[0.08]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Outgoing
            </span>
            <span className="text-[10px] text-muted-foreground">
              {record.expenseCount} {record.expenseCount === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <div className="mt-1 text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 truncate">
            -{formatINR(record.expenseTotal)}
          </div>
          <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground border-t border-rose-500/15 pt-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                Cash:
              </span>
              <span className="font-semibold text-foreground">{formatINR(record.expenseCash)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
                UPI:
              </span>
              <span className="font-semibold text-foreground">{formatINR(record.expenseUpi)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Volume Flow Bar */}
      {totalVolume > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">In: {incomePct}%</span>
            <span className="font-medium text-rose-600 dark:text-rose-400">Out: {expensePct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50 flex">
            <div
              style={{ width: `${incomePct}%` }}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
            />
            <div
              style={{ width: `${expensePct}%` }}
              className="bg-gradient-to-r from-rose-500 to-red-500 transition-all duration-500"
            />
          </div>
        </div>
      )}

      {/* Net Split Badges (Cash vs UPI net balance) */}
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Net Cash:</span>
          <span
            className={`font-bold ${
              record.netCash >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {record.netCash >= 0 ? '+' : ''}
            {formatINR(record.netCash)}
          </span>
        </div>
        <div className="h-3 w-px bg-border/60" />
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Net UPI:</span>
          <span
            className={`font-bold ${
              record.netUpi >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {record.netUpi >= 0 ? '+' : ''}
            {formatINR(record.netUpi)}
          </span>
        </div>
      </div>

      {/* Expand / Collapse Button */}
      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between text-xs font-medium text-muted-foreground hover:text-foreground h-8 px-2"
        >
          <span>
            {isExpanded ? 'Hide Transactions' : `View ${totalActivityCount} ${totalActivityCount === 1 ? 'Transaction' : 'Transactions'}`}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </Button>

        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
            <DailyTransactionsList
              incomeRecords={record.incomeRecords}
              expenseRecords={record.expenseRecords}
            />
          </div>
        )}
      </div>
    </div>
  );
}
