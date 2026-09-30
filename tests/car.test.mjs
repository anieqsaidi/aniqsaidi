import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLoan, localDate } from '../src/car/calc.ts';
import { PRICE_SNAPSHOT, SERVICE_ITEMS, SERVICE_SCHEDULE, dueState, nextService } from '../src/car/schedule.ts';

test('screenshot reference line totals remain exact', () => {
  assert.equal(SERVICE_ITEMS.reduce((sum, row) => sum + Math.round(row.peninsular * 100), 0), 58700);
  assert.equal(SERVICE_ITEMS.reduce((sum, row) => sum + Math.round(row.east * 100), 0), 61125);
  assert.equal(PRICE_SNAPSHOT.checkedAt, null);
  assert.equal(SERVICE_ITEMS.find((row) => row.id === 'atf').quantity, 3);
});
test('due state uses linked completion, not odometer alone', () => {
  assert.equal(nextService(80001, []).targetMileage, 40000);
  assert.equal(nextService(80001, [SERVICE_SCHEDULE[0].id]).targetMileage, 80000);
  assert.equal(dueState(40000, 39000, false), 'soon');
  assert.equal(dueState(40000, 40000, false), 'due');
  assert.equal(dueState(40000, 41000, true), 'completed');
  assert.equal(dueState(40000, 10000, false, new Date('2026-09-29'), new Date('2026-09-30')), 'due');
});
test('flat-rate loan handles zero interest and final sen adjustment', () => {
  const free = calculateLoan({ principalFinanced: 12000, annualFlatRatePercent: 0, tenureMonths: 12, installmentsPaid: 4 });
  assert.equal(free.monthly, 1000);
  assert.equal(free.remaining, 8000);
  const rounded = calculateLoan({ principalFinanced: 10000, annualFlatRatePercent: 3, tenureMonths: 36, installmentsPaid: 0 });
  assert.equal(rounded.total, 10900);
  assert.equal(rounded.finalInstallment, 302.70);
  assert.throws(() => calculateLoan({ principalFinanced: Infinity, annualFlatRatePercent: 3, tenureMonths: 36, installmentsPaid: 0 }));
});
test('Malaysia date-only input stays on the chosen day', () => {
  assert.equal(localDate('2026-09-30').toISOString(), '2026-09-30T04:00:00.000Z');
  assert.throws(() => localDate('2026-02-30'));
});
