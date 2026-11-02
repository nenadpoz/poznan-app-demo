/** Formatiranje za srpski UI: iznosi `1.234.567 RSD`, datumi `21. okt 2026.` */

export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'] as const;
export const MONTHS_FULL = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'] as const;
export const DAYS_SHORT = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned'] as const;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Ceo broj sa tačkom kao separatorom hiljada. Negativni dobijaju znak minus (−). */
export function money(n: number): string {
  const r = Math.round(n);
  const s = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return r < 0 ? `−${s}` : s;
}

export const rsd = (n: number) => `${money(n)} RSD`;

/** Čita iznos koji je korisnik upisao: „1.234.567“, „1234,50“, „ 12 000 “. Neispravno daje 0. */
export function parseAmount(input: string | null | undefined): number {
  const s = String(input ?? '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** ISO datum (YYYY-MM-DD) u `21. okt 2026.`; prazno daje „—“. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}. ${MONTHS_SHORT[(m ?? 1) - 1]} ${y}.`;
}

export const fmtTime = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** `1. nov 2026. u 13:50` (lokalno vreme). */
export const fmtDateTime = (d: Date) => `${fmtDate(toIsoDate(d))} u ${fmtTime(d)}`;

/** Lokalni datum u ISO obliku YYYY-MM-DD. */
export const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Dodaje dane na ISO datum (bez vremenskih zona). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/** Broj dana od `a` do `b` (b − a). */
export function diffDays(a: string, b: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 864e5);
}

/** Dan u nedelji, ponedeljak = 0. */
export function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7;
}

/** Množina za „posao“: 1 posao, 2 posla, 5 poslova, 21 posao. */
export function plural(n: number, one: string, few: string, many: string): string {
  const d = n % 10, h = n % 100;
  if (d === 1 && h !== 11) return `${n} ${one}`;
  if (d >= 2 && d <= 4 && !(h >= 12 && h <= 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}
