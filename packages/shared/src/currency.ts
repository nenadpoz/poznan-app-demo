/**
 * Valuta. Svi iznosi u bazi imaju i vrednost u dinarima (`amount`), koja se koristi za limite i zbirove;
 * originalni iznos i valuta se čuvaju uz kurs tog dana, pa se stari unosi ne menjaju kad se kurs promeni.
 * Unos može biti u dinarima, evrima ili dolarima. Prikaz je podrazumevano u evrima; meni gore menja valutu prikaza (RSD, EUR, USD).
 */
import { money } from './format';

export const CURRENCIES = ['EUR', 'USD', 'RSD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_DISPLAY_CURRENCY: Currency = 'EUR';

export interface FxRate {
  date: string; // datum kursne liste
  eur: number; // srednji kurs NBS: 1 EUR = x RSD
  usd?: number | null; // srednji kurs NBS: 1 USD = x RSD
}

/** Kurs valute iz kursne liste (RSD = 1). Bez liste ili bez kursa te valute: undefined. */
export function rateOf(fx: Pick<FxRate, 'eur' | 'usd'> | null | undefined, currency: Currency): number | undefined {
  if (currency === 'RSD') return 1;
  const r = currency === 'EUR' ? fx?.eur : fx?.usd;
  return r && r > 0 ? r : undefined;
}

/** Kurs za dan: kursna lista tog dana, a ako je nema (vikend, praznik, još nije objavljena), poslednja pre toga. */
export function rateFor(date: string, rates: FxRate[]): FxRate | undefined {
  let best: FxRate | undefined;
  for (const r of rates) if (r.date <= date && (!best || r.date > best.date)) best = r;
  return best;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Originalni iznos u dinare; `rate` je kurs te valute (1 EUR ili 1 USD = x RSD). */
export const toRsd = (amount: number, currency: Currency, rate: number) => round2(currency === 'RSD' ? amount : amount * rate);

/** Dinari u valutu prikaza; `rate` je kurs te valute. */
export const fromRsd = (rsd: number, currency: Currency, rate: number) => (currency === 'RSD' ? rsd : rate > 0 ? rsd / rate : 0);

/** `1.234,56` (dve decimale, zarez). */
export function money2(n: number): string {
  const neg = n < 0;
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  const s = `${money(Number(i))},${d}`;
  return neg ? `−${s}` : s;
}

/** Format iznosa: dinari bez decimala `1.234.567 RSD`, evri i dolari sa dve `1.234,56 EUR`, `1.234,56 USD`. */
export const fmtCurrency = (amount: number, currency: Currency) => (currency === 'RSD' ? `${money(amount)} RSD` : `${money2(amount)} ${currency}`);

/** Iznos u dinarima, prikazan u izabranoj valuti (`rate` = kurs te valute). Bez kursa ostaju dinari. */
export function fmtDisplay(rsd: number, display: Currency, rate: number | undefined): string {
  if (display !== 'RSD' && rate) return fmtCurrency(fromRsd(rsd, display, rate), display);
  return fmtCurrency(rsd, 'RSD');
}

/** Kurs u čitljivom obliku: `1 EUR = 117,5367 RSD`. */
export const fmtRate = (rate: number, currency: Exclude<Currency, 'RSD'> = 'EUR') => `1 ${currency} = ${rate.toFixed(4).replace('.', ',')} RSD`;
