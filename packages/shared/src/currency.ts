/**
 * Valuta. Svi iznosi u bazi imaju i vrednost u dinarima (`amount`), koja se koristi za limite i zbirove;
 * originalni iznos i valuta se čuvaju uz kurs tog dana, pa se stari unosi ne menjaju kad se kurs promeni.
 * Prikaz je podrazumevano u evrima, jednim klikom se prebacuje u dinare.
 */
import { money } from './format';

export const CURRENCIES = ['EUR', 'RSD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_DISPLAY_CURRENCY: Currency = 'EUR';

export interface FxRate {
  date: string; // datum kursne liste
  eur: number; // srednji kurs NBS: 1 EUR = x RSD
}

/** Kurs za dan: kursna lista tog dana, a ako je nema (vikend, praznik, još nije objavljena), poslednja pre toga. */
export function rateFor(date: string, rates: FxRate[]): FxRate | undefined {
  let best: FxRate | undefined;
  for (const r of rates) if (r.date <= date && (!best || r.date > best.date)) best = r;
  return best;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Originalni iznos u dinare. */
export const toRsd = (amount: number, currency: Currency, eurRate: number) => round2(currency === 'RSD' ? amount : amount * eurRate);

/** Dinari u valutu prikaza. */
export const fromRsd = (rsd: number, currency: Currency, eurRate: number) => (currency === 'RSD' ? rsd : eurRate > 0 ? rsd / eurRate : 0);

/** `1.234,56` (dve decimale, zarez). */
export function money2(n: number): string {
  const neg = n < 0;
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  const s = `${money(Number(i))},${d}`;
  return neg ? `−${s}` : s;
}

/** Format iznosa: dinari bez decimala `1.234.567 RSD`, evri sa dve `1.234,56 EUR`. */
export const fmtCurrency = (amount: number, currency: Currency) => (currency === 'RSD' ? `${money(amount)} RSD` : `${money2(amount)} EUR`);

/** Iznos u dinarima, prikazan u izabranoj valuti. Bez kursa evri se ne mogu prikazati, pa ostaju dinari. */
export function fmtDisplay(rsd: number, display: Currency, eurRate: number | undefined): string {
  if (display === 'EUR' && eurRate) return fmtCurrency(fromRsd(rsd, 'EUR', eurRate), 'EUR');
  return fmtCurrency(rsd, 'RSD');
}

/** Kurs u čitljivom obliku: `1 EUR = 117,5367 RSD`. */
export const fmtRate = (eur: number) => `1 EUR = ${eur.toFixed(4).replace('.', ',')} RSD`;
