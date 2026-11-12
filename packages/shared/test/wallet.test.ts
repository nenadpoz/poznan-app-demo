import { describe, expect, it } from 'vitest';
import {
  exchangeSuggest, mergeParts, overdrawn, payStatus, restIn, shownAmount, splitExpense, sumWallets, transferProblem, transferSchema,
  wallet, walletCurrencies, walletOf, walletRsd, walletWithout, type RateFn,
} from '../src';

// 1 EUR = 117,6322 RSD, 1 USD = 104,5 RSD
const rate: RateFn = c => ({ RSD: 1, EUR: 117.6322, USD: 104.5 })[c];

describe('stanje po valutama', () => {
  it('svaka valuta posebno, ukupno po današnjem kursu', () => {
    const kes = walletOf({ rsd: '100000', eur: 2000, usd: null } as never);
    expect(kes).toEqual({ RSD: 100_000, EUR: 2000, USD: 0 });
    expect(walletCurrencies(kes)).toEqual(['EUR', 'RSD']);
    expect(walletRsd(kes, rate)).toBeCloseTo(100_000 + 2000 * 117.6322, 2);
    expect(sumWallets([kes, wallet({ EUR: 1000, USD: 200 })])).toEqual({ RSD: 100_000, EUR: 3000, USD: 200 });
  });
  it('ulog od 17.400 EUR ostaje 17.400 EUR i kad se kurs promeni', () => {
    const ulog = { amount: 17_400 * 117.2, currency: 'EUR' as const, amountOriginal: 17_400 };
    expect(shownAmount(ulog, 'EUR', 117.6322)).toBe(17_400);
    expect(shownAmount(ulog, 'RSD', 117.6322)).toBe(17_400 * 117.2);
    expect(shownAmount({ amount: 11_763.22, currency: 'RSD', amountOriginal: 11_763.22 }, 'EUR', 117.6322)).toBeCloseTo(100, 6);
  });
  it('izmena unosa vraća njegov iznos u raspoloživo', () => {
    expect(walletWithout(wallet({ EUR: 500 }), [{ currency: 'EUR', amountOriginal: 200, out: true }])).toMatchObject({ EUR: 700 });
    expect(walletWithout(wallet({ EUR: 500 }), [{ currency: 'EUR', amountOriginal: 200, out: false }])).toMatchObject({ EUR: 300 });
  });
});

