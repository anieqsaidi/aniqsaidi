export function money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
export function finiteNonnegative(value: number) { return Number.isFinite(value) && value >= 0; }
export function validMileage(value: number) { return finiteNonnegative(value) && Number.isInteger(value); }

export function calculateLoan(input: { principalFinanced: number; annualFlatRatePercent: number; tenureMonths: number; installmentsPaid: number }) {
  const { principalFinanced: principal, annualFlatRatePercent: rate, tenureMonths, installmentsPaid } = input;
  if (!finiteNonnegative(principal) || principal <= 0 || !finiteNonnegative(rate) || !Number.isInteger(tenureMonths) || tenureMonths <= 0 || !Number.isInteger(installmentsPaid) || installmentsPaid < 0 || installmentsPaid > tenureMonths) throw new Error('Loan values are invalid.');
  const interest = money(principal * rate / 100 * tenureMonths / 12);
  const total = money(principal + interest);
  const monthly = money(total / tenureMonths);
  const scheduledPaid = money(Math.min(installmentsPaid * monthly, total));
  const remaining = money(Math.max(0, total - scheduledPaid));
  return { principal, interest, total, monthly, scheduledPaid, remaining, progress: total ? scheduledPaid / total : 0, remainingMonths: tenureMonths - installmentsPaid, finalInstallment: money(total - monthly * (tenureMonths - 1)) };
}

export function localDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter a valid date.');
  const date = new Date(`${value}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime()) || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) !== value) throw new Error('Enter a valid date.');
  return date;
}

export const rm = (value: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value);
export const km = (value: number) => `${new Intl.NumberFormat('en-MY').format(value)} km`;
export const dateLabel = (date: Date | null | undefined) => date ? new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(date) : 'Not set';
