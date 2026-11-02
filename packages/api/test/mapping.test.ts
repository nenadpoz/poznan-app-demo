import { describe, expect, it } from 'vitest';
import { fromRow, linesToJson, tablesToRefresh, toRow } from '../src';

describe('mapping', () => {
  it('kolone u polja i nazad', () => {
    const t = fromRow<Record<string, unknown>>('tasks', { id: '1', due: '2026-11-05', notes: 'x', job_id: 'j', deleted_at: null, updated_by: 'u' });
    expect(t).toEqual({ id: '1', dueDate: '2026-11-05', note: 'x', jobId: 'j' });
    expect(toRow('tasks', { dueDate: '2026-11-05', note: 'x', jobId: null, title: undefined })).toEqual({ due: '2026-11-05', notes: 'x', job_id: null });
  });
  it('numeric iz stringa u broj', () => {
    expect(fromRow<{ amount: number }>('transactions', { amount: '100000.00' }).amount).toBe(100000);
  });
  it('stavke naplate za RPC', () => {
    expect(linesToJson([{ companyId: null, amount: 5, description: 'Bunar' }])).toEqual([{ company_id: null, amount: 5, description: 'Bunar' }]);
  });
  it('završen posao osvežava i promet', () => {
    expect(tablesToRefresh('jobs')).toEqual(['jobs', 'job_pending_items', 'transactions', 'account_balances', 'audit_log']);
  });
});

describe('računi i valuta', () => {
  it('stanje i kurs iz stringa u broj', () => {
    expect(fromRow<{ balance: number; openingBalance: number }>('account_balances', { balance: '315000.00', opening_balance: '250000.00' })).toEqual({ balance: 315000, openingBalance: 250000 });
    expect(fromRow<{ eur: number }>('fx_rates', { eur: '117.5367' }).eur).toBe(117.5367);
  });
  it('promet i prenos osvežavaju brojač stanja', () => {
    expect(tablesToRefresh('transactions')).toContain('account_balances');
    expect(tablesToRefresh('transfers')).toContain('account_balances');
    expect(toRow('transactions', { amountOriginal: 50, accountId: 'a' })).toEqual({ amount_original: 50, account_id: 'a' });
  });
});
