'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatINR } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface HistoryItem {
  id: string;
  expression: string;
  result: number;
  timestamp: string;
}

/**
 * Safe expression evaluator for basic math operations (+, -, *, /).
 * Respects standard operator precedence (* and / before + and -).
 */
function evaluateExpression(expr: string): number {
  const sanitized = expr.replace(/×/g, '*').replace(/÷/g, '/');
  // Tokenize numbers and operators
  const tokens: (number | string)[] = [];
  let currentNum = '';

  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i];
    if (/[0-9.]/.test(char)) {
      currentNum += char;
    } else if (['+', '-', '*', '/'].includes(char)) {
      if (currentNum !== '') {
        tokens.push(parseFloat(currentNum));
        currentNum = '';
      } else if (char === '-' && (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string')) {
        // Negative number
        currentNum = '-';
        continue;
      }
      tokens.push(char);
    }
  }
  if (currentNum !== '' && currentNum !== '-') {
    tokens.push(parseFloat(currentNum));
  }

  if (tokens.length === 0) return 0;
  if (tokens.length === 1 && typeof tokens[0] === 'number') return tokens[0];

  // First pass: handle * and /
  const intermediate: (number | string)[] = [];
  let idx = 0;
  while (idx < tokens.length) {
    const token = tokens[idx];
    if (token === '*' || token === '/') {
      const prev = intermediate.pop() as number;
      const next = tokens[idx + 1] as number;
      if (typeof prev !== 'number' || typeof next !== 'number') {
        throw new Error('Invalid expression');
      }
      if (token === '/' && next === 0) {
        throw new Error('Divide by zero');
      }
      const res = token === '*' ? prev * next : prev / next;
      intermediate.push(res);
      idx += 2;
    } else {
      intermediate.push(token);
      idx++;
    }
  }

  // Second pass: handle + and -
  let result = typeof intermediate[0] === 'number' ? intermediate[0] : 0;
  idx = 1;
  while (idx < intermediate.length) {
    const op = intermediate[idx];
    const next = intermediate[idx + 1] as number;
    if (typeof next !== 'number') break;
    if (op === '+') {
      result += next;
    } else if (op === '-') {
      result -= next;
    }
    idx += 2;
  }

  return Number.isFinite(result) ? Math.round(result * 100) / 100 : 0;
}

