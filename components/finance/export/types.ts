// components/finance/export/types.ts
// Type definitions for configurable CSV export dialog

import type { ReactNode } from 'react';

export interface ExportField<T> {
  key: string;
  label: string;
  group?: string;
  defaultSelected?: boolean;
  description?: string;
  accessor: (item: T) => string | number | boolean | null | undefined;
}

export interface ExportCsvDialogProps<T> {
  title: string;
  description?: string;
  defaultFilename: string;
  data: T[];
  filteredData?: T[];
  fields: ExportField<T>[];
  storageKey?: string;
  trigger?: ReactNode;
  triggerLabel?: string;
  buttonVariant?: 'outline' | 'default' | 'ghost' | 'secondary';
  buttonSize?: 'sm' | 'default' | 'xs';
  className?: string;
}
