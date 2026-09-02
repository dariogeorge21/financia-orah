// lib/calculations.ts
// Financial formula logic — mirrors spreadsheet formulas from blueprint

import type {
  IncomeRecord,
  ExpenseRecord,
  ReimbursementRecord,
  PersonalCommitmentRecord,
  FinanceCallRecord,
  ChurchDonationRecord,
  CouponRecord,
  BudgetCategory,
  MoneyPosition,
  IncomeSummary,
  CommitmentSummary,
  FinanceCallSummary,
  AdvanceSummary,
  ChurchSummary,
  CouponSummary,
  BudgetRow,
  DailyFlowRecord,
  DailyFlowSummary,
  PrayerRequestRecord,
  DailyPrayerGroup,
  PrayerSummary,
  FeeRecord,
  FeeSummary,
  FeePaymentStatus,
} from './types';

/**
 * Checks if an expense source is 'Event' (direct from event funds)
 */
export function isEventExpense(source: string): boolean {
  return source === 'Event' || source === 'Event Money';
}

/**
 * Calculates net Cash spent/outflow for an approved event expense,
 * accounting for direct expenses, active advances, and settled advances with multi-mode refunds/payouts.
 */
export function calcExpenseCashImpact(expense: ExpenseRecord): number {
  if (expense.status !== 'Approved' || !isEventExpense(expense.payment_source)) {
    return 0;
  }

  const status = expense.settlement_status || 'Direct';

  if (status === 'Advance Given') {
    const advType = expense.advance_money_type || expense.money_type;
    return advType === 'Cash' ? Number(expense.advance_amount ?? expense.amount) : 0;
  }

  if (status === 'Settled') {
    const advAmt = Number(expense.advance_amount ?? expense.amount);
    const advType = expense.advance_money_type || expense.money_type;
    const balAmt = Number(expense.balance_amount ?? (Number(expense.amount) - advAmt));
    const balType = expense.balance_money_type || advType;

    let cashOutflow = 0;
    if (advType === 'Cash') cashOutflow += advAmt;
    if (balType === 'Cash') cashOutflow += balAmt; // If balAmt is negative (refund), reduces cash outflow
    return cashOutflow;
  }

  // Direct standard expense
  return expense.money_type === 'Cash' ? Number(expense.amount) : 0;
}

/**
 * Calculates net UPI spent/outflow for an approved event expense,
 * accounting for direct expenses, active advances, and settled advances with multi-mode refunds/payouts.
 */
export function calcExpenseUpiImpact(expense: ExpenseRecord): number {
  if (expense.status !== 'Approved' || !isEventExpense(expense.payment_source)) {
    return 0;
  }

  const status = expense.settlement_status || 'Direct';

  if (status === 'Advance Given') {
    const advType = expense.advance_money_type || expense.money_type;
    return advType === 'UPI' ? Number(expense.advance_amount ?? expense.amount) : 0;
  }

  if (status === 'Settled') {
    const advAmt = Number(expense.advance_amount ?? expense.amount);
    const advType = expense.advance_money_type || expense.money_type;
    const balAmt = Number(expense.balance_amount ?? (Number(expense.amount) - advAmt));
    const balType = expense.balance_money_type || advType;

    let upiOutflow = 0;
    if (advType === 'UPI') upiOutflow += advAmt;
    if (balType === 'UPI') upiOutflow += balAmt; // If balAmt is negative (refund), reduces UPI outflow
    return upiOutflow;
  }

  // Direct standard expense
  return expense.money_type === 'UPI' ? Number(expense.amount) : 0;
}

/**
 * Cash Available =
 *   SUM(Income where money_type=Cash)
 *   - SUM(Cash outflow from Expenses: Direct + Advances + Settled Adjustments)
 *   - SUM(Reimbursements where money_type_paid=Cash AND status=Paid)
 */