export function HeaderCalculator() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justCalculated, setJustCalculated] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('orah_calculator_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.display) setDisplay(parsed.display);
        if (parsed.expression) setExpression(parsed.expression);
        if (Array.isArray(parsed.history)) setHistory(parsed.history);
      }
    } catch {
      // Ignore sessionStorage parsing errors
    }
  }, []);

  // Save state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        'orah_calculator_state',
        JSON.stringify({ display, expression, history })
      );
    } catch {
      // Ignore
    }
  }, [display, expression, history]);

  // Handle number input
  const handleDigit = useCallback((digit: string) => {
    if (justCalculated) {
      setDisplay(digit);
      setExpression('');
      setJustCalculated(false);
      return;
    }
    setDisplay((prev) => {
      if (prev === '0' && digit !== '.') return digit;
      if (digit === '.' && prev.includes('.')) return prev;
      if (prev.length >= 12) return prev; // Limit max digits
      return prev + digit;
    });
  }, [justCalculated]);

  // Handle operator (+, -, ×, ÷)
  const handleOperator = useCallback((op: string) => {
    setJustCalculated(false);
    const displayOp = op === '*' ? '×' : op === '/' ? '÷' : op;

    setExpression((prevExpr) => {
      // If we already have a previous expression, append current display and new operator
      if (prevExpr === '') {
        return `${display} ${displayOp} `;
      }
      // If user presses operator right after another operator
      if (prevExpr.endsWith(' ') && display === '0') {
        return prevExpr.slice(0, -3) + ` ${displayOp} `;
      }
      return `${prevExpr}${display} ${displayOp} `;
    });
    setDisplay('0');
  }, [display]);

  // Handle calculation (=)
  const handleEquals = useCallback(() => {
    if (!expression && !justCalculated) return;

    try {
      const fullExpr = `${expression}${display}`;
      const result = evaluateExpression(fullExpr);

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        expression: fullExpr,
        result,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 19)]);
      setDisplay(result.toString());
      setExpression('');
      setJustCalculated(true);
    } catch {
      setDisplay('Error');
      setExpression('');
      setJustCalculated(true);
    }
  }, [expression, display, justCalculated]);

  // Handle Clear
  const handleClear = useCallback(() => {
    setDisplay('0');
    setExpression('');
    setJustCalculated(false);
  }, []);

  // Handle Backspace
  const handleBackspace = useCallback(() => {
    if (justCalculated) {
      handleClear();
      return;
    }
    setDisplay((prev) => {
      if (prev.length <= 1 || prev === 'Error') return '0';
      return prev.slice(0, -1);
    });
  }, [justCalculated, handleClear]);

  // Quick preset add (e.g. +100, +500, +1000, +2000)
  const handleQuickAdd = useCallback((amt: number) => {
    const currentVal = parseFloat(display) || 0;
    const nextVal = currentVal + amt;
    setDisplay(nextVal.toString());
    setJustCalculated(false);
  }, [display]);

  // Copy result to clipboard
  const handleCopy = useCallback(() => {
    const numericVal = parseFloat(display) || 0;
    navigator.clipboard.writeText(numericVal.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [display]);

  // Keyboard shortcut support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcut Alt+C to toggle calculator
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // If calculator is open and user isn't typing in an input/textarea
      if (isOpen) {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (isInput) return;

        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleDigit(e.key);
        } else if (e.key === '.') {
          e.preventDefault();
          handleDigit('.');
        } else if (e.key === '+' || e.key === '-') {
          e.preventDefault();
          handleOperator(e.key);
        } else if (e.key === '*') {
          e.preventDefault();
          handleOperator('*');
        } else if (e.key === '/') {
          e.preventDefault();
          handleOperator('/');
        } else if (e.key === 'Enter' || e.key === '=') {
          e.preventDefault();
          handleEquals();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleBackspace();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setIsOpen(false);
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigit, handleOperator, handleEquals, handleBackspace, handleClear]);

  const numericDisplay = parseFloat(display);
  const isValidNumber = !isNaN(numericDisplay);
  const runningTotal = isValidNumber ? numericDisplay : 0;

  return (
    <>
      {/* Header Trigger Button */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant={isOpen ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setIsOpen((prev) => !prev)}
              className={cn(
                'relative h-9 gap-1.5 rounded-lg px-2.5 transition-all text-xs font-medium',
                isOpen
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-xs'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              )}
              aria-label="Toggle Application Calculator"
            >
              {/* Calculator Icon */}
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
                className={cn('shrink-0', isOpen && 'text-primary')}
              >
                <rect width="16" height="20" x="4" y="2" rx="2" />
                <line x1="8" x2="16" y1="6" y2="6" />
                <line x1="16" x2="16" y1="14" y2="18" />
                <path d="M16 10h.01" />
                <path d="M12 10h.01" />
                <path d="M8 10h.01" />
                <path d="M12 14h.01" />
                <path d="M8 14h.01" />
                <path d="M12 18h.01" />
                <path d="M8 18h.01" />
              </svg>

              <span className="hidden sm:inline">Calculator</span>

              {/* Running total tag if non-zero and collapsed */}
              {!isOpen && runningTotal !== 0 && (
                <span className="font-mono text-[10px] font-semibold text-primary bg-primary/15 px-1.5 py-0.2 rounded-sm border border-primary/25">
                  {formatINR(runningTotal)}
                </span>
              )}

              {/* Active Indicator dot */}
              {isOpen && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </Button>
          }
        />
        <TooltipContent side="bottom">
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="font-medium">Quick Sheet Calculator</span>
            <span className="text-[11px] text-muted-foreground">
              Total amounts while viewing tables (Shortcut: Alt+C)
            </span>
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Floating Collapsible Calculator Panel (Non-Modal: Allows viewing and interacting with sheets) */}
      {isOpen && (
        <div
          ref={containerRef}
          className={cn(
            'fixed z-50 w-80 sm:w-84 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl transition-all duration-200 animate-in fade-in zoom-in-95 select-none',
            position === 'top'
              ? 'top-16 right-4 sm:right-6'
              : 'bottom-6 right-4 sm:right-6'
          )}
          style={{ maxHeight: 'calc(100vh - 5rem)' }}
          role="region"
          aria-label="Floating Calculator"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-border/50 px-3.5 py-2.5 bg-muted/40 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="16" height="20" x="4" y="2" rx="2" />
                  <line x1="8" x2="16" y1="6" y2="6" />
                  <line x1="16" x2="16" y1="14" y2="18" />
                  <path d="M16 10h.01" />
                  <path d="M12 10h.01" />
                  <path d="M8 10h.01" />
                  <path d="M12 14h.01" />
                  <path d="M8 14h.01" />
                  <path d="M12 18h.01" />
                  <path d="M8 18h.01" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-foreground tracking-tight">
                Quick Totaler
              </span>
              <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                Sheet Companion
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* History Toggle */}
              <button
                type="button"
                onClick={() => setShowHistory((prev) => !prev)}
                className={cn(
                  'flex h-7 px-2 items-center gap-1 text-[11px] rounded-md font-medium transition-colors',
                  showHistory
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                title="View Calculation History"
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
                  <path d="M3 3v5h5" />
                  <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                  <path d="M12 7v5l4 2" />
                </svg>
                Tape
              </button>

              {/* Reposition Toggle (Top vs Bottom dock) */}
              <button
                type="button"
                onClick={() => setPosition((prev) => (prev === 'top' ? 'bottom' : 'top'))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={position === 'top' ? 'Dock to bottom' : 'Dock to top'}
              >
                {position === 'top' ? (
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
                    <polyline points="7 13 12 18 17 13" />
                    <polyline points="7 6 12 11 17 6" />
                  </svg>
                ) : (
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
                    <polyline points="17 11 12 6 7 11" />
                    <polyline points="17 18 12 13 7 18" />
                  </svg>
                )}
              </button>

              {/* Collapse/Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                title="Collapse Calculator (Esc)"
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
          </div>

          {/* History Tape Drawer */}
          {showHistory && (
            <div className="border-b border-border/60 bg-muted/20 px-3 py-2 max-h-44 overflow-y-auto divide-y divide-border/30 text-xs">
              <div className="flex items-center justify-between pb-1.5 mb-1 font-medium text-[11px] text-muted-foreground">
                <span>Recent Calculations</span>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHistory([])}
                    className="text-rose-500 hover:underline text-[10px]"
                  >
                    Clear All
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <div className="py-4 text-center text-muted-foreground text-xs italic">
                  No calculations yet. Enter amounts below.
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setDisplay(item.result.toString());
                      setExpression('');
                      setJustCalculated(true);
                    }}
                    className="py-1.5 flex items-center justify-between cursor-pointer hover:bg-muted/50 px-1 rounded transition-colors group"
                    title="Click to load into calculator"
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-mono text-[11px] text-muted-foreground truncate">
                        {item.expression}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">{item.timestamp}</span>
                    </div>
                    <span className="font-mono font-semibold text-foreground group-hover:text-primary shrink-0">
                      = {formatINR(item.result)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Calculator Screen / Display */}
          <div className="p-3.5 bg-background/50 border-b border-border/50">
            {/* Expression line */}
            <div className="h-4 text-right font-mono text-xs text-muted-foreground tracking-wide truncate">
              {expression || ' '}
            </div>

            {/* Main Result / Typing line */}
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              {/* Currency Preview */}
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono truncate">
                {isValidNumber && runningTotal !== 0 ? formatINR(runningTotal) : ' '}
              </div>

              {/* Digits Display */}
              <div className="font-mono text-2xl font-bold tracking-tight text-foreground truncate text-right flex-1">
                {display}
              </div>
            </div>

            {/* Action Bar below display: Copy + Denominations */}
            <div className="mt-2.5 flex items-center justify-between gap-1 pt-2 border-t border-border/30">
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded transition-colors',
                  copied
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                title="Copy current amount to clipboard"
              >
                {copied ? (
                  <>✓ Copied</>
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
                    Copy
                  </>
                )}
              </button>

              {/* Quick Cash/Amount adders for speedy tallying */}
              <div className="flex items-center gap-1">
                {[100, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickAdd(amt)}
                    className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 transition-colors"
                    title={`Add +₹${amt} directly`}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Keypad Grid */}
          <div className="p-3 grid grid-cols-4 gap-1.5 bg-muted/10 rounded-b-2xl">
            {/* Row 1: AC, Backspace, %, ÷ */}
            <button
              type="button"
              onClick={handleClear}
              className="h-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs transition-colors active:scale-95 flex items-center justify-center"
            >
              AC
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-10 rounded-xl bg-muted/60 hover:bg-muted text-foreground font-medium text-xs transition-colors active:scale-95 flex items-center justify-center"
              title="Backspace"
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => {
                const val = (parseFloat(display) || 0) / 100;
                setDisplay(val.toString());
              }}
              className="h-10 rounded-xl bg-muted/60 hover:bg-muted text-foreground font-medium text-xs transition-colors active:scale-95 flex items-center justify-center"
            >
              %
            </button>
            <button
              type="button"
              onClick={() => handleOperator('/')}
              className="h-10 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-base transition-colors active:scale-95 flex items-center justify-center"
            >
              ÷
            </button>

            {/* Row 2: 7, 8, 9, × */}
            <button
              type="button"
              onClick={() => handleDigit('7')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              7
            </button>
            <button
              type="button"
              onClick={() => handleDigit('8')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              8
            </button>
            <button
              type="button"
              onClick={() => handleDigit('9')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              9
            </button>
            <button
              type="button"
              onClick={() => handleOperator('*')}
              className="h-10 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-base transition-colors active:scale-95 flex items-center justify-center"
            >
              ×
            </button>

            {/* Row 3: 4, 5, 6, - */}
            <button
              type="button"
              onClick={() => handleDigit('4')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              4
            </button>
            <button
              type="button"
              onClick={() => handleDigit('5')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              5
            </button>
            <button
              type="button"
              onClick={() => handleDigit('6')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              6
            </button>
            <button
              type="button"
              onClick={() => handleOperator('-')}
              className="h-10 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-base transition-colors active:scale-95 flex items-center justify-center"
            >
              −
            </button>

            {/* Row 4: 1, 2, 3, + */}
            <button
              type="button"
              onClick={() => handleDigit('1')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => handleDigit('2')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              2
            </button>
            <button
              type="button"
              onClick={() => handleDigit('3')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              3
            </button>
            <button
              type="button"
              onClick={() => handleOperator('+')}
              className="h-10 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-base transition-colors active:scale-95 flex items-center justify-center"
            >
              +
            </button>

            {/* Row 5: 0, ., ±, = */}
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleDigit('.')}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-bold text-sm shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => {
                const val = parseFloat(display) || 0;
                setDisplay((-val).toString());
              }}
              className="h-10 rounded-xl bg-card hover:bg-muted text-foreground font-medium text-xs shadow-2xs border border-border/40 transition-colors active:scale-95 flex items-center justify-center"
              title="Negate (+/-)"
            >
              ±
            </button>
            <button
              type="button"
              onClick={handleEquals}
              className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg shadow-md shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center"
            >
              =
            </button>
          </div>
        </div>
      )}
    </>
  );
}

