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