export function calcMoneyPosition(
  income: IncomeRecord[],
  expenses: ExpenseRecord[],
  reimbursements: ReimbursementRecord[]
): MoneyPosition {
  const handedOverCashIncome = income
    .filter((i) => i.money_type === 'Cash' && i.is_handed_over !== false)
    .reduce((s, i) => s + Number(i.amount), 0);

  const pendingCashIncome = income
    .filter((i) => i.money_type === 'Cash' && i.is_handed_over === false)
    .reduce((s, i) => s + Number(i.amount), 0);

  const upiIncome = income
    .filter((i) => i.money_type === 'UPI')
    .reduce((s, i) => s + Number(i.amount), 0);

  const cashExpenses = expenses.reduce((s, e) => s + calcExpenseCashImpact(e), 0);
  const upiExpenses = expenses.reduce((s, e) => s + calcExpenseUpiImpact(e), 0);

  const cashReimb = reimbursements
    .filter((r) => r.money_type_paid === 'Cash' && r.status === 'Paid')
    .reduce((s, r) => s + Number(r.amount), 0);

  const upiReimb = reimbursements
    .filter((r) => r.money_type_paid === 'UPI' && r.status === 'Paid')
    .reduce((s, r) => s + Number(r.amount), 0);

  const cashAvailable = handedOverCashIncome - cashExpenses - cashReimb;
  const cashPendingHandover = pendingCashIncome;
  const totalCash = cashAvailable + cashPendingHandover;
  const upiAvailable = upiIncome - upiExpenses - upiReimb;

  return {
    cashAvailable,
    cashPendingHandover,
    totalCash,
    upiAvailable,
    total: cashAvailable + upiAvailable,
  };
}

/**
 * Summary of all volunteer advance disbursements and settlements
 */
export function calcAdvancesSummary(expenses: ExpenseRecord[]): AdvanceSummary {
  const activeAdvances = expenses.filter(
    (e) => e.settlement_status === 'Advance Given' && e.status !== 'Rejected'
  );
  const settledAdvances = expenses.filter(
    (e) => e.settlement_status === 'Settled' && e.status !== 'Rejected'
  );

  const totalAdvanceDisbursed = [...activeAdvances, ...settledAdvances].reduce(
    (s, e) => s + Number(e.advance_amount ?? e.amount),
    0
  );
  const totalPendingSettlement = activeAdvances.reduce(
    (s, e) => s + Number(e.advance_amount ?? e.amount),
    0
  );

  return {
    totalAdvanceDisbursed,
    totalPendingSettlement,
    pendingCount: activeAdvances.length,
    settledCount: settledAdvances.length,
  };
}

/**
 * Income summary — based on personal commitments & finance calls
 */
export function calcIncomeSummary(
  income: IncomeRecord[],
  personalCommitments: PersonalCommitmentRecord[],
  financeCalls: FinanceCallRecord[] = []
): IncomeSummary {
  const totalReceived = income.reduce((s, i) => s + Number(i.amount), 0);

  const pendingPersonal = personalCommitments
    .filter((c) => c.status !== 'Cancelled')
    .reduce((s, c) => s + Math.max(0, Number(c.promised) - Number(c.received)), 0);

  const pendingFinance = financeCalls
    .filter((c) => c.status !== 'Cancelled')
    .reduce((s, c) => s + Math.max(0, Number(c.promised) - Number(c.received)), 0);

  const totalPending = pendingPersonal + pendingFinance;
  const totalExpected = totalReceived + totalPending;

  return {
    totalExpected,
    totalReceived,
    totalPending,
  };
}

export function calcPersonalCommitmentSummary(commitments: PersonalCommitmentRecord[]): CommitmentSummary {
  const active = commitments.filter((c) => c.status !== 'Cancelled');
  const totalPromised = active.reduce((s, c) => s + Number(c.promised), 0);
  const totalReceived = active.reduce((s, c) => s + Number(c.received), 0);
  const fullyReceivedCount = active.filter((c) => c.status === 'Fully Received').length;
  const pendingCount = active.filter((c) => c.status === 'Pending' || c.status === 'Partially Received').length;

  return {
    totalPromised,
    totalReceived,
    totalPending: Math.max(0, totalPromised - totalReceived),
    fullyReceivedCount,
    pendingCount,
  };
}

