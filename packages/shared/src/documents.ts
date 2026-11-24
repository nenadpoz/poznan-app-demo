/**
 * Dokumentacija (zahtev 21. nov 2026.): dokument sa jednim fajlom (PDF, PNG, JPG), datumom isteka, opisom i komentarima.
 * Podsetnik za istek je zadatak vezan za dokument: rok je dan isteka, zadužena osoba se bira, a podrazumevani
 * podsetnik je mesec dana pre isteka (u 08:00). Dodatni podsetnici se dodaju kao kod zadatka.
 */
export const DOC_TYPES = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' } as const;
export type DocContentType = keyof typeof DOC_TYPES;
/** Najveći fajl dokumenta (20 MB). */
export const MAX_DOC_BYTES = 20 * 1024 * 1024;
/** Koliko dana pre isteka dokument je „uskoro ističe“ (kao podrazumevani podsetnik). */
export const DOC_SOON_DAYS = 30;

/** Vrsta fajla iz MIME tipa ili naziva (telefon ponekad ne javi tip). null = nije dozvoljeno. */
export function docContentType(mime: string | null | undefined, fileName?: string | null): DocContentType | null {
  const m = (mime ?? '').toLowerCase();
  if (m === 'application/pdf') return 'application/pdf';
  if (m === 'image/png') return 'image/png';
  if (m === 'image/jpeg' || m === 'image/jpg') return 'image/jpeg';
  const ext = (fileName ?? '').toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return null;
}
export const isPdf = (t: string | null | undefined) => t === 'application/pdf';

/** Datum (YYYY-MM-DD) mesec dana ranije; kraj meseca se skraćuje (31. mart → 28. ili 29. februar). */
export function monthBefore(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return `${py}-${String(pm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** Podrazumevani podsetnik: mesec dana pre isteka; null ako je taj dan danas ili prošao (ostaje podsetnik na dan roka). */
export function docDefaultReminder(expiresOn: string | null | undefined, today: string): string | null {
  if (!expiresOn) return null;
  const d = monthBefore(expiresOn);
  return d > today ? d : null;
}

/** Naziv zadatka koji prati istek dokumenta. */
export const docTaskTitle = (name: string) => `Ističe dokument: ${name.trim()}`;

const dayNum = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 864e5;

/** Stanje isteka za listu: istekao, uskoro (do 30 dana), važi, bez isteka; tekst za prikaz. */
export function docExpiry(expiresOn: string | null | undefined, today: string): { level: 'expired' | 'soon' | 'ok' | 'none'; days: number | null; text: string } {
  if (!expiresOn) return { level: 'none', days: null, text: 'Bez datuma isteka' };
  const days = dayNum(expiresOn) - dayNum(today);
  if (days < 0) return { level: 'expired', days, text: `Istekao pre ${-days} ${-days % 10 === 1 && -days % 100 !== 11 ? 'dan' : 'dana'}` };
  if (days === 0) return { level: 'soon', days, text: 'Ističe danas' };
  const t = `Ističe za ${days} ${days % 10 === 1 && days % 100 !== 11 ? 'dan' : 'dana'}`;
  return { level: days <= DOC_SOON_DAYS ? 'soon' : 'ok', days, text: t };
}

/** Veličina fajla za prikaz: „850 KB“, „2,4 MB“. */
export function fmtBytes(n: number | null | undefined): string {
  if (!n || n < 0) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Najviše fajlova odjednom pri dodavanju u kolekciju. */
export const MAX_COLLECTION_BATCH = 30;

/** Naziv fajla bez ekstenzije za prikaz („Osnove geologije 1.pdf“ → „Osnove geologije 1“). */
export const fileTitle = (fileName: string) => fileName.replace(/\.(pdf|png|jpe?g)$/i, '').trim() || fileName;

/** Redosled u kolekciji: po nazivu, sa brojevima kao brojevima („Deo 2“ pre „Deo 10“). */
export const sortByName = <T extends { name: string }>(list: T[]) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'sr', { numeric: true, sensitivity: 'base' }));

/** Link u kolekciji: dodaje https:// ako nedostaje; null ako nije ispravna adresa. */
export function normalizeUrl(input: string | null | undefined): string | null {
  const t = (input ?? '').trim();
  if (!t || /\s/.test(t)) return null;
  const u = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return /^https?:\/\/[^/\s]+\.[^/\s]+/i.test(u) ? u : null;
}

/** Naziv linka za prikaz kad nije upisan: domen („youtube.com“). */
export const linkTitle = (url: string) => url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0] || url;
