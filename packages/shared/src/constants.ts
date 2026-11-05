/** Šifarnici iz demoa. Ključevi se čuvaju u bazi, nazivi su za UI. */

export const USERS = ['nenad', 'jovan'] as const;
export type UserId = (typeof USERS)[number];

export const BUSINESS_FORMS = { pausal: 'Paušal', pdv: 'Preduzetnik u PDV-u', van_pdv: 'Preduzetnik van PDV-a', doo: 'DOO' } as const;
export type BusinessForm = keyof typeof BUSINESS_FORMS;

/** Faze firme, redosledom. Prva faza je „Neaktivna“ (nema faze „Osnivanje“). */
export const COMPANY_PHASES = { neaktivna: 'Neaktivna', aktivna: 'Aktivna', mirovanje: 'U mirovanju', zatvorena: 'Zatvorena' } as const;
export type CompanyPhase = keyof typeof COMPANY_PHASES;
/** „Otvorene“ firme na tabu Firme: sve osim zatvorenih. */
export const isCompanyOpen = (phase: CompanyPhase) => phase !== 'zatvorena';

export const COMPANY_ICONS = { building: 'Zgrada', drill: 'Bušilica', truck: 'Kamion', wrench: 'Alat', briefcase: 'Aktovka', home: 'Kuća' } as const;
export type CompanyIcon = keyof typeof COMPANY_ICONS;

export const CLIENT_KINDS = { fizicko: 'Fizičko lice', pravno: 'Pravno lice' } as const;
export type ClientKind = keyof typeof CLIENT_KINDS;

/** Posao ima i „Čeka uplatu“ (rad završen, novac još nije stigao). Zadaci nemaju. */
export const JOB_STATUSES = { cekanje: 'Na čekanju', proces: 'U procesu', uplata: 'Čeka uplatu', zavrseno: 'Završeno' } as const;
export type JobStatus = keyof typeof JOB_STATUSES;

export const TASK_STATUSES = { cekanje: 'Na čekanju', proces: 'U procesu', zavrseno: 'Završeno' } as const;
export type TaskStatus = keyof typeof TASK_STATUSES;

/** Ko radi posao / kome je zadatak: jedan od vlasnika ili obojica (podrazumevano). */
export type Assignee = UserId | 'oba';

export const TX_TYPES = { prihod: 'Prihod', trosak: 'Trošak' } as const;
export type TxType = keyof typeof TX_TYPES;

export const CATEGORIES_IN = ['Usluga', 'Prodaja robe', 'Održavanje', 'Ostalo'] as const;
/** Kategorija za isplatu plate se postavlja sama; nije u listi za izbor. */
export const SALARY_CATEGORY = 'Plata';
/** Isplata plate: jednom vlasniku ili obojici (dva unosa sa istim iznosom). */
export const SALARY_TARGETS = { nenad: 'Nenad', jovan: 'Jovan', oba: 'Obojica' } as const;
export type SalaryTarget = keyof typeof SALARY_TARGETS;

export const CATEGORIES_OUT = ['Materijal', 'Gorivo', 'Knjigovođa', 'Porez i doprinosi', 'Oprema', 'Zakup', 'Alat', 'Ostalo'] as const;

/** Šta može da se komentariše. */
export const COMMENT_TARGETS = ['task', 'job', 'company', 'transaction', 'transfer', 'contribution'] as const;
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

/** Slike: uz klijenta, saradnika, posao i zadatak. */
export const PHOTO_TARGETS = ['client', 'supplier', 'job', 'task'] as const;
export type PhotoTarget = (typeof PHOTO_TARGETS)[number];
/** Najviše slika po stavci i najveća veličina jedne slike (posle smanjenja na telefonu). */
export const MAX_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export const NOTIFICATION_TYPES = ['comment', 'reply', 'reminder', 'job_start', 'task_due', 'task_assigned', 'limit', 'tx_income', 'tx_expense', 'tx_transfer', 'tx_contribution', 'tx_edit', 'tx_delete', 'task_reminder', 'task_overdue'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const CHANNELS = ['push', 'email'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Vrsta stavke u istoriji firme. */
export const HISTORY_KINDS = ['phase', 'form', 'edit'] as const;
export type HistoryKind = (typeof HISTORY_KINDS)[number];