export function calcFinanceCallSummary(calls: FinanceCallRecord[]): FinanceCallSummary {
  const active = calls.filter((c) => c.status !== 'Cancelled');
  const totalPromised = active.reduce((s, c) => s + Number(c.promised), 0);
  const totalReceived = active.reduce((s, c) => s + Number(c.received), 0);
  const fullyReceivedCount = active.filter((c) => c.status === 'Fully Received').length;
  const pendingCount = active.filter((c) => c.status === 'Pending' || c.status === 'Partially Received').length;

  return {
    totalPromised,
    totalReceived,
    totalPending: Math.max(0, totalPromised - totalReceived),
    fullyReceivedCount,
    pendingCount,
  };
}

export function calcChurchSummary(donations: ChurchDonationRecord[]): ChurchSummary {
  const totalAmount = donations.reduce((s, d) => s + Number(d.amount), 0);
  const upiAmount = donations
    .filter((d) => d.money_type === 'UPI')
    .reduce((s, d) => s + Number(d.amount), 0);
  const cashHandedOver = donations
    .filter((d) => d.money_type === 'Cash' && d.is_handed_over !== false)
    .reduce((s, d) => s + Number(d.amount), 0);
  const cashPending = donations
    .filter((d) => d.money_type === 'Cash' && d.is_handed_over === false)
    .reduce((s, d) => s + Number(d.amount), 0);

  return {
    totalAmount,
    upiAmount,
    cashHandedOver,
    cashPending,
    count: donations.length,
  };
}

export function calcCouponSummary(coupons: CouponRecord[]): CouponSummary {
  const totalAmount = coupons.reduce((s, c) => s + Number(c.amount), 0);
  const upiAmount = coupons
    .filter((c) => c.money_type === 'UPI')
    .reduce((s, c) => s + Number(c.amount), 0);
  const cashHandedOver = coupons
    .filter((c) => c.money_type === 'Cash' && c.is_handed_over !== false)
    .reduce((s, c) => s + Number(c.amount), 0);
  const cashPending = coupons
    .filter((c) => c.money_type === 'Cash' && c.is_handed_over === false)
    .reduce((s, c) => s + Number(c.amount), 0);

  return {
    totalAmount,
    upiAmount,
    cashHandedOver,
    cashPending,
    count: coupons.length,
  };
}

/**
 * Compute budget rows — actual = approved expenses per category
 */
export function calcBudgetRows(
  budgets: BudgetCategory[],
  expenses: ExpenseRecord[]
): BudgetRow[] {
  return budgets.map((b) => {
    const actual = expenses
      .filter((e) => e.category.toLowerCase() === b.category.toLowerCase() && e.status === 'Approved')
      .reduce((s, e) => s + Number(e.amount), 0);
    const planned = Number(b.planned);
    const remaining = planned - actual;
    const utilizationPct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
    const statusLabel =
      utilizationPct >= 90 ? 'Critical' : utilizationPct >= 60 ? 'Warning' : 'Healthy';
    return { ...b, actual, remaining, utilizationPct, statusLabel };
  });
}

