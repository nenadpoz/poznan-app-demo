/** Ključevi upita. Izmena u tabeli osvežava sve upite te tabele (i povezane). */
export const keys = {
  companies: ['companies'] as const,
  company: (id: string) => ['companies', id] as const,
  companyHistory: (id: string) => ['company_history', id] as const,
  clients: ['clients'] as const,
  labels: ['labels'] as const,
  jobs: ['jobs'] as const,
  job: (id: string) => ['jobs', id] as const,
  pending: (jobId: string) => ['job_pending_items', jobId] as const,
  appointments: ['appointments'] as const,
  tasks: ['tasks'] as const,
  transactions: (f: object = {}) => ['transactions', f] as const,
  comments: (target: string, id: string) => ['comments', target, id] as const,
  notifications: ['notifications'] as const,
  settings: ['settings'] as const,
  profile: ['profiles', 'me'] as const,
  profiles: ['profiles'] as const,
  audit: (o: object = {}) => ['audit_log', o] as const,
};

/** Koje tabele treba osvežiti kad se promeni data tabela (npr. završen posao upisuje promet). */
export const RELATED: Record<string, string[]> = {
  jobs: ['jobs', 'job_pending_items', 'transactions'],
  job_pending_items: ['job_pending_items', 'jobs'],
  transactions: ['transactions'],
  companies: ['companies', 'company_history'],
  comments: ['comments', 'notifications'],
};

export const tablesToRefresh = (table: string) => [...new Set([table, ...(RELATED[table] ?? []), 'audit_log'])];
