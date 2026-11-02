/** React sloj: ApiProvider + hookovi. Isti kod na webu (Next.js) i mobilnom (Expo). */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaymentLine } from '@poznan/shared';
import type { PoznanApi, TxFilter } from './api';
import { keys, tablesToRefresh } from './keys';
import type { Comment } from './model';

const Ctx = createContext<PoznanApi | null>(null);

export function ApiProvider({ api, children }: { api: PoznanApi; children: ReactNode }) {
  const qc = useQueryClient();
  // Izmene sa drugog uređaja osvežavaju upite
  useEffect(() => api.subscribe(t => tablesToRefresh(t).forEach(k => void qc.invalidateQueries({ queryKey: [k] }))), [api, qc]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApi(): PoznanApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useApi mora biti unutar <ApiProvider>');
  return api;
}

const useRefresh = () => {
  const qc = useQueryClient();
  return (table: string) => Promise.all(tablesToRefresh(table).map(k => qc.invalidateQueries({ queryKey: [k] })));
};

export const useCompanies = () => { const a = useApi(); return useQuery({ queryKey: keys.companies, queryFn: () => a.companies.list() }); };
export const useCompanyHistory = (id: string) => { const a = useApi(); return useQuery({ queryKey: keys.companyHistory(id), queryFn: () => a.companies.history(id) }); };
export const useClients = () => { const a = useApi(); return useQuery({ queryKey: keys.clients, queryFn: () => a.clients.list() }); };
export const useLabels = () => { const a = useApi(); return useQuery({ queryKey: keys.labels, queryFn: () => a.labels.list() }); };
export const useJobs = () => { const a = useApi(); return useQuery({ queryKey: keys.jobs, queryFn: () => a.jobs.list() }); };
export const useJob = (id: string) => { const a = useApi(); return useQuery({ queryKey: keys.job(id), queryFn: () => a.jobs.get(id) }); };
export const usePending = (jobId: string) => { const a = useApi(); return useQuery({ queryKey: keys.pending(jobId), queryFn: () => a.jobs.pending(jobId) }); };
export const useAppointments = () => { const a = useApi(); return useQuery({ queryKey: keys.appointments, queryFn: () => a.appointments.list() }); };
export const useTasks = () => { const a = useApi(); return useQuery({ queryKey: keys.tasks, queryFn: () => a.tasks.list() }); };
export const useTransactions = (f: TxFilter = {}) => { const a = useApi(); return useQuery({ queryKey: keys.transactions(f), queryFn: () => a.transactions.list(f) }); };
export const useComments = (t: Comment['target'], id: string) => { const a = useApi(); return useQuery({ queryKey: keys.comments(t, id), queryFn: () => a.comments.list(t, id) }); };
export const useUnreadNotifications = () => { const a = useApi(); return useQuery({ queryKey: keys.notifications, queryFn: () => a.notifications.unread() }); };
export const useSettings = () => { const a = useApi(); return useQuery({ queryKey: keys.settings, queryFn: () => a.settings.get() }); };
export const useProfile = () => { const a = useApi(); return useQuery({ queryKey: keys.profile, queryFn: () => a.profile.me() }); };

/** Naplata posla: završavanje, „Čeka uplatu“, „Uplaćeno“. */
export function useJobPayment() {
  const a = useApi(), refresh = useRefresh();
  const done = () => refresh('jobs');
  return {
    finish: useMutation({ mutationFn: (v: { jobId: string; lines: PaymentLine[]; comment?: string | null }) => a.jobs.finish(v.jobId, v.lines, v.comment), onSuccess: done }),
    awaitPayment: useMutation({ mutationFn: (v: { jobId: string; lines: PaymentLine[]; comment?: string | null }) => a.jobs.awaitPayment(v.jobId, v.lines, v.comment), onSuccess: done }),
    markPaid: useMutation({ mutationFn: (jobId: string) => a.jobs.markPaid(jobId), onSuccess: done }),
  };
}

export function useAddComment(target: Comment['target'], targetId: string) {
  const a = useApi(), refresh = useRefresh();
  return useMutation({
    mutationFn: (v: { text: string; parentId?: string | null }) => a.comments.add(target, targetId, v.text, v.parentId),
    onSuccess: () => refresh('comments'),
  });
}

export function useMarkAllRead() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: () => a.notifications.markAllRead(), onSuccess: () => refresh('notifications') });
}
