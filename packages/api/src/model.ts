/** Redovi kako ih vide ekrani (camelCase). Adapter prevodi iz/u kolone baze. */
import type {
  Assignee, BusinessForm, ClientKind, CommentTarget, CompanyIcon, CompanyPhase, HistoryKind, JobStatus, TaskStatus, TxType, UserId,
} from '@poznan/shared';
import type { NotificationPrefs } from '@poznan/shared';

interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Company extends Base {
  name: string; form: BusinessForm; phase: CompanyPhase; address: string | null; pib: string | null; mb: string | null;
  activity: string | null; founded: string | null; notes: string | null; icon: CompanyIcon; logoPath: string | null;
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
export interface Job extends Base {
  clientId: string; labelId: string | null; assignee: Assignee; startDate: string | null; startTime: string | null;
  status: JobStatus; endDate: string | null; description: string | null; workAddress: string | null; workCity: string | null;
  paymentComment: string | null;
}
export interface PendingItem extends Base { jobId: string; companyId: string | null; amount: number; description: string | null; invoiceNo: string | null }
export interface Appointment extends Base {
  date: string; startTime: string | null; endTime: string | null; clientId: string | null; jobId: string | null;
  labelId: string | null; title: string | null; assignee: Assignee; status: TaskStatus; notes: string | null;
}
export interface Task extends Base {
  title: string; assignee: Assignee; dueDate: string | null; status: TaskStatus; doneAt: string | null; doneBy: string | null;
  jobId: string | null; note: string | null;
}
export interface Comment extends Base { target: CommentTarget; targetId: string; parentId: string | null; userId: string; text: string }
export interface Transaction extends Base {
  type: TxType; amount: number; date: string; companyId: string | null; clientId: string | null; jobId: string | null;
  category: string; vat: number; description: string | null; earnedBy: UserId | null; invoiceNo: string | null;
}
export interface Notification {
  id: string; createdAt: string; fromUser: string | null; type: string; target: CommentTarget | null; targetId: string | null;
  commentId: string | null; text: string | null; readAt: string | null;
}
export interface Profile { userId: string; slug: UserId; name: string; theme: 'light' | 'dark' | 'system'; barColors: Record<string, number>; notif: NotificationPrefs }
export interface Settings { pausalLimit: number; pdvThreshold: number; warnPct: number; critPct: number; backupEveryDays: number }
export interface AuditEntry { id: number; userId: string | null; table: string; rowId: string | null; action: 'insert' | 'update' | 'delete'; old: unknown; new: unknown; at: string; clientAt: string | null }
