'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState<T extends string = string> {
  field: T | null;
  direction: SortDirection;
}

interface SortableHeaderProps<T extends string = string> {
  field: T;
  currentSort: SortState<T>;
  onSort: (field: T) => void;
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function SortableHeader<T extends string = string>({
  field,
  currentSort,
  onSort,
  children,
  align = 'left',
  className,
}: SortableHeaderProps<T>) {
  const isActive = currentSort.field === field && currentSort.direction !== null;
  const isAsc = isActive && currentSort.direction === 'asc';

  return (
    <th
      className={cn(
        'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground select-none whitespace-nowrap',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'group inline-flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors',
          align === 'right' ? 'flex-row-reverse' : '',
          isActive ? 'text-foreground font-bold' : ''
        )}
      >
        <span>{children}</span>
        <span
          className={cn(
            'inline-flex items-center transition-opacity duration-150',
            isActive ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-60 text-muted-foreground'
          )}
        >
          {isAsc ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </span>
      </button>
    </th>
  );
}

