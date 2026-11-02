/**
 * Ugovor koji ekrani koriste. Web ga dobija preko Supabase adaptera (online),
 * mobile preko lokalnog adaptera nad SQLite/PowerSync (offline), sa istim potpisima.
 */
import type {
  ClientInput, CompanyInput, JobInput, TaskInput, TransactionInput, TransferInput,
} from '@poznan/shared';
import type { PaymentLine } from '@poznan/shared';
import type {
  Account, AccountBalance, FxRateRow, Transfer, AuditEntry, Appointment, Client, Comment, Company, CompanyHistoryItem, Job, Label, Notification, PendingItem, Profile, Settings, Task, Transaction,
} from './model';

export interface ListOpts { includeDeleted?: boolean }
export interface TxFilter { from?: string; to?: string; companyId?: string | null; jobId?: string; clientId?: string }

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
    session(): Promise<{ userId: string } | null>;
    signIn(email: string, password: string): Promise<void>;
    signOut(): Promise<void>;
    /** Javlja prijavu i odjavu (i istek sesije). Vraća funkciju za odjavu slušaoca. */
    onChange(cb: (session: { userId: string } | null) => void): () => void;
  };
  profile: { me(): Promise<Profile>; all(): Promise<Profile[]>; update(patch: Partial<Omit<Profile, 'userId' | 'slug'>>): Promise<void> };
  settings: { get(): Promise<Settings>; update(patch: Partial<Settings>): Promise<void> };

  companies: Crud<Company, CompanyInput> & {
    history(companyId: string): Promise<CompanyHistoryItem[]>;
    changePhase(companyId: string, phase: Company['phase'], date: string, note?: string | null): Promise<void>;
  };
  clients: Crud<Client, ClientInput>;
  labels: Crud<Label, { name: string; color: number }>;
  jobs: Crud<Job, JobInput> & {
    pending(jobId: string): Promise<PendingItem[]>;
    /** „Završeno“: upisuje prihod za svaku stavku; prazna lista = „Završi bez naplate“. */
    finish(jobId: string, lines: PaymentLine[], comment?: string | null): Promise<void>;
    awaitPayment(jobId: string, lines: PaymentLine[], comment?: string | null): Promise<void>;
    markPaid(jobId: string): Promise<void>;
    addReminder(jobId: string, at: string, to: 'me' | 'both', note?: string | null): Promise<void>;
  };
  appointments: Crud<Appointment, Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>>;
  tasks: Crud<Task, TaskInput>;
  transactions: Omit<Crud<Transaction, TransactionInput>, 'list'> & { list(f?: TxFilter): Promise<Transaction[]> };
  /** Računi firmi i zaliha keša. Stanje računa računa baza (view account_balances). */
  accounts: {
    list(): Promise<Account[]>;
    balances(): Promise<AccountBalance[]>;
    setOpening(accountId: string, openingBalance: number, openingDate: string): Promise<void>;
  };
  /** Podizanje keša sa računa ili polaganje na račun; nije prihod ni trošak. */
  transfers: Omit<Crud<Transfer, TransferInput>, 'list'> & { list(f?: { from?: string; to?: string; accountId?: string }): Promise<Transfer[]> };
  /** Srednji kurs NBS (1 EUR = x RSD). */
  fx: { latest(): Promise<FxRateRow | null>; forDate(date: string): Promise<FxRateRow | null> };
  invoices: { assign(kind: 'transaction' | 'pending', id: string): Promise<string> };
  comments: {
    list(target: Comment['target'], targetId: string): Promise<Comment[]>;
    add(target: Comment['target'], targetId: string, text: string, parentId?: string | null): Promise<Comment>;
    remove(id: string): Promise<void>;
  };
  notifications: {
    unread(): Promise<Notification[]>;
    markRead(ids: string[]): Promise<void>;
    markAllRead(): Promise<void>;
    markReadFor(target: Comment['target'], targetId: string): Promise<void>;
  };
  audit: { list(opts?: { table?: string; rowId?: string; limit?: number }): Promise<AuditEntry[]> };
  /** Javlja izmene sa drugog uređaja (Realtime na webu, sync na mobilnom), da se osveže upiti. */
  subscribe(onChange: (table: string) => void): () => void;
}
