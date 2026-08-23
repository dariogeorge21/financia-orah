'use client';

import { useState, useEffect, useCallback } from 'react';
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

export interface QrCodeItem {
  id: string;
  filename: string;
  src: string;
  name: string;
}

interface QuickQrDialogProps {
  initialQrCodes?: QrCodeItem[];
}

export function QuickQrDialog({ initialQrCodes = [] }: QuickQrDialogProps) {
  const [open, setOpen] = useState(false);
  const [qrCodes, setQrCodes] = useState<QrCodeItem[]>(initialQrCodes);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Keyboard navigation with Left and Right arrow keys
  useEffect(() => {
    if (!open) return;

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
  }, [open, handlePrev, handleNext]);

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
                  className="h-9 gap-1.5 px-2.5 rounded-lg border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs font-semibold"
                  aria-label="Scan UPI QR Code"
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
                  <span className="hidden sm:inline">UPI QR</span>
                </Button>
              }
            />
          }
        >
        </TooltipTrigger>
        <TooltipContent>Show UPI QR codes for quick scanning</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
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
              </div>
              <div>
                <DialogTitle className="text-base font-bold">UPI Payment QR</DialogTitle>
                <DialogDescription className="text-xs">
                  Scan to transfer funds directly via UPI
                </DialogDescription>
              </div>
            </div>

            {qrCodes.length > 1 && (
              <Badge variant="outline" className="font-mono text-xs">
                {currentIndex + 1} / {qrCodes.length}
              </Badge>
            )}
          </div>
        </DialogHeader>

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
          </div>
        ) : (
          <div className="space-y-4 my-1">
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
                  className="absolute left-1 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md border border-border/70 backdrop-blur-sm transition-all hover:scale-105 hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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

              {/* High Contrast White QR Container (guarantees fast scanning on all phone screens) */}
              <div className="flex items-center justify-center rounded-3xl bg-white p-4 shadow-md border border-border/60 w-64 h-64 sm:w-72 sm:h-72 transition-transform duration-200">
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
                  className="absolute right-1 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md border border-border/70 backdrop-blur-sm transition-all hover:scale-105 hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {qrCodes.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentIndex(i)}
                    className={`h-2 rounded-full transition-all ${
                      currentIndex === i
                        ? 'w-6 bg-primary'
                        : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                    aria-label={`Go to QR code ${i + 1}`}
                  />
                ))}
              </div>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              Tip: Use <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] border border-border">←</kbd> and <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] border border-border">→</kbd> arrow keys to switch between QR codes.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-destructive text-center">{error}</p>}

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            {activeQr && (
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
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
