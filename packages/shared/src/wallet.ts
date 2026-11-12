/**
 * Stanje novca po valutama (zahtev 12. nov 2026.). Svaki račun i keš vode dinare, evre i dolare odvojeno,
 * u iznosu kako je unet. Ukupno u izabranoj valuti je zbir svih valuta po današnjem kursu.
 * Trošak (i plata) može da se plati iz više valuta: za svaku valutu iznos, najviše koliko račun ima,
 * a „ostatak“ je razlika do iznosa troška po današnjem kursu. Ne može se platiti više nego što ima.
 */
import type { Currency } from './currency';

export type Wallet = Record<Currency, number>;
/** Redosled prikaza valuta. */
export const WALLET_ORDER: readonly Currency[] = ['EUR', 'RSD', 'USD'];
/** Kurs valute (1 EUR ili 1 USD = x RSD; RSD = 1); undefined kad kurs nije poznat. */
export type RateFn = (c: Currency) => number | undefined;

const r2 = (n: number) => Math.round(n * 100) / 100;

export const wallet = (x?: Partial<Wallet> | null): Wallet => ({ EUR: x?.EUR ?? 0, USD: x?.USD ?? 0, RSD: x?.RSD ?? 0 });

/** Stanje iz reda `account_balances` (kolone rsd, eur, usd). */
export const walletOf = (b: { rsd?: number | null; eur?: number | null; usd?: number | null }): Wallet =>
  wallet({ RSD: Number(b.rsd ?? 0), EUR: Number(b.eur ?? 0), USD: Number(b.usd ?? 0) });

/** Valute koje imaju iznos (bez nula), po redosledu prikaza. */
export const walletCurrencies = (w: Wallet): Currency[] => WALLET_ORDER.filter(c => Math.abs(w[c]) >= 0.005);

export const sumWallets = (list: Wallet[]): Wallet =>
  list.reduce((s, w) => wallet({ EUR: r2(s.EUR + w.EUR), USD: r2(s.USD + w.USD), RSD: r2(s.RSD + w.RSD) }), wallet());

/** Sve valute u dinarima po kursu (današnjem). Valuta bez kursa se ne računa. */
export const walletRsd = (w: Wallet, rate: RateFn) => WALLET_ORDER.reduce((s, c) => s + w[c] * (rate(c) ?? 0), 0);

/** Stanje kad se izuzmu postojeći redovi (izmena unosa: njegov iznos se vraća u raspoloživo). */
export function walletWithout(w: Wallet, rows: { currency: Currency; amountOriginal: number; out: boolean }[]): Wallet {
  const o = { ...w };
  for (const r of rows) o[r.currency] = r2(o[r.currency] + (r.out ? r.amountOriginal : -r.amountOriginal));
  return o;
}

export interface PayPart { currency: Currency; amount: number }

/** Dozvoljena razlika pri raspodeli: manje od 1 dinara (zaokruživanje na cent ili dinar). */
export const PAY_TOLERANCE_RSD = 1;

/** Koliko je ostalo da se rasporedi, u dinarima (negativno = raspoređeno više od iznosa). */
export function payLeftRsd(price: number, priceCur: Currency, parts: PayPart[], rate: RateFn): number {
  const paid = parts.reduce((s, p) => s + (p.amount > 0 ? p.amount * (rate(p.currency) ?? 0) : 0), 0);
  return price * (rate(priceCur) ?? 0) - paid;
}

/** Stanje raspodele: ostatak u valuti iznosa i da li je sve raspoređeno. */
export function payStatus(price: number, priceCur: Currency, parts: PayPart[], rate: RateFn) {
  const leftRsd = payLeftRsd(price, priceCur, parts, rate);
  const pr = rate(priceCur) ?? 1;
  return { leftRsd, left: r2(leftRsd / pr), done: price > 0 && Math.abs(leftRsd) < PAY_TOLERANCE_RSD };
}

/** Iznos zaokružen na jedinicu valute: dinar na ceo broj, evro i dolar na cent. */
export const roundIn = (n: number, c: Currency) => (c === 'RSD' ? Math.round(n) : r2(n));

/**
 * „Ostatak“: koliko iz valute `c` treba da se pokrije ostatak iznosa (ostali delovi ostaju kako su upisani),
 * najviše `max` (koliko račun ima u toj valuti). 0 kad je sve raspoređeno.
 */
export function restIn(c: Currency, price: number, priceCur: Currency, parts: PayPart[], rate: RateFn, max = Infinity): number {
  const others = parts.filter(p => p.currency !== c);
  const leftRsd = payLeftRsd(price, priceCur, others, rate);
  const rc = rate(c);
  if (!rc || leftRsd <= 0) return 0;
  return Math.max(0, Math.min(roundIn(leftRsd / rc, c), Math.floor(max * 100) / 100));
}

/**
 * Prvi deo koji traži više nego što račun ima (`mult` = 2 kad se plata isplaćuje obojici, pa se skida dvostruko).
 * `max` je najviše što taj deo sme da bude.
 */
export function overdrawn(parts: PayPart[], available: Wallet, mult = 1): (PayPart & { max: number }) | null {
  for (const p of parts) {
    if (p.amount > 0 && p.amount * mult > available[p.currency] + 0.004) return { ...p, max: Math.max(0, Math.floor((available[p.currency] / mult) * 100) / 100) };
  }
  return null;
}

/** Delovi istog plaćanja spojeni po valuti (bez nula). */
export function mergeParts(parts: PayPart[]): PayPart[] {
  const m = new Map<Currency, number>();
  for (const p of parts) if (p.amount > 0) m.set(p.currency, r2((m.get(p.currency) ?? 0) + p.amount));
  return WALLET_ORDER.filter(c => m.has(c)).map(c => ({ currency: c, amount: m.get(c)! }));
}

export type TransferProblem = 'same' | 'amount' | 'received' | 'insufficient';

/**
 * Prenos ili zamena valute. Isti račun može samo uz zamenu valute; kod zamene primljeni iznos je obavezan.
 * Sa izvora se ne može skinuti više nego što u toj valuti ima.
 */
export function transferProblem(
  t: { fromAccountId: string; toAccountId: string; currency: Currency; amount: number; toCurrency?: Currency | null; toAmount?: number | null },
  available: Wallet | undefined,
): TransferProblem | null {
  const exch = !!t.toCurrency && t.toCurrency !== t.currency;
  if (t.fromAccountId === t.toAccountId && !exch) return 'same';
  if (!(t.amount > 0)) return 'amount';
  if (exch && !((t.toAmount ?? 0) > 0)) return 'received';
  if (available && t.amount > available[t.currency] + 0.004) return 'insufficient';
  return null;
}

/** Predlog primljenog iznosa pri zameni (srednji kurs NBS); stvarno dobijen iznos se upisuje ručno. */
export function exchangeSuggest(amount: number, from: Currency, to: Currency, rate: RateFn): number {
  const rf = rate(from), rt = rate(to);
  return rf && rt ? roundIn((amount * rf) / rt, to) : 0;
}

/**
 * Iznos unosa u valuti prikaza: ako je unet u toj valuti, tačno kako je unet (17.400 EUR ostaje 17.400 EUR);
 * inače dinari tog dana po današnjem kursu prikaza.
 */
export function shownAmount(x: { amount: number; currency: Currency; amountOriginal: number }, display: Currency, rate: number | undefined): number {
  if (x.currency === display) return x.amountOriginal;
  if (display === 'RSD') return x.amount;
  return rate ? x.amount / rate : x.amount;
}
