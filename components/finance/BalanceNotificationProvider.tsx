'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { formatINR } from '@/lib/calculations';

export interface BalanceNotification {
  id: string;
  type: 'income' | 'expense';
  title: string;
  description?: string;
  moneyType: 'Cash' | 'UPI';
  beforeAmount: number;
  deltaAmount: number;
  afterAmount: number;
  durationMs?: number; // default: 5000 (5 seconds)
}

interface BalanceNotificationContextType {
  notifyTransaction: (item: Omit<BalanceNotification, 'id'>) => void;
  dismissNotification: (id: string) => void;
}

const BalanceNotificationContext = createContext<BalanceNotificationContextType | null>(null);

export function useBalanceNotification() {
  const context = useContext(BalanceNotificationContext);
  if (!context) {
    throw new Error('useBalanceNotification must be used within a BalanceNotificationProvider');
  }
  return context;
}

interface ToastItemProps {
  item: BalanceNotification;
  onDismiss: (id: string) => void;
}

function KdeBalanceToastItem({ item, onDismiss }: ToastItemProps) {
  const duration = item.durationMs ?? 5000;
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number>(duration);
  const timeLeftRef = useRef<number>(duration);

  useEffect(() => {
    if (isPaused) {
      pausedRemainingRef.current = timeLeftRef.current;
      return;
    }

    startTimeRef.current = Date.now();
    const initialRemaining = pausedRemainingRef.current;

    const interval = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, initialRemaining - elapsed);
      timeLeftRef.current = remaining;
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss(item.id);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [isPaused, item.id, onDismiss]);

  const progressPct = Math.max(0, Math.min(100, (timeLeft / duration) * 100));

  const isIncome = item.type === 'income';

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="alert"
      aria-live="polite"
      className="group pointer-events-auto relative w-full overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in-0 slide-in-from-top-4 sm:slide-in-from-right-4 select-none hover:shadow-primary/10 hover:border-border"
    >
      {/* Top KDE-style timeout progress bar */}
      <div className="h-1 w-full bg-muted/60">
        <div
          className={`h-full transition-all duration-75 ease-linear ${
            isIncome
              ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600'
              : 'bg-gradient-to-r from-rose-500 via-pink-400 to-rose-600'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-3.5 sm:p-4 space-y-2.5">
        {/* Header with Title and Close Button */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
                isIncome
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                  : 'bg-gradient-to-tr from-rose-600 to-pink-500'
              }`}
            >
              {isIncome ? (
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
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              ) : (
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
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <polyline points="19 12 12 19 5 12" />
                </svg>
              )}
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground tracking-tight">
                  {item.title}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                    isIncome
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {isIncome ? 'Credited' : 'Debited'}
                </span>
              </div>
              {item.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  {item.description}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => onDismiss(item.id)}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Dismiss notification"
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 3-Column Balance Breakdown Grid */}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/40 p-2.5 text-center border border-border/40">
          <div className="space-y-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Before ({item.moneyType})
            </p>
            <p className="text-xs font-semibold text-foreground truncate" title={formatINR(item.beforeAmount)}>
              {formatINR(item.beforeAmount)}
            </p>
          </div>

          <div className="space-y-0.5 border-x border-border/50 px-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {isIncome ? 'Credited' : 'Debited'}
            </p>
            <p
              className={`text-xs font-bold truncate ${
                isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
              title={`${isIncome ? '+' : '-'}${formatINR(item.deltaAmount)}`}
            >
              {isIncome ? '+' : '-'}{formatINR(item.deltaAmount)}
            </p>
          </div>

          <div className="space-y-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              After Balance
            </p>
            <p
              className={`text-xs font-bold truncate ${
                item.afterAmount < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
              title={formatINR(item.afterAmount)}
            >
              {formatINR(item.afterAmount)}
            </p>
          </div>
        </div>

        {/* KDE Hover helper badge */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 px-0.5">
          <span className="flex items-center gap-1 font-mono">
            <span className={`h-1.5 w-1.5 rounded-full ${isPaused ? 'bg-amber-500 animate-pulse' : 'bg-primary'}`} />
            {isPaused ? 'Paused (hovered)' : `${Math.ceil(timeLeft / 1000)}s auto-close`}
          </span>
          <span className="font-medium text-muted-foreground">
            Mode: {item.moneyType}
          </span>
        </div>
      </div>
    </div>
  );
}

export function BalanceNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<BalanceNotification[]>([]);

  const notifyTransaction = useCallback((item: Omit<BalanceNotification, 'id'>) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newNotif: BalanceNotification = { ...item, id };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]); // Keep max 5 visible
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <BalanceNotificationContext.Provider value={{ notifyTransaction, dismissNotification }}>
      {children}
      {/* Top-Right Notification Stack Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] sm:w-80 pointer-events-none">
        {notifications.map((notif) => (
          <KdeBalanceToastItem
            key={notif.id}
            item={notif}
            onDismiss={dismissNotification}
          />
        ))}
      </div>
    </BalanceNotificationContext.Provider>
  );
}
