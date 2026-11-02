/** Paušal limit, PDV prag i PDV rokovi. Iznosi limita dolaze iz podešavanja, nikad nisu fiksni u UI-ju. */

export interface LimitSettings {
  pausalLimit: number;
  pdvThreshold: number;
  warnPct: number;
  critPct: number;
}

export const DEFAULT_LIMITS: LimitSettings = { pausalLimit: 6_000_000, pdvThreshold: 8_000_000, warnPct: 80, critPct: 95 };

export type Level = 'good' | 'warn' | 'bad';

export function limitLevel(pct: number, s: Pick<LimitSettings, 'warnPct' | 'critPct'> = DEFAULT_LIMITS): Level {
  if (pct >= s.critPct) return 'bad';
  if (pct >= s.warnPct) return 'warn';
  return 'good';
}

/** Koliko je limita potrošeno: procenat, preostalo (može biti negativno) i nivo upozorenja. */
export function limitUsage(used: number, limit: number, s: Pick<LimitSettings, 'warnPct' | 'critPct'> = DEFAULT_LIMITS) {
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  return { pct, left: limit - used, level: limitLevel(pct, s), fill: Math.min(100, pct) };
}

export interface TxLike {
  type: 'prihod' | 'trosak';
  amount: number;
  date: string;
  companyId: string | null;
}

const sumAmounts = (list: TxLike[]) => list.reduce((s, t) => s + t.amount, 0);

/** Prihod firme u kalendarskoj godini (za paušal limit). */
export const incomeForYear = (txs: TxLike[], companyId: string, year: number) =>
  sumAmounts(txs.filter(t => t.companyId === companyId && t.type === 'prihod' && t.date.startsWith(`${year}-`)));

/** Prihod firme u poslednjih 12 meseci, zaključno sa danas (za PDV prag). */
export function incomeLast12Months(txs: TxLike[], companyId: string, todayIso: string) {
  const from = `${Number(todayIso.slice(0, 4)) - 1}${todayIso.slice(4)}`;
  return sumAmounts(txs.filter(t => t.companyId === companyId && t.type === 'prihod' && t.date > from && t.date <= todayIso));
}

/**
 * PDV period za koji se sada podnosi prijava: do 15. u mesecu to je prethodni mesec,
 * posle toga tekući. Rok je 15. u mesecu posle perioda.
 */
export function pdvPeriod(todayIso: string) {
  const y = Number(todayIso.slice(0, 4)), m = Number(todayIso.slice(5, 7)), d = Number(todayIso.slice(8, 10));
  const pm = d <= 15 ? m - 1 : m;
  const py = pm < 1 ? y - 1 : y, pmo = pm < 1 ? 12 : pm;
  const periodKey = `${py}-${String(pmo).padStart(2, '0')}`;
  const dm = pmo === 12 ? 1 : pmo + 1, dy = pmo === 12 ? py + 1 : py;
  const deadline = `${dy}-${String(dm).padStart(2, '0')}-15`;
  const daysLeft = Math.round((Date.parse(deadline) - Date.parse(todayIso)) / 864e5);
  return { periodKey, deadline, daysLeft };
}

/** Izlazni i ulazni PDV za mesec (YYYY-MM); razlika > 0 je obaveza, < 0 povraćaj. */
export function vatForMonth(txs: (TxLike & { vat?: number })[], companyId: string, monthKey: string) {
  const inMonth = txs.filter(t => t.companyId === companyId && t.date.startsWith(monthKey));
  const vat = (t: TxLike & { vat?: number }) => (t.amount * (t.vat ?? 0)) / 100;
  const out = inMonth.filter(t => t.type === 'prihod').reduce((s, t) => s + vat(t), 0);
  const inn = inMonth.filter(t => t.type === 'trosak').reduce((s, t) => s + vat(t), 0);
  return { out, in: inn, diff: out - inn, invoices: inMonth.filter(t => t.type === 'prihod').length };
}

