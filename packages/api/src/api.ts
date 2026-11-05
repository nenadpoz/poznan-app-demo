/**
 * Ugovor koji ekrani koriste. Web ga dobija preko Supabase adaptera (online),
 * mobile preko lokalnog adaptera nad SQLite/PowerSync (offline), sa istim potpisima.
 */
import type {
  ClientInput, CompanyInput, JobInput, OwnerContributionInput, SupplierInput, TaskInput, TransactionInput, TransferInput, TxCategoryInput,
} from '@poznan/shared';
import type { PaymentLine, PhotoTarget } from '@poznan/shared';
import type {
  Account, AccountBalance, FxRateRow, Transfer, AuditEntry, Client, Comment, Company, CompanyHistoryItem, Job, Label, Notification, OwnerContribution, PendingItem, TxCategory, Profile, Settings, Photo, Supplier, Task, Transaction,
} from './model';

export interface ListOpts { includeDeleted?: boolean }
export interface TxFilter { from?: string; to?: string; companyId?: string | null; jobId?: string; clientId?: string; supplierId?: string }

export interface Crud<T, I> {
  list(opts?: ListOpts): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: I): Promise<T>;
  update(id: string, patch: Partial<I>): Promise<T>;
  /** Meko brisanje (deleted_at), zbog offline sinhronizacije. */
  remove(id: string): Promise<void>;
}

export interface PoznanApi {
  auth: {
    session(): Promise<{ userId: string; email: string | null } | null>;
    signIn(email: string, password: string): Promise<void>;
    signOut(): Promise<void>;
    /** Šalje email sa kodom za reset lozinke. Ne otkriva da li nalog postoji. */
    requestPasswordReset(email: string): Promise<void>;
    /** Kod iz emaila + nova lozinka; posle toga je korisnik prijavljen. */
    resetPassword(email: string, code: string, password: string): Promise<void>;
    /** Promena lozinke prijavljenog korisnika; traži trenutnu lozinku. */
    changePassword(current: string, password: string): Promise<void>;
    /** Javlja prijavu i odjavu (i istek sesije). Vraća funkciju za odjavu slušaoca. */
    onChange(cb: (session: { userId: string; email: string | null } | null) => void): () => void;
  };
  profile: { me(): Promise<Profile>; all(): Promise<Profile[]>; update(patch: Partial<Omit<Profile, 'userId' | 'slug'>>): Promise<void> };
  settings: { get(): Promise<Settings>; update(patch: Partial<Settings>): Promise<void> };

  companies: Crud<Company, CompanyInput> & {
    history(companyId: string): Promise<CompanyHistoryItem[]>;
    changePhase(companyId: string, phase: Company['phase'], date: string, note?: string | null): Promise<void>;
  };
  clients: Crud<Client, ClientInput>;
  /** Saradnici (od koga kupujemo ili tražimo uslugu). */
  suppliers: Crud<Supplier, SupplierInput>;
  labels: Crud<Label, { name: string; color: number }>;
  /** Kategorije prometa (prihodi i troškovi). */
  txCategories: Crud<TxCategory, TxCategoryInput>;
  jobs: Crud<Job, JobInput> & {
    pending(jobId: string): Promise<PendingItem[]>;
    /** „Završeno“: upisuje prihod za svaku stavku; prazna lista = „Završi bez naplate“. */
    finish(jobId: string, lines: PaymentLine[], comment?: string | null): Promise<void>;
    awaitPayment(jobId: string, lines: PaymentLine[], comment?: string | null): Promise<void>;
    markPaid(jobId: string): Promise<void>;
    addReminder(jobId: string, at: string, to: 'me' | 'both', note?: string | null): Promise<void>;
  };
  tasks: Crud<Task, TaskInput>;
  transactions: Omit<Crud<Transaction, TransactionInput>, 'list'> & {
    list(f?: TxFilter): Promise<Transaction[]>;
    /** Više unosa odjednom (npr. plata „Obojici“): sve ili ništa. */
    createMany(inputs: TransactionInput[]): Promise<Transaction[]>;
  };
  /** Ulozi vlasnika; povećavaju stanje računa, nisu prihod. */
  ownerContributions: Omit<Crud<OwnerContribution, OwnerContributionInput>, 'list'> & { list(f?: { from?: string; to?: string }): Promise<OwnerContribution[]> };
  /** Računi firmi i zaliha keša. Stanje računa računa baza (view account_balances). */
  accounts: {
    list(): Promise<Account[]>;
    balances(): Promise<AccountBalance[]>;
    /** Početno stanje od datuma; bez datuma (null) u stanje ulazi sav promet. */
    setOpening(accountId: string, openingBalance: number, openingDate: string | null): Promise<void>;
  };
  /** Podizanje keša sa računa ili polaganje na račun; nije prihod ni trošak. */
  transfers: Omit<Crud<Transfer, TransferInput>, 'list'> & { list(f?: { from?: string; to?: string; accountId?: string }): Promise<Transfer[]> };
  /** Srednji kurs NBS (1 EUR = x RSD). */
  fx: { latest(): Promise<FxRateRow | null>; forDate(date: string): Promise<FxRateRow | null> };
  invoices: { assign(kind: 'transaction' | 'pending', id: string): Promise<string> };
  /** Slike: dodavanje (jedna po pozivu) i uklanjanje. Mobile šalje već smanjenu sliku (JPEG). */
  photos: {
    list(target: PhotoTarget, targetId: string): Promise<Photo[]>;
    add(target: PhotoTarget, targetId: string, file: { data: ArrayBuffer; contentType: string }): Promise<Photo>;
    remove(id: string): Promise<void>;
  };
  comments: {
    list(target: Comment['target'], targetId: string): Promise<Comment[]>;
    add(target: Comment['target'], targetId: string, text: string, parentId?: string | null): Promise<Comment>;
    remove(id: string): Promise<void>;
  };
  notifications: {
    unread(): Promise<Notification[]>;
    /** Već viđena (pročitana) obaveštenja, najnovije prvo (poslednjih `limit`, podrazumevano 100). */
    seen(limit?: number): Promise<Notification[]>;
    markRead(ids: string[]): Promise<void>;
    markAllRead(): Promise<void>;
    markReadFor(target: Comment['target'], targetId: string): Promise<void>;
    /** Push token telefona (Expo); jedan nalog može imati više telefona. */
    registerPushToken(token: string, platform: 'android' | 'ios' | 'web'): Promise<void>;
    unregisterPushToken(token: string): Promise<void>;
  };
  audit: { list(opts?: { table?: string; rowId?: string; limit?: number }): Promise<AuditEntry[]> };
  /** Javlja izmene sa drugog uređaja (Realtime na webu, sync na mobilnom), da se osveže upiti. */
  subscribe(onChange: (table: string) => void): () => void;
}
