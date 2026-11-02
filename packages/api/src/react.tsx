/** React sloj: ApiProvider + hookovi. Isti kod na webu (Next.js) i mobilnom (Expo). */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientInput, Currency, JobInput, OwnerContributionInput, PaymentLine, TaskInput, TransactionInput, TransferInput } from '@poznan/shared';
import type { PoznanApi, TxFilter } from './api';
import { keys, tablesToRefresh } from './keys';
import type { Comment, Profile } from './model';

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

export const useProfiles = () => { const a = useApi(); return useQuery({ queryKey: keys.profiles, queryFn: () => a.profile.all() }); };
export const useAccounts = () => { const a = useApi(); return useQuery({ queryKey: keys.accounts, queryFn: () => a.accounts.list() }); };
/** Stanje svih računa (firme + keš) za brojač na naslovnoj. */
export const useBalances = () => { const a = useApi(); return useQuery({ queryKey: keys.balances, queryFn: () => a.accounts.balances() }); };
export const useTransfers = (f: { from?: string; to?: string; accountId?: string } = {}) => { const a = useApi(); return useQuery({ queryKey: keys.transfers(f), queryFn: () => a.transfers.list(f) }); };
/** Poslednji srednji kurs NBS; osvežava se na sat. */
export const useFxLatest = () => { const a = useApi(); return useQuery({ queryKey: keys.fx, queryFn: () => a.fx.latest(), staleTime: 3_600_000 }); };

export function useCreateTransaction() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: (v: TransactionInput) => a.transactions.create(v), onSuccess: () => refresh('transactions') });
}

/** Više unosa odjednom (plata „Obojici“). */
export function useCreateTransactions() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: (v: TransactionInput[]) => a.transactions.createMany(v), onSuccess: () => refresh('transactions') });
}

export function useUpdateTransaction() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: (v: { id: string; patch: Partial<TransactionInput> }) => a.transactions.update(v.id, v.patch), onSuccess: () => refresh('transactions') });
}

export const useOwnerContributions = (f: { from?: string; to?: string } = {}) => { const a = useApi(); return useQuery({ queryKey: keys.ownerContributions(f), queryFn: () => a.ownerContributions.list(f) }); };

export function useCreateOwnerContribution() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: (v: OwnerContributionInput) => a.ownerContributions.create(v), onSuccess: () => refresh('owner_contributions') });
}

export function useCreateJob() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: (v: JobInput) => a.jobs.create(v), onSuccess: () => refresh('jobs') });
}

export function useCreateTask() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: (v: TaskInput) => a.tasks.create(v), onSuccess: () => refresh('tasks') });
}

export function useCreateClient() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: (v: ClientInput) => a.clients.create(v), onSuccess: () => refresh('clients') });
}

export function useCreateTransfer() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: (v: TransferInput) => a.transfers.create(v), onSuccess: () => refresh('transfers') });
}

export function useSetOpeningBalance() {
  const a = useApi(), refresh = useRefresh();
  return useMutation({ mutationFn: (v: { accountId: string; amount: number; date: string }) => a.accounts.setOpening(v.accountId, v.amount, v.date), onSuccess: () => refresh('accounts') });
}

/** Valuta prikaza (EUR podrazumevano), pamti se po nalogu; promena se vidi odmah. */
export function useSetCurrency() {
  const a = useApi(), qc = useQueryClient();
  return useMutation({
    mutationFn: (currency: Currency) => a.profile.update({ currency }),
    onMutate: currency => qc.setQueryData<Profile>(keys.profile, p => (p ? { ...p, currency } : p)),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.profile }),
  });
}
