/** snake_case ↔ camelCase, plus izuzeci gde se ime polja razlikuje od kolone. */

const RENAMES: Record<string, Record<string, string>> = {
  tasks: { due: 'dueDate', notes: 'note' },
  comments: { target_type: 'target' },
  notifications: { target_type: 'target' },
  audit_log: { table_name: 'table' },
};

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const snake = (s: string) => s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
const NUMERIC = new Set(['amount', 'amount_original', 'fx_rate', 'eur', 'balance', 'opening_balance', 'vat', 'pausal_limit', 'pdv_threshold', 'warn_pct', 'crit_pct', 'monthly_fee']);

export function fromRow<T>(table: string, row: Record<string, unknown>): T {
  const ren = RENAMES[table] ?? {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'deleted_at' || k === 'updated_by' || k === 'client_at') continue;
    // PostgREST vraća numeric kao string kad je veliki; ekrani rade sa brojem
    out[ren[k] ?? camel(k)] = NUMERIC.has(k) && typeof v === 'string' ? Number(v) : v;
  }
  return out as T;
}

export function toRow(table: string, input: Record<string, unknown>): Record<string, unknown> {
  const ren = Object.fromEntries(Object.entries(RENAMES[table] ?? {}).map(([col, field]) => [field, col]));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) out[ren[k] ?? snake(k)] = v;
  return out;
}

/** Stavke naplate u oblik koji očekuju RPC-ovi finish_job / set_job_awaiting_payment. */
export const linesToJson = (lines: { companyId: string | null; amount: number; description: string }[]) =>
  lines.map(l => ({ company_id: l.companyId, amount: l.amount, description: l.description }));
