/** Ključevi upita. Izmena u tabeli osvežava sve upite te tabele (i povezane). */
export const keys = {
  companies: ['companies'] as const,
  company: (id: string) => ['companies', id] as const,
  companyHistory: (id: string) => ['company_history', id] as const,
  clients: ['clients'] as const,
  suppliers: ['suppliers'] as const,
  photos: (target: string, id: string) => ['photos', target, id] as const,
  labels: ['labels'] as const,
  txCategories: ['tx_categories'] as const,
  jobs: ['jobs'] as const,
  job: (id: string) => ['jobs', id] as const,
  pending: (jobId: string) => ['job_pending_items', jobId] as const,
  tasks: ['tasks'] as const,
  transactions: (f: object = {}) => ['transactions', f] as const,
  comments: (target: string, id: string) => ['comments', target, id] as const,
  notifications: ['notifications'] as const,
  notificationsSeen: ['notifications', 'seen'] as const,
  settings: ['settings'] as const,
  accounts: ['accounts'] as const,
  balances: ['account_balances'] as const,
  transfers: (f: object = {}) => ['transfers', f] as const,
  ownerContributions: (f: object = {}) => ['owner_contributions', f] as const,
  fx: ['fx_rates'] as const,
  profile: ['profiles', 'me'] as const,
  profiles: ['profiles'] as const,
  audit: (o: object = {}) => ['audit_log', o] as const,
};

/** Koje tabele treba osvežiti kad se promeni data tabela (npr. završen posao upisuje promet). */
export const RELATED: Record<string, string[]> = {
  jobs: ['jobs', 'job_pending_items', 'transactions', 'account_balances'],
  job_pending_items: ['job_pending_items', 'jobs'],
  // Svaka promena novca osvežava brojač stanja na naslovnoj
  // Trošak vlasnika pravi i ulog; unos drugog vlasnika pravi obaveštenje
  transactions: ['transactions', 'account_balances', 'owner_contributions', 'notifications'],
  transfers: ['transfers', 'account_balances'],
  owner_contributions: ['owner_contributions', 'account_balances'],
  accounts: ['accounts', 'account_balances'],
  companies: ['companies', 'company_history', 'accounts', 'account_balances'],
  comments: ['comments', 'notifications'],
};

export const tablesToRefresh = (table: string) => [...new Set([table, ...(RELATED[table] ?? []), 'audit_log'])];
