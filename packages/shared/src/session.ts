/**
 * Automatska odjava posle nekorišćenja: kad je od poslednjeg korišćenja počeo novi dan (i prošlo bar 30 minuta),
 * ili kad aplikacija nije korišćena 24 sata. Dok se aplikacija koristi, odjava se ne dešava.
 * Posle odjave se prijavljuje lozinkom ili biometrijom (otisak prsta, lice).
 */
import { toIsoDate } from './format';

export const AUTO_LOGOUT_MIN_IDLE_MIN = 30;
export const AUTO_LOGOUT_MAX_IDLE_H = 24;

export function shouldAutoLogout(lastActive: Date | null, now: Date): boolean {
  if (!lastActive) return false;
  const idleMin = (now.getTime() - lastActive.getTime()) / 60_000;
  if (idleMin < AUTO_LOGOUT_MIN_IDLE_MIN) return false;
  return idleMin >= AUTO_LOGOUT_MAX_IDLE_H * 60 || toIsoDate(lastActive) !== toIsoDate(now);
}
