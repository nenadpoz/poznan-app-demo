/** Obaveštenja: kanali (push, email) i vremenski prozori po korisniku. */
import type { Channel, UserId } from './constants';

export interface TimeWindow {
  from: string; // HH:MM
  to: string;
}
export interface NotificationPrefs {
  push: boolean;
  email: boolean;
  pushWin: TimeWindow;
  emailWin: TimeWindow;
}

export const DEFAULT_WINDOWS: Record<Channel, TimeWindow> = { push: { from: '07:00', to: '21:00' }, email: { from: '08:00', to: '20:00' } };
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { push: true, email: false, pushWin: DEFAULT_WINDOWS.push, emailWin: DEFAULT_WINDOWS.email };

/** Da li je HH:MM unutar prozora. Prozor preko ponoći (22:00–06:00) je podržan. */
export function inWindow(hhmm: string, w: TimeWindow): boolean {
  if (w.from === w.to) return true;
  return w.from < w.to ? hhmm >= w.from && hhmm < w.to : hhmm >= w.from || hhmm < w.to;
}

/** Sledeći trenutak (HH:MM) kad se šalje: odmah ako je u prozoru, inače na početku prozora. */
export const deliverAt = (hhmm: string, w: TimeWindow) => (inWindow(hhmm, w) ? hhmm : w.from);

/** Kanali kojima obaveštenje ide sada; ostali čekaju početak svog prozora. */
export function channelsNow(prefs: NotificationPrefs, hhmm: string): Channel[] {
  const out: Channel[] = [];
  if (prefs.push && inWindow(hhmm, prefs.pushWin)) out.push('push');
  if (prefs.email && inWindow(hhmm, prefs.emailWin)) out.push('email');
  return out;
}

/** Komentar ide svima osim autoru. */
export const recipients = (all: readonly UserId[], author: UserId) => all.filter(u => u !== author);

/** Broj na zvoncu; 0 se ne prikazuje (vraća null). */
export const badgeCount = (list: { read: boolean }[]) => {
  const n = list.filter(x => !x.read).length;
  return n > 0 ? (n > 99 ? '99+' : String(n)) : null;
};
