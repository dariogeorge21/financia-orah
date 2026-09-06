// lib/export/csv.ts
// Robust RFC 4180-compliant CSV serializer & client-side download utility

import type { ExportField } from '@/components/finance/export/types';

/**
 * Escapes a single cell value for CSV output following RFC 4180 standards.
 */
export function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }

  const str = String(val);

  // If the cell contains quotes, commas, or line breaks, enclose in quotes and double internal quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates an RFC 4180 CSV string with UTF-8 BOM from a dataset and selected field accessors.
 */
export function generateCsvContent<T>(
  data: T[],
  fields: ExportField<T>[],
  includeHeaders = true
): string {
  if (fields.length === 0) {
    return '';
  }

  const lines: string[] = [];

  // Header row
  if (includeHeaders) {
    const headerRow = fields.map((f) => escapeCsvValue(f.label)).join(',');
    lines.push(headerRow);
  }

  // Data rows
  for (const item of data) {
    const row = fields.map((f) => {
      try {
        const raw = f.accessor(item);
        return escapeCsvValue(raw);
      } catch (err) {
        console.error(`Error accessing field ${f.key}:`, err);
        return '';
      }
    });
    lines.push(row.join(','));
  }

  // Prepend UTF-8 BOM (\uFEFF) for Excel compatibility
  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Triggers a browser download of the CSV content.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeFilename);
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 200);
}