describe('plaćanje iz više valuta', () => {
  // prikolica 2.200 EUR; u kešu 2.000 EUR i 100.000 RSD
  const kes = wallet({ EUR: 2000, RSD: 100_000 });
  it('2.000 EUR i ostatak u dinarima', () => {
    const rsd = restIn('RSD', 2200, 'EUR', [{ currency: 'EUR', amount: 2000 }], rate, kes.RSD);
    expect(rsd).toBe(23_526);
    expect(payStatus(2200, 'EUR', [{ currency: 'EUR', amount: 2000 }, { currency: 'RSD', amount: rsd }], rate).done).toBe(true);
  });
  it('100.000 RSD i ostatak u evrima', () => {
    const eur = restIn('EUR', 2200, 'EUR', [{ currency: 'RSD', amount: 100_000 }], rate, kes.EUR);
    expect(eur).toBe(1349.89);
    expect(payStatus(2200, 'EUR', [{ currency: 'RSD', amount: 100_000 }, { currency: 'EUR', amount: eur }], rate).done).toBe(true);
  });
  it('23.000 RSD i ostatak u evrima: nema dovoljno evra', () => {
    const eur = restIn('EUR', 2200, 'EUR', [{ currency: 'RSD', amount: 23_000 }], rate, kes.EUR);
    expect(eur).toBe(2000);
    const st = payStatus(2200, 'EUR', [{ currency: 'RSD', amount: 23_000 }, { currency: 'EUR', amount: eur }], rate);
    expect(st.done).toBe(false);
    expect(st.left).toBeCloseTo(4.48, 2);
  });
  it('ne može više nego što ima; plata obojici skida dvostruko', () => {
    expect(overdrawn([{ currency: 'EUR', amount: 3000 }], wallet({ EUR: 2000 }))).toEqual({ currency: 'EUR', amount: 3000, max: 2000 });
    expect(overdrawn([{ currency: 'EUR', amount: 2000 }], wallet({ EUR: 2000 }))).toBeNull();
    expect(overdrawn([{ currency: 'EUR', amount: 1500 }], wallet({ EUR: 2000 }), 2)).toMatchObject({ max: 1000 });
  });
  it('raspoređeno više od iznosa', () => {
    const st = payStatus(100, 'EUR', [{ currency: 'EUR', amount: 120 }], rate);
    expect(st.done).toBe(false);
    expect(st.left).toBe(-20);
  });
  it('delovi postaju redovi istog plaćanja, svaki u svojoj valuti', () => {
    const base = { type: 'trosak' as const, currency: 'EUR' as const, date: '2026-11-12', category: 'Oprema' };
    const parts = mergeParts([{ currency: 'EUR', amount: 2000 }, { currency: 'RSD', amount: 23_526 }, { currency: 'USD', amount: 0 }]);
    const rows = splitExpense(base, parts.map(p => ({ accountId: 'kes', owner: null, amount: p.amount, currency: p.currency })), 'S1');
    expect(rows).toEqual([
      { ...base, currency: 'EUR', accountId: 'kes', amountOriginal: 2000, paidBy: null, splitId: 'S1' },
      { ...base, currency: 'RSD', accountId: 'kes', amountOriginal: 23_526, paidBy: null, splitId: 'S1' },
    ]);
  });
});

describe('prenos i zamena valute', () => {
  const kes = wallet({ EUR: 500, RSD: 100_000 });
  it('isti račun samo uz zamenu valute', () => {
    expect(transferProblem({ fromAccountId: 'k', toAccountId: 'k', currency: 'RSD', amount: 1000 }, kes)).toBe('same');
    expect(transferProblem({ fromAccountId: 'k', toAccountId: 'k', currency: 'RSD', amount: 100_000, toCurrency: 'EUR', toAmount: 845 }, kes)).toBeNull();
    expect(transferProblem({ fromAccountId: 'k', toAccountId: 'k', currency: 'RSD', amount: 1000, toCurrency: 'EUR' }, kes)).toBe('received');
  });
  it('ne može se skinuti više nego što ima u toj valuti', () => {
    expect(transferProblem({ fromAccountId: 'k', toAccountId: 'd', currency: 'EUR', amount: 600 }, kes)).toBe('insufficient');
    expect(transferProblem({ fromAccountId: 'k', toAccountId: 'd', currency: 'EUR', amount: 500 }, kes)).toBeNull();
  });
  it('predlog po srednjem kursu', () => {
    expect(exchangeSuggest(100_000, 'RSD', 'EUR', rate)).toBe(850.11);
    expect(exchangeSuggest(100, 'EUR', 'RSD', rate)).toBe(11_763);
  });
  it('šema: zamena traži primljeni iznos', () => {
    const base = { fromAccountId: '11111111-1111-4111-8111-111111111111', amountOriginal: 100, currency: 'EUR' as const, date: '2026-11-12' };
    expect(transferSchema.safeParse({ ...base, toAccountId: base.fromAccountId }).success).toBe(false);
    expect(transferSchema.safeParse({ ...base, toAccountId: base.fromAccountId, toCurrency: 'RSD' }).success).toBe(false);
    expect(transferSchema.safeParse({ ...base, toAccountId: base.fromAccountId, toCurrency: 'RSD', toAmountOriginal: 11_700 }).success).toBe(true);
    expect(transferSchema.safeParse({ ...base, toAccountId: '22222222-2222-4222-8222-222222222222' }).success).toBe(true);
  });
});
