/** Redovi kako ih vide ekrani (camelCase). Adapter prevodi iz/u kolone baze. */
import type {
  Assignee, BusinessForm, ClientKind, CommentTarget, CompanyIcon, CompanyPhase, HistoryKind, JobStatus, TaskStatus, TxType, UserId,
} from '@poznan/shared';
import type { AccountKind, Currency, NotificationPrefs } from '@poznan/shared';

interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company extends Base {
  name: string; legalName: string | null; shortName: string | null; form: BusinessForm; phase: CompanyPhase; address: string | null; pib: string | null; mb: string | null;
  activity: string | null; founded: string | null; monthlyFee: number | null; notes: string | null; icon: CompanyIcon; logoPath: string | null;
}
export interface CompanyHistoryItem extends Base {
  companyId: string; kind: HistoryKind; fromValue: string | null; toValue: string | null;
  changes: { field: string; from: string; to: string }[] | null; effectiveDate: string; note: string | null;
}
export interface Client extends Base {
  kind: ClientKind; name: string; pib: string | null; mb: string | null; contactPerson: string | null;
  city: string | null; address: string | null; phone: string | null; email: string | null; note: string | null;
}
export interface Label extends Base { name: string; color: number }
/** Kategorija prometa; unos čuva naziv. */
export interface TxCategory extends Base { type: TxType; name: string; sort: number }
export interface Job extends Base {
  clientId: string; labelId: string | null; assignee: Assignee; startDate: string | null; startTime: string | null;
  /** Kalendar prikazuje poslove; vreme kraja je opciono. */
  endTime: string | null;
  status: JobStatus; endDate: string | null; description: string | null; workAddress: string | null; workCity: string | null;
  paymentComment: string | null;
}
export interface PendingItem extends Base { jobId: string; companyId: string | null; amount: number; description: string | null; invoiceNo: string | null }
export interface Task extends Base {
  title: string; assignee: Assignee; dueDate: string | null; status: TaskStatus; doneAt: string | null; doneBy: string | null;
  jobId: string | null; note: string | null;
  /** Podsetnici (ISO); na dan roka u 06:00 stiže i podrazumevani. */
  reminders: string[];
}
export interface Comment extends Base { target: CommentTarget; targetId: string; parentId: string | null; userId: string; text: string }
export interface Transaction extends Base {
  type: TxType; amount: number; date: string; companyId: string | null; clientId: string | null; jobId: string | null;
  category: string; vat: number; description: string | null; earnedBy: UserId | null; invoiceNo: string | null;
  /** Račun firme ili keš (null kad je trošak platio vlasnik); `amount` je u dinarima, `amountOriginal` u valuti unosa. */
  accountId: string | null; currency: Currency; amountOriginal: number; fxRate: number; createdBy: string | null;
  /** Isplata plate vlasniku (trošak, kategorija „Plata“). */
  salaryTo: UserId | null;
  /** Trošak plaćen iz novčanika vlasnika (uz njega postoji ulog) i id plaćanja iz više izvora. */
  paidBy: UserId | null; splitId: string | null;
  /** Čeka da se doda klijent („Podseti me kasnije“). */
  pendingClient: boolean;
}
/** Ulog vlasnika: sopstveni novac na račun firme ili u keš. `amount` je u dinarima.
 * Ulog uz trošak koji je vlasnik platio nema račun (stanje se ne menja). */
export interface OwnerContribution extends Base {
  owner: UserId; accountId: string | null; amount: number; currency: Currency; amountOriginal: number; fxRate: number;
  date: string; note: string | null; createdBy: string | null;
  /** Ulog nastao uz trošak koji je vlasnik platio (menja se kroz taj trošak). */
  transactionId: string | null;
}
export interface Account extends Base { kind: AccountKind; companyId: string | null; name: string; openingBalance: number; openingDate: string | null }
export interface AccountBalance { accountId: string; kind: AccountKind; companyId: string | null; name: string; openingBalance: number; balance: number; changedAt: string | null }
export interface Transfer extends Base {
  fromAccountId: string; toAccountId: string; amount: number; currency: Currency; amountOriginal: number; fxRate: number;
  date: string; note: string | null; createdBy: string | null;
}
export interface FxRateRow { date: string; eur: number }
export interface Notification {
  id: string; createdAt: string; fromUser: string | null; type: string;
  /** Na šta se odnosi (dodir otvara tu stavku); `transaction` = prihod ili trošak, `transfer` = prenos, `contribution` = ulog. */
  target: CommentTarget | 'transaction' | 'transfer' | 'contribution' | null; targetId: string | null;
  commentId: string | null; text: string | null; readAt: string | null;
}
export interface Profile { userId: string; slug: UserId; name: string; theme: 'light' | 'dark' | 'system'; barColors: Record<string, number>; notif: NotificationPrefs; currency: Currency }
export interface Settings { pausalLimit: number; pdvThreshold: number; warnPct: number; critPct: number; backupEveryDays: number }
export interface AuditEntry { id: number; userId: string | null; table: string; rowId: string | null; action: 'insert' | 'update' | 'delete'; old: unknown; new: unknown; at: string; clientAt: string | null }
