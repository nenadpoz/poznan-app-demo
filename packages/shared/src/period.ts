/** Periodi na Pregledu i Prometu: Godina, Mesec, Period (od–do). */
import { MONTHS_FULL } from './format';

export type PeriodKind = 'godina' | 'mesec' | 'period';
export interface Period {
  kind: PeriodKind;
  year: number;
  month?: number; // 1–12, za 'mesec'
  from?: string; // za 'period'
  to?: string;
}

/** Opseg datuma [from, to] (uključivo) za izabrani period. */
export function periodRange(p: Period): { from: string; to: string } {
  if (p.kind === 'godina') return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  if (p.kind === 'mesec') {
    const m = p.month ?? 1;
    const last = new Date(Date.UTC(p.year, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, '0');
    return { from: `${p.year}-${mm}-01`, to: `${p.year}-${mm}-${last}` };
  }
  const from = p.from ?? `${p.year}-01-01`, to = p.to ?? `${p.year}-12-31`;
  return from <= to ? { from, to } : { from: to, to: from };
}

export function periodLabel(p: Period): string {
  if (p.kind === 'godina') return String(p.year);
  if (p.kind === 'mesec') return `${MONTHS_FULL[(p.month ?? 1) - 1]} ${p.year}.`;
  const r = periodRange(p);
  return `${r.from} – ${r.to}`;
}

export interface TxForTotals {
  type: 'prihod' | 'trosak';
  amount: number;
  date: string;
  companyId: string | null;
  earnedBy?: string | null;
}

/**
 * Zbirovi za period. Troškovi se prikazuju samo na „Ukupno“ (ne po firmi),
 * pa `byCompany` sadrži samo prihod; `null` ključ je keš bez firme.
 */
export function totals(txs: TxForTotals[], p: Period) {
  const { from, to } = periodRange(p);
  const inP = txs.filter(t => t.date >= from && t.date <= to);
  const income = inP.filter(t => t.type === 'prihod').reduce((s, t) => s + t.amount, 0);
  const expense = inP.filter(t => t.type === 'trosak').reduce((s, t) => s + t.amount, 0);
  const byCompany = new Map<string | null, number>();
  for (const t of inP) if (t.type === 'prihod') byCompany.set(t.companyId, (byCompany.get(t.companyId) ?? 0) + t.amount);
  return { income, expense, profit: income - expense, byCompany };
}
