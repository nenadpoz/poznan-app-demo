import { describe, expect, it } from 'vitest';
import { jobInFilter, jobMoney, jobSchema } from '../src';

const rate = (c: 'RSD' | 'EUR' | 'USD') => ({ RSD: 1, EUR: 117.6, USD: 104.5 })[c];

describe('novac posla', () => {
  it('cena po metru × metri, kapara i dug', () => {
    const m = jobMoney({ pricePerMeter: 3000, meters: 40, priceCurrency: 'RSD' }, [{ type: 'prihod', amount: 50_000, currency: 'RSD', amountOriginal: 50_000 }], rate);
    expect(m).toEqual({ currency: 'RSD', perMeter: 3000, meters: 40, total: 120_000, paid: 50_000, left: 70_000 });
  });
  it('kapara u drugoj valuti se preračunava, u istoj ostaje kako je uneta', () => {
    const m = jobMoney({ pricePerMeter: 25, meters: 40, priceCurrency: 'EUR' }, [
      { amount: 117.2 * 300, currency: 'EUR', amountOriginal: 300 },
      { amount: 11_760, currency: 'RSD', amountOriginal: 11_760 },
      { type: 'trosak', amount: 5000, currency: 'RSD', amountOriginal: 5000 },
    ], rate);
    expect(m.total).toBe(1000);
    expect(m.paid).toBe(400);
    expect(m.left).toBe(600);
  });
  it('bez metara nema ukupne cene ni duga', () => {
    const m = jobMoney({ pricePerMeter: 3000, meters: null, priceCurrency: 'RSD' }, [], rate);
    expect(m.total).toBeNull();
    expect(m.left).toBeNull();
  });
  it('filter po statusu', () => {
    expect(jobInFilter('uplata', 'aktivni')).toBe(true);
    expect(jobInFilter('zavrseno', 'aktivni')).toBe(false);
    expect(jobInFilter('zavrseno', 'zavrseno')).toBe(true);
    expect(jobInFilter('proces', 'cekanje')).toBe(false);
  });
  it('šema posla: cena i metri', () => {
    const base = { clientId: '11111111-1111-4111-8111-111111111111', startDate: null, status: 'cekanje' as const };
    expect(jobSchema.parse({ ...base, pricePerMeter: 3000, meters: 40 })).toMatchObject({ pricePerMeter: 3000, meters: 40, priceCurrency: 'RSD' });
    expect(jobSchema.safeParse({ ...base, meters: -1 }).success).toBe(false);
  });
});
