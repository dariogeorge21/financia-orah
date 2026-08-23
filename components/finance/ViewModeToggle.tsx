'use client';

import { type ViewMode } from '@/hooks/useViewMode';

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ viewMode, onChange, className = '' }: ViewModeToggleProps) {
  return (
    <div
      className={`flex items-center rounded-lg border border-border/50 bg-muted/20 p-1 ${className}`}
      role="group"
      aria-label="View mode toggle"
    >
      <button
        type="button"
        onClick={() => onChange('cards')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-all ${
          viewMode === 'cards'
            ? 'bg-card text-foreground shadow-xs font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Card View"
        aria-pressed={viewMode === 'cards'}
      >
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
        >
          <rect width="7" height="7" x="3" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="3" rx="1" />
          <rect width="7" height="7" x="14" y="14" rx="1" />
          <rect width="7" height="7" x="3" y="14" rx="1" />
        </svg>
        <span className="hidden sm:inline">Cards</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('table')}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-all ${
          viewMode === 'table'
            ? 'bg-card text-foreground shadow-xs font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Table View"
        aria-pressed={viewMode === 'table'}
      >
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
        >
          <line x1="3" x2="21" y1="6" y2="6" />
          <line x1="3" x2="21" y1="12" y2="12" />
          <line x1="3" x2="21" y1="18" y2="18" />
        </svg>
        <span className="hidden sm:inline">Table</span>
      </button>
    </div>
  );
}
