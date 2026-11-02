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
