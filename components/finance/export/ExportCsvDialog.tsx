'use client';

import { useState, useMemo, useEffect, useId } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { generateCsvContent, downloadCsv } from '@/lib/export/csv';
import type { ExportCsvDialogProps, ExportField } from './types';
import { cn } from '@/lib/utils';

export function ExportCsvDialog<T>({
  title,
  description,
  defaultFilename,
  data,
  filteredData,
  fields,
  storageKey,
  trigger,
  triggerLabel = 'Export CSV',
  buttonVariant = 'outline',
  buttonSize = 'sm',
  className,
}: ExportCsvDialogProps<T>) {
  const [open, setOpen] = useState(false);
  const searchInputId = useId();
  const filenameInputId = useId();

  // Determine initial selected fields based on defaults or localStorage
  const initialSelectedKeys = useMemo(() => {
    return new Set(
      fields.filter((f) => f.defaultSelected !== false).map((f) => f.key)
    );
  }, [fields]);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(initialSelectedKeys);
  const [fieldSearch, setFieldSearch] = useState('');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [rememberSelection, setRememberSelection] = useState(true);
  const [customFilename, setCustomFilename] = useState(defaultFilename);
  const [showPreview, setShowPreview] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Scope: filtered vs all
  const hasFiltering = Boolean(
    filteredData && filteredData.length !== data.length
  );
  const [exportScope, setExportScope] = useState<'filtered' | 'all'>(
    hasFiltering ? 'filtered' : 'all'
  );

  // Load user preference on dialog open
  useEffect(() => {
    if (!open) return;

    // Reset filename
    setCustomFilename(defaultFilename);
    setDownloadSuccess(false);

    // If filtering active, default to filtered
    if (hasFiltering) {
      setExportScope('filtered');
    } else {
      setExportScope('all');
    }

    // Attempt to load remembered keys
    if (storageKey && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`orah_export_${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validKeySet = new Set(fields.map((f) => f.key));
            const filteredSaved = parsed.filter((k) => validKeySet.has(k));
            if (filteredSaved.length > 0) {
              setSelectedKeys(new Set(filteredSaved));
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load export preferences from localStorage', err);
      }
    }

    // Otherwise use defaults
    setSelectedKeys(
      new Set(fields.filter((f) => f.defaultSelected !== false).map((f) => f.key))
    );
  }, [open, storageKey, fields, defaultFilename, hasFiltering]);

  // Active records to export based on scope
  const targetData = useMemo(() => {
    if (exportScope === 'filtered' && filteredData) {
      return filteredData;
    }
    return data;
  }, [exportScope, filteredData, data]);

  // Filtered fields based on search query
  const displayedFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        (f.group && f.group.toLowerCase().includes(q)) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
  }, [fields, fieldSearch]);

  // Group fields if grouped
  const groupedFields = useMemo(() => {
    const groups: Record<string, ExportField<T>[]> = {};
    for (const field of displayedFields) {
      const g = field.group || 'General Fields';
      if (!groups[g]) groups[g] = [];
      groups[g].push(field);
    }
    return groups;
  }, [displayedFields]);

  // Array of currently selected fields in original order
  const activeExportFields = useMemo(() => {
    return fields.filter((f) => selectedKeys.has(f.key));
  }, [fields, selectedKeys]);

  // Handlers for bulk selection
  const handleSelectAll = () => {
    setSelectedKeys(new Set(fields.map((f) => f.key)));
  };

  const handleDeselectAll = () => {
    setSelectedKeys(new Set());
  };

  const handleResetDefaults = () => {
    setSelectedKeys(
      new Set(fields.filter((f) => f.defaultSelected !== false).map((f) => f.key))
    );
  };

  const handleToggleField = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Download Trigger
  const handleDownload = () => {
    if (activeExportFields.length === 0) return;

    // Persist preferences if requested
    if (rememberSelection && storageKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          `orah_export_${storageKey}`,
          JSON.stringify(Array.from(selectedKeys))
        );
      } catch (err) {
        console.warn('Failed to save export preferences:', err);
      }
    }

    const csvContent = generateCsvContent(
      targetData,
      activeExportFields,
      includeHeaders
    );

    const filename = customFilename.trim() || defaultFilename;
    downloadCsv(filename, csvContent);

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      setOpen(false);
    }, 1200);
  };

  // Preview records (first 3)
  const previewRows = useMemo(() => {
    return targetData.slice(0, 3);
  }, [targetData]);

  const defaultTriggerButton = (
    <Button
      variant={buttonVariant}
      size={buttonSize}
      className={cn(
        'gap-1.5 cursor-pointer font-medium transition-colors',
        className
      )}
      title="Export data to CSV"
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
        className="text-muted-foreground"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
      <span>{triggerLabel}</span>
      {data.length > 0 && (
        <Badge
          variant="secondary"
          className="ml-0.5 px-1.5 py-0 text-[10px] font-mono font-normal opacity-80"
        >
          {hasFiltering && filteredData ? filteredData.length : data.length}
        </Badge>
      )}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger ? (trigger as React.ReactElement) : defaultTriggerButton} />

      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden gap-0 rounded-2xl shadow-2xl border-border/80 bg-card">
        {/* Modal Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M8 13h2" />
                <path d="M8 17h2" />
                <path d="M14 13h2" />
                <path d="M14 17h2" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>{title}</span>
                <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider">
                  CSV Export
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {description || 'Choose the exact fields and records to include in your spreadsheet download.'}
              </DialogDescription>
            </div>
          </div>

          {/* Scope Selector: Filtered vs All (if applicable) */}
          {hasFiltering && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-card border border-border/60 p-1.5 shadow-2xs">
              <span className="text-xs font-medium text-muted-foreground pl-2">
                Data Scope:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExportScope('filtered')}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer',
                    exportScope === 'filtered'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Filtered Only ({filteredData?.length ?? 0} rows)
                </button>
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer',
                    exportScope === 'all'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  All Records ({data.length} rows)
                </button>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
          {/* Field Selection Toolbar */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Export Columns
              </span>
              <Badge
                variant={selectedKeys.size > 0 ? 'default' : 'destructive'}
                className="font-mono text-[11px] px-2 py-0.5"
              >
                {selectedKeys.size} / {fields.length} selected
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleSelectAll}
                className="h-7 px-2 text-[11px] text-primary hover:bg-primary/10 cursor-pointer"
              >
                Select All
              </Button>
              <span className="text-muted-foreground/40">•</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleDeselectAll}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Clear All
              </Button>
              <span className="text-muted-foreground/40">•</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleResetDefaults}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Reset Defaults
              </Button>
            </div>
          </div>

          {/* Search fields input if there are multiple fields */}
          {fields.length > 6 && (
            <div className="relative">
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
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <Input
                id={searchInputId}
                placeholder="Filter column fields..."
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted/20"
              />
              {fieldSearch && (
                <button
                  type="button"
                  onClick={() => setFieldSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Fields Grid grouped */}
          <div className="space-y-3.5">
            {Object.entries(groupedFields).map(([groupName, groupFields]) => (
              <div key={groupName} className="space-y-1.5">
                {Object.keys(groupedFields).length > 1 && (
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-1">
                    {groupName}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groupFields.map((field) => {
                    const isChecked = selectedKeys.has(field.key);
                    return (
                      <div
                        key={field.key}
                        onClick={() => handleToggleField(field.key)}
                        className={cn(
                          'flex items-start gap-2.5 rounded-xl border p-2.5 transition-all cursor-pointer select-none',
                          isChecked
                            ? 'border-primary/40 bg-primary/5 dark:bg-primary/10 shadow-2xs'
                            : 'border-border/60 bg-muted/10 opacity-70 hover:opacity-100 hover:border-border'
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleField(field.key)}
                          className="mt-0.5 pointer-events-none"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={cn(
                                'font-medium leading-tight text-xs',
                                isChecked ? 'text-foreground' : 'text-muted-foreground'
                              )}
                            >
                              {field.label}
                            </span>
                          </div>
                          {field.description && (
                            <p className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-1">
                              {field.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {displayedFields.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
                <p>No fields match &quot;{fieldSearch}&quot;</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setFieldSearch('')}
                  className="mt-1 text-xs"
                >
                  Clear search filter
                </Button>
              </div>
            )}
          </div>

          {/* Custom Options Accordion */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Filename Customizer */}
              <div className="space-y-1">
                <Label htmlFor={filenameInputId} className="text-[11px] font-medium text-muted-foreground">
                  File Name
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={filenameInputId}
                    value={customFilename}
                    onChange={(e) => setCustomFilename(e.target.value)}
                    placeholder={defaultFilename}
                    className="h-8 text-xs bg-card"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col justify-end space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Include column header names
                  </span>
                  <Switch
                    checked={includeHeaders}
                    onCheckedChange={setIncludeHeaders}
                  />
                </div>
                {storageKey && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Remember selection for this page
                    </span>
                    <Switch
                      checked={rememberSelection}
                      onCheckedChange={setRememberSelection}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Live Preview Toggle */}
            <div className="pt-1 border-t border-border/40">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={cn(
                    'transition-transform duration-150',
                    showPreview ? 'rotate-90' : ''
                  )}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span>{showPreview ? 'Hide Live Preview' : 'Show Live Preview (First 3 rows)'}</span>
              </button>

              {showPreview && (
                <div className="mt-2.5 max-h-40 overflow-auto rounded-lg border border-border/60 bg-card text-[11px]">
                  {activeExportFields.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground italic">
                      Select at least 1 column to preview output.
                    </div>
                  ) : previewRows.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground italic">
                      No data rows available to preview.
                    </div>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-border/60 bg-muted/40 text-left">
                          {activeExportFields.map((f) => (
                            <th
                              key={f.key}
                              className="px-2.5 py-1.5 font-semibold text-muted-foreground whitespace-nowrap"
                            >
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="border-b border-border/30 last:border-b-0 hover:bg-muted/10"
                          >
                            {activeExportFields.map((f) => {
                              let cellVal = '';
                              try {
                                cellVal = String(f.accessor(row) ?? '');
                              } catch {
                                cellVal = 'error';
                              }
                              return (
                                <td
                                  key={f.key}
                                  className="px-2.5 py-1.5 whitespace-nowrap max-w-[200px] truncate text-foreground font-mono text-[10px]"
                                >
                                  {cellVal || <span className="opacity-30">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="px-6 py-3 border-t border-border/50 bg-muted/20 flex flex-row items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Ready to export{' '}
            <strong className="text-foreground">{targetData.length}</strong> record
            {targetData.length === 1 ? '' : 's'} with{' '}
            <strong className="text-foreground">{selectedKeys.size}</strong> field
            {selectedKeys.size === 1 ? '' : 's'}.
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="cursor-pointer text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleDownload}
              disabled={selectedKeys.size === 0}
              className={cn(
                'gap-1.5 text-xs font-semibold cursor-pointer transition-all',
                downloadSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {downloadSuccess ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
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
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" x2="12" y1="15" y2="3" />
                  </svg>
                  <span>Download CSV</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
