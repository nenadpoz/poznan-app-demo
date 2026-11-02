/** Zod šeme za forme i API. Iste se koriste na mobile i web strani. */
import { z } from 'zod';
import { CURRENCIES } from './currency';
import { BUSINESS_FORMS, CLIENT_KINDS, COMPANY_ICONS, COMPANY_PHASES, JOB_STATUSES, TASK_STATUSES, TX_TYPES, USERS } from './constants';

const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum nije ispravan');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Vreme nije ispravno');
const text = (max = 200) => z.string().trim().max(max);
const optText = (max = 200) => text(max).optional().nullable().transform(v => (v ? v : null));
const id = z.string().min(1);

export const userId = z.enum(USERS);
export const assignee = z.enum([...USERS, 'oba']);

export const companySchema = z.object({
  name: text(80).min(1, 'Unesi naziv firme'),
  form: z.enum(keys(BUSINESS_FORMS)),
  pib: optText(9).refine(v => !v || /^\d{9}$/.test(v), 'PIB ima 9 cifara'),
  mb: optText(8).refine(v => !v || /^\d{8}$/.test(v), 'Matični broj ima 8 cifara'),
  activity: optText(120),
  address: optText(160),
  icon: z.enum(keys(COMPANY_ICONS)).default('building'),
  logoPath: optText(300),
});
export type CompanyInput = z.infer<typeof companySchema>;

/** Promena faze: uvek sa tačnim datumom i opcionim komentarom. */
export const phaseChangeSchema = z.object({
  companyId: id,
  phase: z.enum(keys(COMPANY_PHASES)),
  date: isoDate,
  comment: optText(500),
});

export const clientSchema = z
  .object({
    kind: z.enum(keys(CLIENT_KINDS)),
    name: text(120).min(1, 'Unesi ime ili naziv'),
    phone: optText(40),
    email: optText(120).refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email nije ispravan'),
    address: optText(160),
    city: optText(80),
    pib: optText(9),
    mb: optText(8),
    contactPerson: optText(120),
    note: optText(1000),
  })
  .refine(c => c.kind === 'pravno' || (!c.pib && !c.mb), { message: 'PIB i MB su samo za pravna lica', path: ['pib'] });
export type ClientInput = z.infer<typeof clientSchema>;

export const jobSchema = z.object({
  clientId: id,
  labelId: id.nullable().optional(),
  description: optText(2000),
  workAddress: optText(200), // adresa posla (za navigaciju), može se razlikovati od adrese klijenta
  startDate: isoDate.nullable(),
  startTime: hhmm.nullable().optional(),
  assignee: assignee.default('oba'),
  status: z.enum(keys(JOB_STATUSES)),
});
export type JobInput = z.infer<typeof jobSchema>;

export const paymentLineSchema = z.object({
  companyId: id.nullable(), // null = keš
  amount: z.number().positive('Unesi iznos'),
  description: text(200),
});

/** Naplata pri završavanju posla ili prelazu u „Čeka uplatu“. */
export const jobPaymentSchema = z
  .object({
    jobId: id,
    lines: z.array(paymentLineSchema).min(1, 'Izaberi bar jedan način naplate'),
    comment: optText(1000),
  })
  .refine(p => new Set(p.lines.map(l => l.companyId ?? 'kes')).size === p.lines.length, { message: 'Svaka firma samo jednom', path: ['lines'] });

export const reminderSchema = z.object({
  jobId: id,
  at: z.string().datetime({ offset: true }),
  to: z.enum(['me', 'both']),
  note: optText(300),
});

export const appointmentSchema = z.object({
  clientId: id,
  date: isoDate,
  time: hhmm.nullable().optional(),
  note: optText(1000),
  status: z.enum(keys(TASK_STATUSES)).default('cekanje'),
});

/** Zadatak nema klijenta; opciono je vezan za posao. */
export const taskSchema = z.object({
  title: text(200).min(1, 'Unesi naziv zadatka'),
  note: optText(2000),
  dueDate: isoDate.nullable(),
  assignee: assignee.default('oba'),
  jobId: id.nullable().optional(),
  status: z.enum(keys(TASK_STATUSES)).default('cekanje'),
});
export type TaskInput = z.infer<typeof taskSchema>;

export const commentSchema = z.object({
  target: z.enum(['task', 'job', 'company']),
  targetId: id,
  parentId: id.nullable().optional(), // odgovor na komentar
  text: text(2000).min(1, 'Komentar je prazan'),
});

/**
 * Promet. `accountId` je račun firme ili zaliha keša (odakle novac izlazi ili gde ulazi);
 * firma se izvodi iz računa. Iznos se unosi u izabranoj valuti, baza računa dinare po kursu tog dana.
 */
export const transactionSchema = z.object({
  type: z.enum(keys(TX_TYPES)),
  amountOriginal: z.number().positive('Iznos mora biti veći od 0'),
  currency: z.enum(CURRENCIES),
  accountId: id,
  date: isoDate,
  clientId: id.nullable().optional(),
  jobId: id.nullable().optional(),
  category: text(60).min(1),
  description: optText(300),
  vat: z.number().min(0).max(100).default(0),
  earnedBy: userId.nullable().optional(),
});
export type TransactionInput = z.infer<typeof transactionSchema>;

/** Prenos između računa: podizanje keša sa računa firme ili polaganje keša na račun. */
export const transferSchema = z
  .object({
    fromAccountId: id,
    toAccountId: id,
    amountOriginal: z.number().positive('Iznos mora biti veći od 0'),
    currency: z.enum(CURRENCIES),
    date: isoDate,
    note: optText(300),
  })
  .refine(t => t.fromAccountId !== t.toAccountId, { message: 'Izaberi dva različita računa', path: ['toAccountId'] });
export type TransferInput = z.infer<typeof transferSchema>;

export const timeWindowSchema = z.object({ from: hhmm, to: hhmm });
export const notificationPrefsSchema = z.object({
  push: z.boolean(),
  email: z.boolean(),
  pushWin: timeWindowSchema,
  emailWin: timeWindowSchema,
});

export const settingsSchema = z
  .object({
    pausalLimit: z.number().int().positive(),
    pdvThreshold: z.number().int().positive(),
    warnPct: z.number().min(1).max(100),
    critPct: z.number().min(1).max(100),
  })
  .refine(s => s.warnPct < s.critPct, { message: 'Upozorenje mora biti pre kritičnog nivoa', path: ['warnPct'] });

/** Glasovna komanda vraća samo predlog forme; čuvanje uvek ide kroz potvrdu korisnika. */
export const voiceDraftSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('transaction'), draft: transactionSchema.partial() }),
  z.object({ kind: z.literal('task'), draft: taskSchema.partial() }),
  z.object({ kind: z.literal('job'), draft: jobSchema.partial() }),
]);
