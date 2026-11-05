/** Zadaci: grupisanje po roku i filteri (Osobe, Statusi). */
import type { Assignee, TaskStatus, UserId } from './constants';

export interface TaskLike {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  assignee: Assignee;
}

export type TaskGroup = 'kasni' | 'danas' | 'uskoro' | 'kasnije' | 'bez_roka' | 'zavrseno';
export const TASK_GROUP_LABELS: Record<TaskGroup, string> = {
  kasni: 'Kasni', danas: 'Danas', uskoro: 'Narednih 7 dana', kasnije: 'Kasnije', bez_roka: 'Bez roka', zavrseno: 'Završeno',
};

export function taskGroup(t: Pick<TaskLike, 'status' | 'dueDate'>, todayIso: string, in7Iso: string): TaskGroup {
  if (t.status === 'zavrseno') return 'zavrseno';
  if (!t.dueDate) return 'bez_roka';
  if (t.dueDate < todayIso) return 'kasni';
  if (t.dueDate === todayIso) return 'danas';
  if (t.dueDate <= in7Iso) return 'uskoro';
  return 'kasnije';
}

export interface TaskFilter {
  person: 'svi' | UserId;
  statuses: TaskStatus[]; // prazno = svi
}

/** Filter „Osobe“: zadatak za obojicu se vidi kod oba vlasnika. */
export function filterTasks<T extends TaskLike>(list: T[], f: TaskFilter): T[] {
  return list.filter(
    t => (f.person === 'svi' || t.assignee === f.person || t.assignee === 'oba') && (!f.statuses.length || f.statuses.includes(t.status)),
  );
}

// ---------- Podsetnici zadatka ----------
// Zadatak sa rokom može imati jedan ili više podsetnika (datum i vreme). Podsetnik stiže kao push osobi koja je
// zadužena (obojici kad je zadatak za oba). Na dan roka u 06:00 stiže podsetnik i kad nijedan nije dodat.
// Dan posle roka, ako zadatak nije završen, stiže pitanje da li je završen (završi ili promeni rok).

/** Vreme podrazumevanog podsetnika na dan roka. */
export const DEFAULT_TASK_REMINDER_TIME = '06:00';
export const MAX_TASK_REMINDERS = 10;

/** Kraj dana roka (ponoć posle roka, lokalno vreme). Podsetnik mora biti pre toga. */
export function taskDueEnd(dueIso: string): Date {
  const [y, m, d] = dueIso.split('-').map(Number);
  return new Date(y!, m! - 1, d! + 1);
}

/** Lokalni datum i vreme (GGGG-MM-DD, HH:MM) u trenutak. */
export function localDateTime(dateIso: string, hhmm: string): Date {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y!, m! - 1, d!, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)));
}

/** Greška za jedan podsetnik ili null: ne sme u prošlost ni posle roka. */
export function taskReminderError(at: Date, dueIso: string | null, now: Date): string | null {
  if (!dueIso) return 'Za podsetnik prvo izaberi rok.';
  if (at.getTime() < now.getTime()) return 'Podsetnik ne može biti u prošlosti.';
  if (at.getTime() >= taskDueEnd(dueIso).getTime()) return 'Podsetnik ne može biti posle roka.';
  return null;
}

/**
 * Provera svih podsetnika pri čuvanju. Novi (kojih nije bilo) ne smeju u prošlost; nijedan ne sme posle roka.
 * Već poslati (u prošlosti) ostaju kao istorija.
 */
export function taskRemindersError(list: string[], before: string[], dueIso: string | null, now: Date): string | null {
  if (!list.length) return null;
  if (list.length > MAX_TASK_REMINDERS) return `Najviše ${MAX_TASK_REMINDERS} podsetnika.`;
  for (const iso of list) {
    const at = new Date(iso);
    const sent = before.includes(iso) && at.getTime() < now.getTime();
    const err = sent ? taskReminderError(at, dueIso, new Date(0)) : taskReminderError(at, dueIso, now);
    if (err) return err;
  }
  return null;
}

/** Tekst podsetnika: „Ostalo je još 2 dana do završetka zadatka „Organizovati bager““. `days` je broj dana do roka. */
export function taskReminderText(title: string, days: number): string {
  if (days <= 0) return `Danas je rok za zadatak „${title}“`;
  const one = days % 10 === 1 && days % 100 !== 11;
  return one ? `Ostao je još ${days} dan do završetka zadatka „${title}“` : `Ostalo je još ${days} dana do završetka zadatka „${title}“`;
}

/** Rok je prošao, a zadatak nije završen: pitanje „da li je završen“. */
export const isTaskOverdue = (t: Pick<TaskLike, 'status' | 'dueDate'>, todayIso: string) => t.status !== 'zavrseno' && !!t.dueDate && t.dueDate < todayIso;
