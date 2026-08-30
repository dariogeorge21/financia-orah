'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface QrCodeItem {
  id: string;
  filename: string;
  src: string;
  name: string;
}

export const BANK_DETAILS = {
  accountHolder: 'Dario George',
  accountNumber: '44596267004',
  bankName: 'SBI',
  bankFullName: 'State Bank of India (SBI)',
  branch: 'PALAI TOWN',
  ifsc: 'SBIN0008657',
  upiId: '7838403506@sbi',
} as const;

interface QuickQrDialogProps {
  initialQrCodes?: QrCodeItem[];
}

export function QuickQrDialog({ initialQrCodes = [] }: QuickQrDialogProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'bank'>('qr');
  const [qrCodes, setQrCodes] = useState<QrCodeItem[]>(initialQrCodes);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Helper to preload images in browser memory
  const preloadImages = useCallback((items: QrCodeItem[]) => {
    if (typeof window === 'undefined') return;
    items.forEach((item) => {
      const img = new Image();
      img.src = item.src;
    });
  }, []);

  const fetchQrCodes = useCallback(async () => {
    if (qrCodes.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch('/api/qr-codes');
      const json = await res.json();
      if (json.success && Array.isArray(json.qrCodes)) {
        setQrCodes(json.qrCodes);
        preloadImages(json.qrCodes);
        if (currentIndex >= json.qrCodes.length) {
          setCurrentIndex(0);
        }
      }
    } catch {
      setError('Could not load QR codes from public/qr folder.');
    } finally {
      setLoading(false);
    }
  }, [currentIndex, qrCodes.length, preloadImages]);

  // Eager preloading on page load
  useEffect(() => {
    if (initialQrCodes.length > 0) {
      preloadImages(initialQrCodes);
    } else {
      // Background load immediately on page load
      fetchQrCodes();
    }
  }, [initialQrCodes, preloadImages, fetchQrCodes]);

  const handlePrev = useCallback(() => {
    if (qrCodes.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? qrCodes.length - 1 : prev - 1));
  }, [qrCodes.length]);

  const handleNext = useCallback(() => {
    if (qrCodes.length <= 1) return;
    setCurrentIndex((prev) => (prev === qrCodes.length - 1 ? 0 : prev + 1));
  }, [qrCodes.length]);

  // Keyboard navigation with Left and Right arrow keys when on the QR tab
  useEffect(() => {
    if (!open || activeTab !== 'qr') return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeTab, handlePrev, handleNext]);

  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2000);
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopiedKey(key);
        setTimeout(() => {
          setCopiedKey((curr) => (curr === key ? null : curr));
        }, 2000);
      } catch {
        // clipboard copy failed
      }
    }
  }, []);

  const allBankDetailsText = useMemo(() => {
    return [
      `Bank: ${BANK_DETAILS.bankFullName}`,
      `Account Holder: ${BANK_DETAILS.accountHolder}`,
      `Account Number: ${BANK_DETAILS.accountNumber}`,
      `IFSC Code: ${BANK_DETAILS.ifsc}`,
      `Branch: ${BANK_DETAILS.branch}`,
      `UPI ID: ${BANK_DETAILS.upiId}`,
    ].join('\n');
  }, []);

  const activeQr = qrCodes[currentIndex];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  id="header-qr-button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 px-2.5 rounded-lg border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs font-semibold cursor-pointer"
                  aria-label="Scan UPI QR Code or View Bank Details"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary shrink-0"
                  >
                    <rect width="5" height="5" x="3" y="3" rx="1" />
                    <rect width="5" height="5" x="16" y="3" rx="1" />
                    <rect width="5" height="5" x="3" y="16" rx="1" />
                    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                    <path d="M21 21v.01" />
                    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                    <path d="M3 12h.01" />
                    <path d="M12 3h.01" />
                    <path d="M12 16v.01" />
                    <path d="M16 12h1" />
                    <path d="M21 12v.01" />
                    <path d="M12 21v-1" />
                  </svg>
                  <span className="hidden sm:inline">UPI / Bank</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent>Show UPI QR codes & bank transfer details</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {activeTab === 'qr' ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="5" height="5" x="3" y="3" rx="1" />
                    <rect width="5" height="5" x="16" y="3" rx="1" />
                    <rect width="5" height="5" x="3" y="16" rx="1" />
                    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
                    <path d="M21 21v.01" />
                    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
                    <path d="M3 12h.01" />
                    <path d="M12 3h.01" />
                    <path d="M12 16v.01" />
                    <path d="M16 12h1" />
                    <path d="M21 12v.01" />
                    <path d="M12 21v-1" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="3" y1="21" x2="21" y2="21" />
                    <line x1="6" y1="18" x2="6" y2="11" />
                    <line x1="10" y1="18" x2="10" y2="11" />
                    <line x1="14" y1="18" x2="14" y2="11" />
                    <line x1="18" y1="18" x2="18" y2="11" />
                    <polygon points="12 2 20 7 4 7" />
                  </svg>
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {activeTab === 'qr' ? 'UPI Payment QR' : 'Bank Account Details'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {activeTab === 'qr'
                    ? 'Scan to transfer funds directly via UPI'
                    : 'Direct transfer via NEFT, RTGS, IMPS, or UPI'}
                </DialogDescription>
              </div>
            </div>

            {activeTab === 'qr' && qrCodes.length > 1 && (
              <Badge variant="outline" className="font-mono text-xs">
                {currentIndex + 1} / {qrCodes.length}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl border border-border/50 text-xs font-semibold my-1">
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all text-xs font-semibold cursor-pointer select-none',
              activeTab === 'qr'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
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
              <rect width="5" height="5" x="3" y="3" rx="1" />
              <rect width="5" height="5" x="16" y="3" rx="1" />
              <rect width="5" height="5" x="3" y="16" rx="1" />
              <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
              <path d="M21 21v.01" />
              <path d="M12 7v3a2 2 0 0 1-2 2H7" />
            </svg>
            <span>UPI QR</span>
            {qrCodes.length > 0 && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 text-[10px] h-4 leading-none font-mono"
              >
                {qrCodes.length}
              </Badge>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg transition-all text-xs font-semibold cursor-pointer select-none',
              activeTab === 'bank'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
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
              <line x1="3" y1="21" x2="21" y2="21" />
              <line x1="6" y1="18" x2="6" y2="11" />
              <line x1="10" y1="18" x2="10" y2="11" />
              <line x1="14" y1="18" x2="14" y2="11" />
              <line x1="18" y1="18" x2="18" y2="11" />
              <polygon points="12 2 20 7 4 7" />
            </svg>
            <span>Bank Account</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </button>
        </div>

        {/* TAB 1: UPI QR CODE */}
        {activeTab === 'qr' && (
          <>
            {loading && qrCodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-xs text-muted-foreground">Loading QR codes…</p>
              </div>
            ) : qrCodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 p-6 text-center space-y-3 my-2 bg-muted/20">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">No QR codes found yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    Add your UPI QR code image files (e.g.{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                      public/qr/gpay.png
                    </code>
                    ) and they will instantly appear here.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button size="xs" variant="outline" onClick={fetchQrCodes} className="gap-1 text-xs">
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
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 21h5v-5" />
                    </svg>
                    Refresh
                  </Button>
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => setActiveTab('bank')}
                    className="gap-1 text-xs"
                  >
                    View Bank Account Details
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 my-1">
                {/* Title / Name of Active QR */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-foreground">
                    {activeQr.name}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {activeQr.filename}
                  </span>
                </div>

                {/* QR Card with Navigation Arrows */}
                <div className="relative flex items-center justify-center">
                  {/* Left Arrow */}
                  {qrCodes.length > 1 && (
                    <button
                      type="button"
                      onClick={handlePrev}
                      className="absolute left-1 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md border border-border/70 backdrop-blur-sm transition-all hover:scale-105 hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                      aria-label="Previous QR Code"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>
                  )}

                  {/* High Contrast White QR Container */}
                  <div className="flex items-center justify-center rounded-3xl bg-white p-4 shadow-md border border-border/60 w-60 h-60 sm:w-68 sm:h-68 transition-transform duration-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeQr.src}
                      alt={activeQr.name}
                      className="h-full w-full object-contain rounded-xl select-none"
                      draggable={false}
                      loading="eager"
                    />
                  </div>

                  {/* Right Arrow */}
                  {qrCodes.length > 1 && (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="absolute right-1 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md border border-border/70 backdrop-blur-sm transition-all hover:scale-105 hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                      aria-label="Next QR Code"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Pagination Dots */}
                {qrCodes.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5">
                    {qrCodes.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentIndex(i)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          currentIndex === i
                            ? 'w-6 bg-primary'
                            : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                        }`}
                        aria-label={`Go to QR code ${i + 1}`}
                      />
                    ))}
                  </div>
                )}

                {/* Quick Copy UPI ID Bar */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-muted/40 border border-border/70">
                  <div className="flex items-center gap-2 min-w-0 pl-1">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v12M8 10h8" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1.5">UPI ID:</span>
                      <span className="text-xs font-mono font-bold text-foreground select-all">
                        {BANK_DETAILS.upiId}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handleCopy(BANK_DETAILS.upiId, 'upi-qr-bar')}
                    className="h-6 px-2 text-[11px] gap-1 shrink-0 font-medium bg-background hover:bg-muted/80 cursor-pointer"
                  >
                    {copiedKey === 'upi-qr-bar' ? (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-emerald-600 dark:text-emerald-400"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="11"
                          height="11"
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

                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  <span>Tip: Arrow keys to switch QR</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('bank')}
                    className="font-medium text-primary hover:underline cursor-pointer"
                  >
                    View Bank Details →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: BANK DETAILS */}
        {activeTab === 'bank' && (
          <div className="space-y-3.5 my-1">
            {/* Visual Bank Card */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-muted/40 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-primary tracking-wide">
                      {BANK_DETAILS.bankFullName}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Branch: {BANK_DETAILS.branch}
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Verified Beneficiary
                </div>
              </div>

              {/* Account Number Focus Area */}
              <div className="mt-3.5 space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">
                  Account Number
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xl font-bold tracking-wider text-foreground select-all">
                    {BANK_DETAILS.accountNumber}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handleCopy(BANK_DETAILS.accountNumber, 'hero-acc')}
                    className="h-7 px-2.5 gap-1 text-xs bg-background/90 hover:bg-background border-border/80 shadow-xs cursor-pointer"
                    aria-label="Copy Account Number"
                  >
                    {copiedKey === 'hero-acc' ? (
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
                          className="text-emerald-600 dark:text-emerald-400"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold">Copied</span>
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
                        <span className="text-[11px]">Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Card Bottom: Holder & IFSC */}
              <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                    Account Holder
                  </span>
                  <span className="font-semibold text-foreground">
                    {BANK_DETAILS.accountHolder}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                    IFSC Code
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {BANK_DETAILS.ifsc}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Key-Value Grid */}
            <div className="grid grid-cols-1 gap-2">
              {/* Account Holder */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/35 hover:bg-muted/60 border border-border/50 transition-colors">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                    Account Holder
                  </p>
                  <p className="text-xs font-semibold text-foreground truncate select-all">
                    {BANK_DETAILS.accountHolder}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleCopy(BANK_DETAILS.accountHolder, 'acc-holder')}
                  className="h-6 px-2 text-xs gap-1 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Copy Account Holder Name"
                >
                  {copiedKey === 'acc-holder' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">Copied</span>
                  ) : (
                    <span className="text-[11px]">Copy</span>
                  )}
                </Button>
              </div>

              {/* IFSC Code */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/35 hover:bg-muted/60 border border-border/50 transition-colors">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                    IFSC Code
                  </p>
                  <p className="text-xs font-mono font-bold text-foreground tracking-wider truncate select-all">
                    {BANK_DETAILS.ifsc}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleCopy(BANK_DETAILS.ifsc, 'ifsc')}
                  className="h-6 px-2 text-xs gap-1 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Copy IFSC Code"
                >
                  {copiedKey === 'ifsc' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">Copied</span>
                  ) : (
                    <span className="text-[11px]">Copy</span>
                  )}
                </Button>
              </div>

              {/* UPI ID */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/35 hover:bg-muted/60 border border-border/50 transition-colors">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                    UPI ID
                  </p>
                  <p className="text-xs font-mono font-bold text-foreground tracking-wide truncate select-all">
                    {BANK_DETAILS.upiId}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleCopy(BANK_DETAILS.upiId, 'upi-detail')}
                  className="h-6 px-2 text-xs gap-1 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Copy UPI ID"
                >
                  {copiedKey === 'upi-detail' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">Copied</span>
                  ) : (
                    <span className="text-[11px]">Copy</span>
                  )}
                </Button>
              </div>

              {/* Bank Name & Branch */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/35 border border-border/50">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                    Bank & Branch
                  </p>
                  <p className="text-xs font-medium text-foreground truncate">
                    {BANK_DETAILS.bankName} · {BANK_DETAILS.branch}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => handleCopy(`${BANK_DETAILS.bankFullName}, Branch: ${BANK_DETAILS.branch}`, 'branch-detail')}
                  className="h-6 px-2 text-xs gap-1 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Copy Bank and Branch"
                >
                  {copiedKey === 'branch-detail' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">Copied</span>
                  ) : (
                    <span className="text-[11px]">Copy</span>
                  )}
                </Button>
              </div>
            </div>

            {/* Copy All Details Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleCopy(allBankDetailsText, 'copy-all')}
              className="w-full h-9 gap-2 border-primary/40 hover:border-primary hover:bg-primary/5 text-xs font-semibold shadow-2xs cursor-pointer transition-all"
            >
              {copiedKey === 'copy-all' ? (
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
                    className="text-emerald-600 dark:text-emerald-400"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span className="text-emerald-600 dark:text-emerald-400">All Details Copied to Clipboard!</span>
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
                    className="text-primary"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <span>Copy All Bank Details (for WhatsApp / SMS)</span>
                </>
              )}
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-destructive text-center">{error}</p>}

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            {activeTab === 'qr' && activeQr && (
              <a
                href={activeQr.src}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
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
                >
                  <path d="M15 3h6v6" />
                  <path d="M10 14 21 3" />
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                </svg>
                Open Fullscreen
              </a>
            )}

            {activeTab === 'bank' && (
              <span className="text-[11px] text-muted-foreground">
                State Bank of India · Palai Town
              </span>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-xs cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

