import { describe, expect, it } from 'vitest';
import { jobSchema, latestOwnerMonth, ownerContributionSchema, ownerDiff, ownerStats, ownerTolerance, shiftMonth, splitSalary, transactionSchema, splitExpense, newUuid } from '../src';

const txs = [
  { type: 'trosak' as const, amount: 100_000, date: '2026-10-05', salaryTo: 'nenad' as const },
  { type: 'trosak' as const, amount: 80_000, date: '2026-10-06', salaryTo: 'jovan' as const },
  { type: 'trosak' as const, amount: 50_000, date: '2026-09-01', salaryTo: 'jovan' as const },
  { type: 'trosak' as const, amount: 9_999, date: '2026-10-07', salaryTo: null }, // običan trošak
  { type: 'prihod' as const, amount: 1_000_000, date: '2026-10-08' },
];
const ul = [{ owner: 'jovan' as const, amount: 30_000, date: '2026-10-10' }];

describe('plate i ulozi', () => {
  it('zbir po periodu i neto', () => {
    const m = ownerStats(txs, ul, { kind: 'mesec', ym: '2026-10' });
    expect(m.nenad).toEqual({ salary: 100_000, contributed: 0, net: 100_000 });
    expect(m.jovan).toEqual({ salary: 80_000, contributed: 30_000, net: 50_000 });
    expect(ownerStats(txs, ul, { kind: 'godina', year: '2026' }).jovan.salary).toBe(130_000);
    expect(ownerStats(txs, ul, { kind: 'sve' }).jovan.net).toBe(100_000);
  });
  it('razlika i kome se isplaćuje', () => {
    const m = ownerStats(txs, ul, { kind: 'mesec', ym: '2026-10' });
    expect(ownerDiff(m)).toEqual({ amount: 50_000, ahead: 'nenad', payTo: 'jovan' });
    // ispod najmanje jedinice prikaza je jednako
    const eq = ownerStats([{ type: 'trosak', amount: 100.5, date: '2026-10-01', salaryTo: 'nenad' }, { type: 'trosak', amount: 100, date: '2026-10-01', salaryTo: 'jovan' }], [], { kind: 'sve' });
    expect(ownerDiff(eq, ownerTolerance('EUR', 117.5)).payTo).toBeNull();
    expect(ownerDiff(eq, ownerTolerance('RSD')).payTo).toBeNull();
  });
  it('poslednji mesec i pomeranje', () => {
    expect(latestOwnerMonth(txs, ul, '2026-11-02')).toBe('2026-10');
    expect(latestOwnerMonth([], [], '2026-11-02')).toBe('2026-11');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('obojica = dva unosa', () => {
    expect(splitSalary({ amountOriginal: 10_000 }, 'oba')).toEqual([{ amountOriginal: 10_000, salaryTo: 'nenad' }, { amountOriginal: 10_000, salaryTo: 'jovan' }]);
    expect(splitSalary({ amountOriginal: 1 }, 'jovan')).toHaveLength(1);
  });
  it('šeme', () => {
    const base = { type: 'trosak', amountOriginal: 10, currency: 'RSD', accountId: 'a', date: '2026-11-02', category: 'Plata' };
    expect(transactionSchema.safeParse({ ...base, salaryTo: 'nenad' }).success).toBe(true);
    expect(transactionSchema.safeParse({ ...base, type: 'prihod', salaryTo: 'nenad' }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...base, salaryTo: 'nenad', clientId: 'k' }).success).toBe(false);
    expect(ownerContributionSchema.safeParse({ owner: 'jovan', accountId: 'a', amountOriginal: 5, currency: 'EUR', date: '2026-11-02' }).success).toBe(true);
    const job = { clientId: 'k', startDate: '2026-11-02', status: 'cekanje' };
    expect(jobSchema.safeParse({ ...job, startTime: '09:00', endTime: '11:00' }).success).toBe(true);
    expect(jobSchema.safeParse({ ...job, startTime: '11:00', endTime: '09:00' }).success).toBe(false);
  });
});

describe('trošak iz više izvora', () => {
  const base = { type: 'trosak' as const, currency: 'EUR' as const, date: '2026-11-02', category: 'Alat' };
  it('Jovan 400 i Nenad 500: dva reda bez računa, isti split', () => {
    const rows = splitExpense(base, [{ accountId: null, owner: 'jovan', amount: 400 }, { accountId: null, owner: 'nenad', amount: 500 }, { accountId: 'drill', owner: null, amount: 0 }], 'S1');
    expect(rows).toEqual([
      { ...base, accountId: null, amountOriginal: 400, paidBy: 'jovan', splitId: 'S1' },
      { ...base, accountId: null, amountOriginal: 500, paidBy: 'nenad', splitId: 'S1' },
    ]);
  });
  it('jedan izvor nema split; keš i vlasnik zajedno', () => {
    expect(splitExpense(base, [{ accountId: 'drill', owner: null, amount: 100 }], 'S1')[0]).toMatchObject({ accountId: 'drill', paidBy: null, splitId: null });
    expect(splitExpense(base, [{ accountId: 'kes', owner: null, amount: 50 }, { accountId: null, owner: 'nenad', amount: 100 }], 'S1')).toMatchObject([
      { accountId: 'kes', paidBy: null, splitId: 'S1' }, { accountId: null, paidBy: 'nenad', splitId: 'S1' }]);
    expect(() => splitExpense(base, [], 'S1')).toThrow();
  });
  it('uuid v4', () => { expect(newUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); });
});
