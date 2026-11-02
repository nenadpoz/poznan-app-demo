/**
 * Plate i ulozi vlasnika.
 * Plata = trošak sa `salaryTo`. Ulog = sopstveni novac vlasnika u firmu ili keš (nije prihod).
 * Neto po vlasniku = isplaćena plata − ulog. Razlika poredi neto iznose.
 * Svi iznosi su u dinarima (RSD); prikaz u EUR je samo preračun.
 */
import { USERS, type SalaryTarget, type UserId } from './constants';

export interface SalaryLike { type: 'prihod' | 'trosak'; amount: number; date: string; salaryTo?: UserId | null }
export interface ContributionLike { owner: UserId; amount: number; date: string }
export interface OwnerStat { salary: number; contributed: number; net: number }
export type OwnerStats = Record<UserId, OwnerStat>;

export type OwnerPeriod = { kind: 'mesec'; ym: string } | { kind: 'godina'; year: string } | { kind: 'sve' };

export const inOwnerPeriod = (p: OwnerPeriod, date: string) =>
  p.kind === 'mesec' ? date.startsWith(`${p.ym}-`) : p.kind === 'godina' ? date.startsWith(`${p.year}-`) : true;

const isSalary = (t: SalaryLike): t is SalaryLike & { salaryTo: UserId } => t.type === 'trosak' && !!t.salaryTo;

/** Plata, ulog i neto po vlasniku za izabrani period. */
export function ownerStats(txs: SalaryLike[], contributions: ContributionLike[], p: OwnerPeriod): OwnerStats {
  const out = Object.fromEntries(USERS.map(u => [u, { salary: 0, contributed: 0, net: 0 }])) as OwnerStats;
  for (const t of txs) if (isSalary(t) && inOwnerPeriod(p, t.date)) out[t.salaryTo].salary += t.amount;
  for (const c of contributions) if (inOwnerPeriod(p, c.date)) out[c.owner].contributed += c.amount;
  for (const u of USERS) out[u].net = out[u].salary - out[u].contributed;
  return out;
}

/** Najmanja razlika koja se vidi u prikazu: 1 RSD ili 0,01 EUR (u dinarima). Manje od toga je „jednako“. */
export const ownerTolerance = (display: 'RSD' | 'EUR', eurRate?: number) => (display === 'EUR' && eurRate ? eurRate * 0.01 : 1);

/**
 * Ko je neto dobio više i za koliko (RSD). `payTo` je vlasnik kome treba isplatiti razliku
 * da se neto izjednači; null kad su jednaki.
 */
export function ownerDiff(s: OwnerStats, tolerance = 1): { amount: number; ahead: UserId | null; payTo: UserId | null } {
  const d = s.nenad.net - s.jovan.net;
  if (Math.abs(d) < tolerance) return { amount: 0, ahead: null, payTo: null };
  return { amount: Math.abs(d), ahead: d > 0 ? 'nenad' : 'jovan', payTo: d > 0 ? 'jovan' : 'nenad' };
}

/** Datumi svih plata i uloga, rastuće (za granice filtera). */
export const ownerDates = (txs: SalaryLike[], contributions: ContributionLike[]) =>
  [...txs.filter(isSalary).map(t => t.date), ...contributions.map(c => c.date)].sort();

/** Poslednji mesec tekuće godine sa platom ili ulogom (za karticu na Pregledu); inače tekući mesec. */
export function latestOwnerMonth(txs: SalaryLike[], contributions: ContributionLike[], todayIso: string): string {
  const y = todayIso.slice(0, 4);
  const ds = ownerDates(txs, contributions).filter(d => d.startsWith(`${y}-`) && d <= todayIso);
  return (ds[ds.length - 1] ?? todayIso).slice(0, 7);
}

/** Pomeranje meseca (YYYY-MM) za n. */
export function shiftMonth(ym: string, n: number): string {
  const total = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Isplata „Obojici“ postaje dva unosa sa istim iznosom; sa računa se skida dvostruko. */
export function splitSalary<T extends object>(input: T, to: SalaryTarget): (T & { salaryTo: UserId })[] {
  return (to === 'oba' ? USERS : [to]).map(u => ({ ...input, salaryTo: u }));
}

/**
 * Trošak plaćen iz više izvora (račun firme, keš, novčanik vlasnika), npr. Jovan 400 € i Nenad 500 €.
 * Jedan red troška po izvoru; redovi istog plaćanja dobijaju isti `splitId`. Red koji je platio vlasnik
 * nema račun (novac nije izašao ni sa firme ni iz keša) i ima `paidBy`; baza mu sama pravi ulog tog vlasnika.
 */
export interface PayLine { accountId: string | null; owner: UserId | null; amount: number }
export type SplitRow<T> = T & { accountId: string | null; amountOriginal: number; paidBy: UserId | null; splitId: string | null };

export function splitExpense<T extends object>(base: T, lines: PayLine[], splitId: string): SplitRow<T>[] {
  const used = lines.filter(l => l.amount > 0 && (l.accountId || l.owner));
  if (!used.length) throw new Error('Izaberi ko je platio i upiši iznos.');
  return used.map(l => ({
    ...base,
    accountId: l.owner ? null : l.accountId,
    amountOriginal: Math.round(l.amount * 100) / 100,
    paidBy: l.owner,
    splitId: used.length > 1 ? splitId : null,
  }));
}

/** Slučajan UUID v4 (za split_id), bez zavisnosti od crypto API-ja telefona. */
export function newUuid(): string {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';
    else if (i === 14) s += '4';
    else if (i === 19) s += h[8 + Math.floor(Math.random() * 4)];
    else s += h[Math.floor(Math.random() * 16)];
  }
  return s;
}
