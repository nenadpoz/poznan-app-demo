import { describe, expect, it } from 'vitest';
import {
  accountFieldLabel, balances, checkTransfer, fmtCurrency, fmtDisplay, fmtRate, fromRsd, money2, rateFor, sortAccounts, toRsd, totalBalance,
  transactionSchema, transferSchema,
} from '../src';

describe('valuta', () => {
  const rates = [{ date: '2026-10-30', eur: 117.5367 }, { date: '2026-10-29', eur: 117.52 }, { date: '2026-11-03', eur: 117.6 }];
  it('kurs za dan: isti dan ili poslednji pre (vikend)', () => {
    expect(rateFor('2026-10-30', rates)?.eur).toBe(117.5367);
    expect(rateFor('2026-11-01', rates)?.date).toBe('2026-10-30'); // nedelja
    expect(rateFor('2026-10-01', rates)).toBeUndefined();
  });
  it('preračun', () => {
    expect(toRsd(100, 'EUR', 117.5367)).toBe(11753.67);
    expect(toRsd(5000, 'RSD', 117.5367)).toBe(5000);
    expect(fromRsd(11753.67, 'EUR', 117.5367)).toBeCloseTo(100, 6);
    expect(fromRsd(100, 'EUR', 0)).toBe(0);
  });
  it('format', () => {
    expect(money2(1234.5)).toBe('1.234,50');
    expect(money2(-0.456)).toBe('−0,46');
    expect(fmtCurrency(1234567, 'RSD')).toBe('1.234.567 RSD');
    expect(fmtCurrency(1234.567, 'EUR')).toBe('1.234,57 EUR');
    expect(fmtDisplay(117536.7, 'EUR', 117.5367)).toBe('1.000,00 EUR');
    expect(fmtDisplay(117536.7, 'RSD', 117.5367)).toBe('117.537 RSD');
    expect(fmtDisplay(5000, 'EUR', undefined)).toBe('5.000 RSD'); // bez kursa ostaje u dinarima
    expect(fmtRate(117.5367)).toBe('1 EUR = 117,5367 RSD');
  });
});

describe('računi', () => {
  const acc = [
    { id: 'dr', kind: 'company' as const, companyId: 'c1', openingBalance: 100_000, name: 'Poznan Drill' },
    { id: 'kes', kind: 'cash' as const, companyId: null, openingBalance: 20_000, name: 'Keš' },
    { id: 'tr', kind: 'company' as const, companyId: 'c2', openingBalance: 0, name: 'Poznan Trans' },
  ];
  it('stanje: početno + prihodi − troškovi ± prenosi', () => {
    const b = balances(
      acc,
      [
        { type: 'prihod', amount: 50_000, accountId: 'dr' },
        { type: 'trosak', amount: 5_000, accountId: 'kes' },
        { type: 'prihod', amount: 200_000, accountId: 'kes' },
      ],
      [{ fromAccountId: 'dr', toAccountId: 'kes', amount: 30_000 }],
    );
    expect(b.get('dr')).toBe(120_000);
    expect(b.get('kes')).toBe(245_000);
    expect(b.get('tr')).toBe(0);
    expect(totalBalance(b)).toBe(365_000); // prenos ne menja ukupno
  });
  it('redosled: firme po nazivu, keš poslednji', () => {
    expect(sortAccounts(acc).map(a => a.id)).toEqual(['dr', 'tr', 'kes']);
  });
  it('prenos', () => {
    const b = new Map([['dr', 10_000], ['kes', 0]]);
    expect(checkTransfer({ fromAccountId: 'dr', toAccountId: 'dr', amount: 1 }, b)).toBe('same');
    expect(checkTransfer({ fromAccountId: 'dr', toAccountId: 'kes', amount: 0 }, b)).toBe('amount');
    expect(checkTransfer({ fromAccountId: 'dr', toAccountId: 'kes', amount: 20_000 }, b)).toBe('insufficient');
    expect(checkTransfer({ fromAccountId: 'dr', toAccountId: 'kes', amount: 5_000 }, b)).toBeNull();
  });
  it('natpis polja i šeme', () => {
    expect(accountFieldLabel('prihod')).toBe('Uplata na');
    expect(accountFieldLabel('trosak')).toBe('Plaćeno sa');
    const tx = { type: 'trosak', amountOriginal: 50, currency: 'EUR', accountId: 'kes', date: '2026-11-02', category: 'Gorivo' };
    expect(transactionSchema.safeParse(tx).success).toBe(true);
    expect(transactionSchema.safeParse({ ...tx, currency: 'USD' }).success).toBe(false);
    expect(transferSchema.safeParse({ fromAccountId: 'dr', toAccountId: 'dr', amountOriginal: 1, currency: 'RSD', date: '2026-11-02' }).success).toBe(false);
  });
});
