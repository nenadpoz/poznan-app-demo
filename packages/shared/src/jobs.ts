/** Poslovi: status, početak, naplata, „Čeka uplatu“, podsetnici. */
import type { JobStatus } from './constants';

export interface JobLike {
  id: string;
  status: JobStatus;
  startDate: string | null;
  startTime: string | null; // HH:MM, opciono
}

/** Podrazumevani status novog posla: budući početak je „Na čekanju“, inače „U procesu“. */
export const defaultJobStatus = (startDate: string | null, todayIso: string): JobStatus =>
  startDate && startDate > todayIso ? 'cekanje' : 'proces';

/** Posao je počeo kad prođe datum početka; ako je upisano vreme, tek kad dođe to vreme tog dana. */
export function hasStarted(job: Pick<JobLike, 'startDate' | 'startTime'>, todayIso: string, nowHHMM: string): boolean {
  if (!job.startDate || job.startDate > todayIso) return false;
  if (job.startDate < todayIso || !job.startTime) return true;
  return nowHHMM >= job.startTime;
}

/** Ključ za „već pitan“: menja se ako se promeni datum ili vreme početka, pa se pita ponovo. */
export const startPromptKey = (job: Pick<JobLike, 'startDate' | 'startTime'>) => `${job.startDate ?? ''}${job.startTime ?? ''}`;

/**
 * Posao za koji treba pitati „Posao je počeo, prebaci u U procesu?“.
 * `asked` je mapa jobId → startPromptKey za korisnika (pita se jednom po nalogu).
 */
export function nextStartPrompt<J extends JobLike>(jobs: J[], asked: Record<string, string>, todayIso: string, nowHHMM: string): J | undefined {
  return jobs
    .filter(j => j.status === 'cekanje' && hasStarted(j, todayIso, nowHHMM) && asked[j.id] !== startPromptKey(j))
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0];
}

/** Redosled liste poslova: u procesu, na čekanju, čeka uplatu, pa završeni; unutar grupe po početku. */
const ORDER: Record<JobStatus, number> = { proces: 0, cekanje: 1, uplata: 2, zavrseno: 3 };
export function sortJobs<J extends JobLike>(jobs: J[]): J[] {
  return [...jobs].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'));
}

/** Stavka naplate: keš (companyId = null) ili firma, sa iznosom i opisom. */
export interface PaymentLine {
  companyId: string | null;
  amount: number;
  description: string;
}

export type PaymentError = { kind: 'empty' } | { kind: 'amount'; companyId: string | null } | { kind: 'duplicate'; companyId: string | null };

/** Proverava naplatu: bar jedna stavka, svaki iznos > 0, svaka firma (ili keš) najviše jednom. */
export function validatePayment(lines: PaymentLine[]): PaymentError | null {
  if (!lines.length) return { kind: 'empty' };
  const seen = new Set<string>();
  for (const l of lines) {
    if (!(l.amount > 0)) return { kind: 'amount', companyId: l.companyId };
    const k = l.companyId ?? 'kes';
    if (seen.has(k)) return { kind: 'duplicate', companyId: l.companyId };
    seen.add(k);
  }
  return null;
}

export const paymentTotal = (lines: Pick<PaymentLine, 'amount'>[]) => lines.reduce((s, l) => s + l.amount, 0);

/** Opis naplate na kartici: „Drill 100.000 · Trans 10.000 · keš 200.000“. */
export function paymentSummary(lines: PaymentLine[], companyShortName: (id: string) => string, fmt: (n: number) => string): string {
  return lines.map(l => `${l.companyId ? companyShortName(l.companyId) : 'keš'} ${fmt(l.amount)}`).join(' · ');
}

/** Dozvoljeni prelazi statusa posla. „Završeno“ uvek ide preko naplate (ili „bez naplate“). */
export function canMoveJob(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return false;
  if (from === 'zavrseno') return to === 'proces' || to === 'cekanje'; // vraćanje iz arhive
  return true;
}

export interface Reminder {
  at: string; // ISO datum i vreme
  to: 'me' | 'both';
  note: string;
  firedAt: string | null;
}

/** Podsetnici za uplatu koji su dospeli, a nisu poslati. */
export const dueReminders = <R extends Reminder>(list: R[], nowIso: string) => list.filter(r => !r.firedAt && r.at <= nowIso);