/** Utility: Format INR currency */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Group income by type for pie chart */
export function incomeByType(income: IncomeRecord[]) {
  const map: Record<string, number> = {};
  for (const i of income) {
    map[i.type] = (map[i.type] ?? 0) + Number(i.amount);
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

/** Group approved expenses by category for bar chart */
export function expenseByCategory(expenses: ExpenseRecord[]) {
  const map: Record<string, number> = {};
  for (const e of expenses.filter((x) => x.status === 'Approved')) {
    map[e.category] = (map[e.category] ?? 0) + Number(e.amount);
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Returns today's date formatted as YYYY-MM-DD in the local/IST timezone.
 */
export function getTodayDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Extracts a normalized YYYY-MM-DD date key from either a date string or ISO timestamp in local/IST timezone.
 */
export function extractDateKey(dateOrIso?: string | null): string {
  if (!dateOrIso) {
    return getTodayDateString();
  }

  const str = dateOrIso.trim();
  // If already standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(parsed);
    }
  } catch {
    // fallback
  }

  return str.split('T')[0];
}

/**
 * Formats a YYYY-MM-DD date key for clean display, day of week, and relative tags.
 */
export function formatDisplayDate(dateStr: string): {
  displayDate: string;
  dayOfWeek: string;
  isToday: boolean;
  isYesterday: boolean;
} {
  try {
    const parts = dateStr.split('-').map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const dateObj = new Date(y, m - 1, d, 12, 0, 0);
      if (!isNaN(dateObj.getTime())) {
        const todayKey = getTodayDateString();
        const now = new Date();
        const yest = new Date(now.getTime() - 86400000);
        const yestKey = getTodayDateString(yest);

        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const displayDate = dateObj.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

        return {
          displayDate,
          dayOfWeek,
          isToday: dateStr === todayKey,
          isYesterday: dateStr === yestKey,
        };
      }
    }
  } catch {
    // ignore
  }

  return {
    displayDate: dateStr,
    dayOfWeek: '',
    isToday: false,
    isYesterday: false,
  };
}

/**
 * Calculates day-by-day cashflow breakdown (Cash vs UPI Income & Outgoing) and overall summary statistics.
 */
export function calcDailyFlowRecords(
  income: IncomeRecord[],
  expenses: ExpenseRecord[]
): {
  dailyRecords: DailyFlowRecord[];
  summary: DailyFlowSummary;
} {
  const map = new Map<
    string,
    {
      incomeRecords: IncomeRecord[];
      expenseRecords: ExpenseRecord[];
    }
  >();

  // Group all income records by date
  for (const inc of income) {
    const dateKey = extractDateKey(inc.date || inc.created_at);
    if (!map.has(dateKey)) {
      map.set(dateKey, { incomeRecords: [], expenseRecords: [] });
    }
    map.get(dateKey)!.incomeRecords.push(inc);
  }

  // Group all expense records by date
  for (const exp of expenses) {
    const dateKey = extractDateKey(exp.created_at || (exp as unknown as { date?: string }).date);
    if (!map.has(dateKey)) {
      map.set(dateKey, { incomeRecords: [], expenseRecords: [] });
    }
    map.get(dateKey)!.expenseRecords.push(exp);
  }

  // Sort dates descending (newest first)
  const allDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  const dailyRecords: DailyFlowRecord[] = allDates.map((dateKey) => {
    const group = map.get(dateKey)!;
    const { displayDate, dayOfWeek, isToday, isYesterday } = formatDisplayDate(dateKey);

    // Income breakdown
    let incomeCash = 0;
    let incomeUpi = 0;
    for (const inc of group.incomeRecords) {
      const amt = Number(inc.amount) || 0;
      if (inc.money_type === 'Cash') {
        incomeCash += amt;
      } else if (inc.money_type === 'UPI') {
        incomeUpi += amt;
      }
    }
    const incomeTotal = incomeCash + incomeUpi;
    const incomeCount = group.incomeRecords.length;

    // Outgoing / Expense breakdown
    let expenseCash = 0;
    let expenseUpi = 0;
    let expenseCount = 0;

    for (const exp of group.expenseRecords) {
      if (exp.status === 'Approved') {
        expenseCash += calcExpenseCashImpact(exp);
        expenseUpi += calcExpenseUpiImpact(exp);
        expenseCount += 1;
      }
    }

    const expenseTotal = expenseCash + expenseUpi;
    const netCash = incomeCash - expenseCash;
    const netUpi = incomeUpi - expenseUpi;
    const netTotal = incomeTotal - expenseTotal;

    return {
      date: dateKey,
      displayDate,
      dayOfWeek,
      isToday,
      isYesterday,
      incomeCash,
      incomeUpi,
      incomeTotal,
      incomeCount,
      expenseCash,
      expenseUpi,
      expenseTotal,
      expenseCount,
      netCash,
      netUpi,
      netTotal,
      incomeRecords: group.incomeRecords,
      expenseRecords: group.expenseRecords,
    };
  });

  // Calculate global summary across all days
  let totalIncome = 0;
  let incomeCash = 0;
  let incomeUpi = 0;

  let totalExpense = 0;
  let expenseCash = 0;
  let expenseUpi = 0;

  let todayIncome = 0;
  let todayExpense = 0;

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  for (const rec of dailyRecords) {
    totalIncome += rec.incomeTotal;
    incomeCash += rec.incomeCash;
    incomeUpi += rec.incomeUpi;

    totalExpense += rec.expenseTotal;
    expenseCash += rec.expenseCash;
    expenseUpi += rec.expenseUpi;

    if (rec.date === todayKey) {
      todayIncome = rec.incomeTotal;
      todayExpense = rec.expenseTotal;
    }
  }

  const summary: DailyFlowSummary = {
    totalIncome,
    incomeCash,
    incomeUpi,
    totalExpense,
    expenseCash,
    expenseUpi,
    netFlow: totalIncome - totalExpense,
    netCash: incomeCash - expenseCash,
    netUpi: incomeUpi - expenseUpi,
    todayIncome,
    todayExpense,
    todayNet: todayIncome - todayExpense,
    totalDaysWithActivity: dailyRecords.length,
  };

  return { dailyRecords, summary };
}

/**
 * Groups prayer requests date-wise and computes summary statistics.
 */
export function groupPrayerRequestsByDate(requests: PrayerRequestRecord[]): {
  groups: DailyPrayerGroup[];
  summary: PrayerSummary;
} {
  const map = new Map<string, PrayerRequestRecord[]>();

  for (const req of requests) {
    const dateKey = extractDateKey(req.date || req.created_at);
    if (!map.has(dateKey)) {
      map.set(dateKey, []);
    }
    map.get(dateKey)!.push(req);
  }

  // Sort dates descending (newest first)
  const allDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  const groups: DailyPrayerGroup[] = allDates.map((dateKey) => {
    const list = map.get(dateKey)!;
    const { displayDate, dayOfWeek, isToday, isYesterday } = formatDisplayDate(dateKey);

    return {
      date: dateKey,
      displayDate,
      dayOfWeek,
      isToday,
      isYesterday,
      requests: list,
      count: list.length,
    };
  });

  const todayKey = getTodayDateString();

  const todayRequests = requests.filter(
    (r) => extractDateKey(r.date || r.created_at) === todayKey
  ).length;
  const activeRequests = requests.filter((r) => r.status === 'Active').length;
  const answeredRequests = requests.filter((r) => r.status === 'Answered').length;
  const archivedRequests = requests.filter((r) => r.status === 'Archived').length;

  const uniquePeople = new Set(requests.map((r) => r.person_name.trim().toLowerCase())).size;

  const summary: PrayerSummary = {
    totalRequests: requests.length,
    todayRequests,
    activeRequests,
    answeredRequests,
    archivedRequests,
    totalPeople: uniquePeople,
    totalDaysWithRequests: groups.length,
  };

  return { groups, summary };
}

/**
 * Formats a clean, structured text of prayer requests for clipboard copy.
 */
export function formatPrayerListText(
  requests: PrayerRequestRecord[],
  headerTitle: string = 'ORAH CAMPUS MEET 2026 - PRAYER LIST'
): string {
  if (requests.length === 0) return 'No prayer requests recorded.';

  const { groups } = groupPrayerRequestsByDate(requests);

  let output = `🙏 ${headerTitle}\n`;
  output += `Total Requests: ${requests.length} · People: ${new Set(requests.map((r) => r.person_name.trim().toLowerCase())).size}\n`;
  output += `═══════════════════════════════════════\n\n`;

  for (const grp of groups) {
    output += `📅 ${grp.displayDate} (${grp.dayOfWeek})\n`;
    output += `───────────────────────────────────────\n`;

    grp.requests.forEach((req, idx) => {
      const phone = req.mobile_number ? ` (📱 ${req.mobile_number})` : '';
      output += `${idx + 1}. ${req.person_name}${phone}\n`;
      output += `   • Intention: ${req.prayer_request}\n`;
      if (req.notes) {
        output += `   • Note: ${req.notes}\n`;
      }
      output += `\n`;
    });

    output += `\n`;
  }

  return output.trim();
}

/**
 * Formats names only for clipboard copy (clean list).
 */
export function formatPrayerNamesOnly(requests: PrayerRequestRecord[]): string {
  if (requests.length === 0) return 'No names found.';
  const names = Array.from(new Set(requests.map((r) => r.person_name.trim())));
  return names.map((name, i) => `${i + 1}. ${name}`).join('\n');
}

/**
 * Formats names and their prayer intentions for clipboard copy.
 */
export function formatPrayerNamesAndIntentions(requests: PrayerRequestRecord[]): string {
  if (requests.length === 0) return 'No prayer intentions found.';
  return requests
    .map((r, i) => `${i + 1}. ${r.person_name} - ${r.prayer_request}`)
    .join('\n');
}

/**
 * Formats names with phone numbers for clipboard copy.
 */
export function formatPrayerContactsList(requests: PrayerRequestRecord[]): string {
  if (requests.length === 0) return 'No contacts found.';
  return requests
    .map((r, i) => `${i + 1}. ${r.person_name} - ${r.mobile_number || 'No Phone'}`)
    .join('\n');
}

// ============================================================
// REGISTRATION FEES & DUES CALCULATIONS
// ============================================================

/**
 * Calculates aggregated KPI summary metrics for checked-in registration fees and dues.
 */
export function calcFeeSummary(fees: FeeRecord[]): FeeSummary {
  let totalCollected = 0;
  let cashCollected = 0;
  let cashCount = 0;
  let upiCollected = 0;
  let upiCount = 0;
  let totalDue = 0;

  let fullyPaidCount = 0;
  let fullyPaidAmount = 0;

  let partiallyPaidCount = 0;
  let partiallyPaidAmount = 0;
  let partiallyPaidDue = 0;

  let laterPayCount = 0;
  let laterPayDue = 0;

  let notPaidCount = 0;
  let notPaidDue = 0;

  for (const fee of fees) {
    const paid = Number(fee.amount_paid) || 0;
    const due = Number(fee.amount_due) || 0;
    const status = (fee.payment_status || '').toLowerCase().trim();
    const method = (fee.payment_method || '').toUpperCase().trim();

    totalCollected += paid;
    totalDue += due;

    if (method === 'CASH') {
      cashCollected += paid;
      if (paid > 0) cashCount += 1;
    } else if (method === 'UPI') {
      upiCollected += paid;
      if (paid > 0) upiCount += 1;
    }

    if (status === 'paid' || status === 'fully_paid') {
      fullyPaidCount += 1;
      fullyPaidAmount += paid;
    } else if (status === 'partially_paid' || status === 'half_paid') {
      partiallyPaidCount += 1;
      partiallyPaidAmount += paid;
      partiallyPaidDue += due;
    } else if (status === 'later_pay' || status === 'pay_later') {
      laterPayCount += 1;
      laterPayDue += due;
    } else {
      // not_paid, no_pay, or unassigned
      notPaidCount += 1;
      notPaidDue += due;
    }
  }

  const totalExpected = totalCollected + totalDue;
  const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

  return {
    totalCollected,
    cashCollected,
    cashCount,
    upiCollected,
    upiCount,
    totalDue,
    totalExpected,
    checkedInCount: fees.length,
    fullyPaidCount,
    fullyPaidAmount,
    partiallyPaidCount,
    partiallyPaidAmount,
    partiallyPaidDue,
    laterPayCount,
    laterPayDue,
    notPaidCount,
    notPaidDue,
    collectionRate: Math.round(collectionRate * 10) / 10,
  };
}

/**
 * Normalizes payment status into user-friendly display labels.
 */
export function formatFeeStatusLabel(status: FeePaymentStatus | string): string {
  const s = (status || '').toLowerCase().trim();
  switch (s) {
    case 'paid':
    case 'fully_paid':
      return 'Fully Paid';
    case 'partially_paid':
    case 'half_paid':
      return 'Partially Paid';
    case 'later_pay':
    case 'pay_later':
      return 'Pay Later';
    case 'not_paid':
    case 'no_pay':
      return 'Unpaid';
    default:
      return 'Pending';
  }
}



