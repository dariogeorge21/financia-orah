// lib/export/ledger.ts
// Master Financial Ledger builder — produces a bank-statement-style row set
// with running Cash and UPI balances, Debit/Credit columns, and transaction codes.

import type {
  IncomeRecord,
  ExpenseRecord
} from '@/lib/types';

// ── Transaction codes (like a bank statement) ────────────────────────────────
export type TransactionCode =
  | 'CASHIN'    // Cash income received
  | 'CASHOUT'   // Cash expense paid
  | 'UPIIN'     // UPI income received
  | 'UPIOUT'    // UPI expense paid
  | 'SPLIT-IN'; // Cash+UPI split income (coupons)

export type EntryKind =
  | 'Income'
  | 'Expense';

export interface LedgerRow {
  /** Sequential row number (1-indexed after sorting) */
  sNo: number;
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Human-friendly display date e.g. "22 Aug 2026" */
  displayDate: string;
  /** Bank-statement style transaction code */
  transactionCode: TransactionCode;
  /** High-level entry category */
  entryKind: EntryKind;
  /** Sub-type / category (Income type, Expense category, etc.) */
  particulars: string;
  /** Person or entity name */
  name: string;
  /** Mobile/contact number */
  contact: string;
  /** Description / narration */
  description: string;
  /** Amount going OUT (expenses, reimbursements) — positive number or 0 */
  debit: number;
  /** Amount coming IN (income, donations) — positive number or 0 */
  credit: number;
  /** Running balance of Cash pool after this entry */
  balanceCash: number;
  /** Running balance of UPI pool after this entry */
  balanceUpi: number;
  /** Total balance (Cash + UPI) after this entry */
  balanceTotal: number;
  /** Payment mode */
  paymentMode: string;
  /** Entry status (Approved, Pending, Paid, etc.) */
  status: string;
  /** Internal reference / ID */
  referenceId: string;
  /** Notes / remarks */
  notes: string;
  /** Transaction type label for filtering */
  transactionType: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(rawDate?: string | null): string {
  if (!rawDate) return '';
  const s = rawDate.split('T')[0]; // strip time part
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

function displayDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[m - 1]} ${y}`;
  } catch {
    return iso;
  }
}

// ── Raw event builder ─────────────────────────────────────────────────────────

interface RawEvent {
  date: string;
  entry: (cashBal: number, upiBal: number) => LedgerRow | null;
}

export function buildLedgerRows(
  income: IncomeRecord[],
  expenses: ExpenseRecord[],
): LedgerRow[] {
  const events: RawEvent[] = [];

  // ── INCOME ──────────────────────────────────────────────────────────────────
  for (const inc of income) {
    const isoDate = fmtDate(inc.date || inc.created_at);
    events.push({
      date: isoDate,
      entry: (cashBal, upiBal) => {
        const amt = Number(inc.amount) || 0;
        const isUpi = inc.money_type === 'UPI';
        const code: TransactionCode = isUpi ? 'UPIIN' : 'CASHIN';
        const newCash = isUpi ? cashBal : cashBal + amt;
        const newUpi = isUpi ? upiBal + amt : upiBal;
        return {
          sNo: 0,
          date: isoDate,
          displayDate: displayDate(isoDate),
          transactionCode: code,
          entryKind: 'Income',
          particulars: inc.type,
          name: inc.contributor,
          contact: inc.mobile_number || '',
          description: inc.description || inc.notes || '',
          debit: 0,
          credit: amt,
          balanceCash: newCash,
          balanceUpi: newUpi,
          balanceTotal: newCash + newUpi,
          paymentMode: inc.money_type,
          status: inc.is_handed_over === false ? 'Cash Pending Handover' : 'Received',
          referenceId: inc.id,
          notes: inc.notes || '',
          transactionType: 'Income',
        };
      },
    });
  }

  // ── EXPENSES ────────────────────────────────────────────────────────────────
  for (const exp of expenses) {
    const isoDate = fmtDate(exp.created_at);
    events.push({
      date: isoDate,
      entry: (cashBal, upiBal) => {
        const amt = Number(exp.amount) || 0;
        const isUpi = exp.money_type === 'UPI';
        const code: TransactionCode = isUpi ? 'UPIOUT' : 'CASHOUT';
        const newCash = isUpi ? cashBal : cashBal - amt;
        const newUpi = isUpi ? upiBal - amt : upiBal;
        return {
          sNo: 0,
          date: isoDate,
          displayDate: displayDate(isoDate),
          transactionCode: code,
          entryKind: 'Expense',
          particulars: exp.category,
          name: exp.paid_by,
          contact: exp.mobile_number || '',
          description: exp.description || '',
          debit: amt,
          credit: 0,
          balanceCash: newCash,
          balanceUpi: newUpi,
          balanceTotal: newCash + newUpi,
          paymentMode: exp.money_type,
          status: exp.status,
          referenceId: exp.id,
          notes: exp.notes || '',
          transactionType: 'Expense',
        };
      },
    });
  }
  // ── Sort by date ascending ────────────────────────────────────────────────────
  events.sort((a, b) => a.date.localeCompare(b.date));

  // ── Build rows with running balance ──────────────────────────────────────────
  let cashBal = 0;
  let upiBal  = 0;
  const rows: LedgerRow[] = [];

  for (let i = 0; i < events.length; i++) {
    const row = events[i].entry(cashBal, upiBal);
    if (!row) continue;
    cashBal = row.balanceCash;
    upiBal  = row.balanceUpi;
    row.sNo = rows.length + 1;
    rows.push(row);
  }

  return rows;
}
