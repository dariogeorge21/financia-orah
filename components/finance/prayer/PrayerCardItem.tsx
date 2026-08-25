'use client';

import { useState } from 'react';
import type { PrayerRequestRecord } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/calculations';

interface PrayerCardItemProps {
  request: PrayerRequestRecord;
  onEdit?: (request: PrayerRequestRecord) => void;
  onDelete?: (request: PrayerRequestRecord) => void;
  onStatusChange?: (request: PrayerRequestRecord, newStatus: 'Active' | 'Answered' | 'Archived') => void;
}

export function PrayerCardItem({
  request,
  onEdit,
  onDelete,
  onStatusChange,
}: PrayerCardItemProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const phone = request.mobile_number ? ` (📱 ${request.mobile_number})` : '';
    const source = request.source ? ` [${request.source}]` : '';
    const text = `${request.person_name}${phone}${source}\n• Intention: ${request.prayer_request}${request.notes ? `\n• Note: ${request.notes}` : ''}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const isAnswered = request.status === 'Answered';
  const isArchived = request.status === 'Archived';

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 sm:p-5 shadow-xs transition-all duration-200 hover:shadow-md ${
        isAnswered
          ? 'border-emerald-500/30 bg-emerald-500/[0.03] hover:border-emerald-500/50'
          : isArchived
          ? 'border-border/40 bg-muted/20 opacity-75'
          : 'border-border/60 bg-card hover:border-primary/40'
      }`}
    >
      <div>
        {/* Header: Person Name, Source & Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-base font-bold text-foreground truncate">{request.person_name}</h4>
              {request.source && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                  {request.source}
                </Badge>
              )}
              {isAnswered && (
                <Badge className="bg-emerald-500 text-white text-[10px] py-0 px-1.5">
                  ✓ Answered
                </Badge>
              )}
              {request.amount !== undefined && request.amount !== null && request.amount > 0 && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatINR(request.amount)}
                </span>
              )}
            </div>

            {/* Phone Number */}
            {request.mobile_number ? (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
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
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <a
                    href={`tel:${request.mobile_number}`}
                    className="hover:text-primary hover:underline font-mono text-[11px]"
                  >
                    {request.mobile_number}
                  </a>
                </span>
                <span>·</span>
                <a
                  href={`https://wa.me/${request.mobile_number.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  WhatsApp ↗
                </a>
              </div>
            ) : (
              <p className="mt-0.5 text-[11px] text-muted-foreground/70 italic">No phone number</p>
            )}
          </div>

          {/* Quick Copy Button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className={`h-7 px-2 text-[11px] gap-1 transition-all ${
              copied
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Copy prayer request"
          >
            {copied ? (
              <>
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
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Copied</span>
              </>
            ) : (
              <>
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
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>

        {/* Prayer Intention Body */}
        <div className="mt-3 rounded-xl border border-primary/10 bg-primary/[0.02] p-3 text-xs text-foreground leading-relaxed">
          <p className="font-medium whitespace-pre-wrap">{request.prayer_request}</p>
          {request.notes && (
            <p className="mt-2 text-[11px] italic text-muted-foreground border-t border-border/40 pt-1.5">
              Note: {request.notes}
            </p>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-xs">
        <div className="flex items-center gap-1">
          {onStatusChange && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                onStatusChange(request, isAnswered ? 'Active' : 'Answered')
              }
              className={`h-6 px-2 text-[11px] font-medium ${
                isAnswered
                  ? 'text-emerald-600 hover:bg-emerald-500/10'
                  : 'text-muted-foreground hover:text-emerald-600'
              }`}
            >
              {isAnswered ? 'Mark Active' : 'Mark Answered'}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onEdit(request)}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onDelete(request)}
              className="h-6 px-2 text-[11px] text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
