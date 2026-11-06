/**
 * Glasovna komanda: izdiktiran (i ispravljen) tekst čita AI (Edge Function `voice-parse`) i vraća nameru i polja.
 * Aplikacija otvara popunjenu formu; ništa se ne čuva bez potvrde.
 * AI dobija samo tekst, datum i nazive firmi i kategorija. Imena klijenata se ne šalju, nego se ovde porede na telefonu (`matchClient`).
 */
import { z } from 'zod';
import { CURRENCIES } from './currency';
import { USERS } from './constants';

const s = z.string().trim().nullable().optional().transform(v => (v ? v : null));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().catch(null).transform(v => v ?? null);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional().catch(null).transform(v => v ?? null);
const who = z.enum([...USERS, 'oba']).nullable().optional().catch(null).transform(v => v ?? null);

export const VOICE_INTENTS = ['klijent', 'posao', 'zadatak', 'promet', 'nepoznato'] as const;
export type VoiceIntent = (typeof VOICE_INTENTS)[number];

export const voiceResultSchema = z.object({
  intent: z.enum(VOICE_INTENTS).catch('nepoznato'),
  client: z.object({
    kind: z.enum(['fizicko', 'pravno']).nullable().optional().catch(null).transform(v => v ?? null),
    name: s, phone: s, email: s, address: s, city: s, pib: s, mb: s, contactPerson: s, note: s,
  }).nullable().optional().transform(v => v ?? null),
  job: z.object({
    clientName: s, description: s, label: s, date, startTime: time, endTime: time, address: s, city: s, assignee: who,
  }).nullable().optional().transform(v => v ?? null),
  task: z.object({ title: s, note: s, dueDate: date, assignee: who }).nullable().optional().transform(v => v ?? null),
  tx: z.object({
    type: z.enum(['prihod', 'trosak']).nullable().optional().catch(null).transform(v => v ?? null),
    amount: z.number().positive().nullable().optional().catch(null).transform(v => v ?? null),
    currency: z.enum(CURRENCIES).nullable().optional().catch(null).transform(v => v ?? null),
    /** Id firme iz spiska; null = keš ili nije rečeno. */
    companyId: s,
    cash: z.boolean().nullable().optional().catch(null).transform(v => v ?? null),
    category: s, clientName: s, note: s, date,
  }).nullable().optional().transform(v => v ?? null),
});
export type VoiceResult = z.infer<typeof voiceResultSchema>;

/** Šta aplikacija šalje funkciji uz tekst. */
export interface VoiceContext {
  today: string;
  companies: { id: string; name: string }[];
  categoriesIn: string[];
  categoriesOut: string[];
  jobLabels: string[];
}

/** Mala slova, bez kvačica, jedan razmak („Đorđević“ → „djordjevic“). */
export function foldName(v: string): string {
  return v.toLowerCase().replace(/đ/g, 'dj').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Postojeći klijent po izgovorenom imenu: isto ime, pa isto ime i početak prezimena (padež: „Petrovića“),
 * pa jedini klijent sa tim prezimenom. Ako ih je više mogućih, vraća null (bira se ručno).
 */
export function matchClient<T extends { name: string }>(spoken: string | null | undefined, clients: readonly T[]): T | null {
  if (!spoken) return null;
  const q = foldName(spoken);
  if (!q) return null;
  const list = clients.map(c => ({ c, n: foldName(c.name) }));
  const exact = list.filter(x => x.n === q);
  if (exact.length === 1) return exact[0]!.c;
  // Ista reč u drugom padežu: razlika najviše dva slova na kraju („Marka“ / „Marko“, „Petrovića“ / „Petrović“)
  const close = (a: string, b: string) => {
    if (Math.abs(a.length - b.length) > 2) return false;
    let k = 0;
    while (k < a.length && a[k] === b[k]) k++;
    return k >= Math.max(3, Math.min(a.length, b.length) - 2);
  };
  const words = q.split(' ');
  const one = (xs: typeof list) => (xs.length === 1 ? xs[0]!.c : null);
  if (words.length > 1) {
    const byWords = list.filter(x => {
      const ws = x.n.split(' ');
      return words.length <= ws.length && words.every((w, i) => close(w, ws[i]!));
    });
    if (byWords.length) return one(byWords);
  }
  // Naziv firme („Agro Drina“ za „Agro Drina DOO“)
  const contains = list.filter(x => x.n.includes(q));
  if (contains.length) return one(contains);
  // Samo prezime
  const last = words[words.length - 1]!;
  return one(list.filter(x => x.n.split(' ').slice(1).some(w => close(w, last))));
}

/** Telefon iz diktata: samo cifre (i + na početku), „+381 64…“ ostaje, „064 543-43-34“ → „0645434334“. */
export function normalizePhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  const d = t.replace(/\D/g, '');
  if (d.length < 6) return null;
  return t.startsWith('+') ? `+${d}` : d;
}
