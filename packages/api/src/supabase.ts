/** Supabase adapter (web, i mobile dok je online). Jedino mesto koje zna za tabele i RPC-ove. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PoznanApi, Crud, ListOpts } from './api';
import { voiceResultSchema } from '@poznan/shared';
import { fromRow, linesToJson, toRow } from './mapping';
import type { Account, AccountBalance, Client, Company, FxRateRow, Job, Label, Photo, Supplier, Task, Transaction, Transfer, OwnerContribution, TxCategory, Profile, Settings } from './model';

class ApiError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}

type Res<T> = { data: T | null; error: { message: string; code?: string } | null };

/** Samo greška (upis bez vraćanja reda). */
function ok(res: Res<unknown>): void {
  if (res.error) throw new ApiError(res.error.message, res.error.code);
}

/** Greška ili podatak koji mora postojati. */
function check<T>(res: Res<T>): T {
  ok(res);
  if (res.data === null) throw new ApiError("Nema podataka", "empty");
  return res.data;
}

const now = () => new Date().toISOString();
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export function createSupabaseApi(sb: SupabaseClient): PoznanApi {
  const crud = <T, I>(table: string, order: string, ascending = true): Crud<T, I> => ({
    async list(opts?: ListOpts) {
      let q = sb.from(table).select('*').order(order, { ascending });
      if (!opts?.includeDeleted) q = q.is('deleted_at', null);
      return check(await q).map(r => fromRow<T>(table, r));
    },
    async get(id) {
      const res = await sb.from(table).select('*').eq('id', id).maybeSingle();
      ok(res);
      const r = res.data;
      return r ? fromRow<T>(table, r) : null;
    },
    async create(input) {
      return fromRow<T>(table, check(await sb.from(table).insert({ ...toRow(table, input as Record<string, unknown>), client_at: now() }).select().single()));
    },
    async update(id, patch) {
      return fromRow<T>(table, check(await sb.from(table).update({ ...toRow(table, patch as Record<string, unknown>), client_at: now() }).eq('id', id).select().single()));
    },
    async remove(id) {
      ok(await sb.from(table).update({ deleted_at: now(), client_at: now() }).eq('id', id));
    },
  });

  const uid = async () => {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new ApiError('Nisi prijavljen', 'auth');
    return data.user.id;
  };
  const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    const r = await sb.rpc(fn, args);
    ok(r);
    return r.data;
  };

  return {
    auth: {
      async session() {
        const { data } = await sb.auth.getSession();
        return data.session ? { userId: data.session.user.id, email: data.session.user.email ?? null } : null;
      },
      async signIn(email, password) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new ApiError('Pogrešan email ili lozinka', 'auth');
      },
      // Samo ovaj telefon; drugi uređaji istog naloga ostaju prijavljeni
      async signOut() { await sb.auth.signOut({ scope: 'local' }); },
      async requestPasswordReset(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim());
        if (error) throw new ApiError(error.status === 429 ? 'Previše zahteva. Pokušaj ponovo za par minuta.' : 'Email nije poslat', 'auth');
      },
      async resetPassword(email, code, password) {
        const v = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
        if (v.error) throw new ApiError('Kod nije ispravan ili je istekao', 'auth');
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw new ApiError(error.message.includes('different') ? 'Nova lozinka mora biti drugačija od stare' : 'Lozinka nije promenjena', 'auth');
      },
      async changePassword(current, password) {
        const { data } = await sb.auth.getUser();
        if (!data.user?.email) throw new ApiError('Nisi prijavljen', 'auth');
        const chk = await sb.auth.signInWithPassword({ email: data.user.email, password: current });
        if (chk.error) throw new ApiError('Trenutna lozinka nije tačna', 'auth');
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw new ApiError(error.message.includes('different') ? 'Nova lozinka mora biti drugačija od stare' : 'Lozinka nije promenjena', 'auth');
      },
      onChange(cb) {
        const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s ? { userId: s.user.id, email: s.user.email ?? null } : null));
        return () => data.subscription.unsubscribe();
      },
    },

    profile: {
      async me() { return fromRow<Profile>('profiles', check(await sb.from('profiles').select('*').eq('user_id', await uid()).single())); },
      async all() { return check(await sb.from('profiles').select('*').order('slug')).map(r => fromRow<Profile>('profiles', r)); },
      async update(patch) { ok(await sb.from('profiles').update(toRow('profiles', patch)).eq('user_id', await uid())); },
    },

    settings: {
      async get() { return fromRow<Settings>('settings', check(await sb.from('settings').select('*').single())); },
      async update(patch) { ok(await sb.from('settings').update(toRow('settings', patch)).eq('id', true)); },
    },

    companies: {
      ...crud<Company, never>('companies', 'name'),
      async history(companyId) {
        return check(await sb.from('company_history').select('*').eq('company_id', companyId).is('deleted_at', null).order('effective_date', { ascending: false }))
          .map(r => fromRow('company_history', r));
      },
      async changePhase(companyId, phase, date, note) {
        await rpc('change_company_phase', { p_company: companyId, p_phase: phase, p_date: date, p_note: note ?? null });
      },
    },
    clients: crud<Client, never>('clients', 'name'),
    suppliers: crud<Supplier, never>('suppliers', 'name'),
    photos: {
      async list(target, targetId) {
        const rows = check(await sb.from('photos').select('*').eq('target_type', target).eq('target_id', targetId).is('deleted_at', null).order('created_at'))
          .map(r => fromRow<Omit<Photo, 'url'>>('photos', r));
        if (!rows.length) return [];
        const signed = check(await sb.storage.from('photos').createSignedUrls(rows.map(r => r.storagePath), 3600));
        return rows.map((r, i) => ({ ...r, url: signed[i]?.signedUrl ?? '' }));
      },
      async add(target, targetId, file) {
        const ext = file.contentType === 'image/png' ? 'png' : file.contentType === 'image/webp' ? 'webp' : 'jpg';
        const path = `${target}/${targetId}/${newId()}.${ext}`;
        ok(await sb.storage.from('photos').upload(path, file.data, { contentType: file.contentType }));
        const row = await sb.from('photos').insert({ target_type: target, target_id: targetId, storage_path: path, client_at: now() }).select().single();
        // Bez reda u tabeli fajl ne treba da ostane
        if (row.error) { await sb.storage.from('photos').remove([path]); ok(row); }
        const p = fromRow<Omit<Photo, 'url'>>('photos', check(row));
        const s = await sb.storage.from('photos').createSignedUrl(path, 3600);
        return { ...p, url: s.data?.signedUrl ?? '' };
      },
      async remove(id) {
        const r = check(await sb.from('photos').update({ deleted_at: now(), client_at: now() }).eq('id', id).select('storage_path').single()) as { storage_path: string };
        await sb.storage.from('photos').remove([r.storage_path]);
      },
    },
    labels: crud<Label, never>('labels', 'name'),
    txCategories: crud<TxCategory, never>('tx_categories', 'sort'),
    jobs: {
      ...crud<Job, never>('jobs', 'start_date'),
      async pending(jobId) {
        return check(await sb.from('job_pending_items').select('*').eq('job_id', jobId).is('deleted_at', null)).map(r => fromRow('job_pending_items', r));
      },
      async finish(jobId, lines, comment) { await rpc('finish_job', { p_job: jobId, p_lines: linesToJson(lines), p_comment: comment ?? null }); },
      async awaitPayment(jobId, lines, comment) { await rpc('set_job_awaiting_payment', { p_job: jobId, p_lines: linesToJson(lines), p_comment: comment ?? null }); },
      async markPaid(jobId) { await rpc('mark_job_paid', { p_job: jobId }); },
      async addReminder(jobId, at, to, note) {
        ok(await sb.from('job_reminders').insert({ job_id: jobId, remind_at: at, audience: to, note: note ?? null, client_at: now() }));
      },
    },
    tasks: crud<Task, never>('tasks', 'due'),
    transactions: {
      ...crud<Transaction, never>('transactions', 'date', false),
      async list(f = {}) {
        let q = sb.from('transactions').select('*').is('deleted_at', null).order('date', { ascending: false });
        if (f.from) q = q.gte('date', f.from);
        if (f.to) q = q.lte('date', f.to);
        if (f.companyId === null) q = q.is('company_id', null);
        else if (f.companyId) q = q.eq('company_id', f.companyId);
        if (f.jobId) q = q.eq('job_id', f.jobId);
        if (f.clientId) q = q.eq('client_id', f.clientId);
        if (f.supplierId) q = q.eq('supplier_id', f.supplierId);
        return check(await q).map(r => fromRow<Transaction>('transactions', r));
      },
      async createMany(inputs) {
        // Jedan insert = jedna transakcija u bazi (oba reda ili nijedan)
        const rows = inputs.map(i => ({ ...toRow('transactions', i as Record<string, unknown>), client_at: now() }));
        return check(await sb.from('transactions').insert(rows).select()).map(r => fromRow<Transaction>('transactions', r));
      },
    },
    ownerContributions: {
      ...crud<OwnerContribution, never>('owner_contributions', 'date', false),
      async list(f = {}) {
        let q = sb.from('owner_contributions').select('*').is('deleted_at', null).order('date', { ascending: false });
        if (f.from) q = q.gte('date', f.from);
        if (f.to) q = q.lte('date', f.to);
        return check(await q).map(r => fromRow<OwnerContribution>('owner_contributions', r));
      },
    },
    accounts: {
      async list() { return check(await sb.from('accounts').select('*').is('deleted_at', null).order('name')).map(r => fromRow<Account>('accounts', r)); },
      async balances() { return check(await sb.from('account_balances').select('*')).map(r => fromRow<AccountBalance>('account_balances', r)); },
      async setOpening(accountId, openingBalance, openingDate) {
        ok(await sb.from('accounts').update({ opening_balance: openingBalance, opening_date: openingDate || null, client_at: now() }).eq('id', accountId));
      },
    },
    transfers: {
      ...crud<Transfer, never>('transfers', 'date', false),
      async list(f = {}) {
        let q = sb.from('transfers').select('*').is('deleted_at', null).order('date', { ascending: false });
        if (f.from) q = q.gte('date', f.from);
        if (f.to) q = q.lte('date', f.to);
        if (f.accountId) q = q.or(`from_account_id.eq.${f.accountId},to_account_id.eq.${f.accountId}`);
        return check(await q).map(r => fromRow<Transfer>('transfers', r));
      },
    },
    fx: {
      async latest() {
        const r = await sb.from('fx_rates').select('date, eur, usd').order('date', { ascending: false }).limit(1).maybeSingle();
        ok(r);
        return r.data ? fromRow<FxRateRow>('fx_rates', r.data) : null;
      },
      async forDate(date) {
        const r = await sb.from('fx_rates').select('date, eur, usd').lte('date', date).order('date', { ascending: false }).limit(1).maybeSingle();
        ok(r);
        return r.data ? fromRow<FxRateRow>('fx_rates', r.data) : null;
      },
    },
    invoices: {
      async assign(kind, id) { return (await rpc('assign_invoice_no', { p_kind: kind, p_id: id })) as string; },
    },
    comments: {
      async list(target, targetId) {
        return check(await sb.from('comments').select('*').eq('target_type', target).eq('target_id', targetId).is('deleted_at', null).order('created_at'))
          .map(r => fromRow('comments', r));
      },
      async add(target, targetId, text, parentId) {
        return fromRow('comments', check(await sb.from('comments').insert({ target_type: target, target_id: targetId, text, parent_id: parentId ?? null, client_at: now() }).select().single()));
      },
      async remove(id) { ok(await sb.from('comments').update({ deleted_at: now() }).eq('id', id)); },
    },
    notifications: {
      async unread() {
        return check(await sb.from('notifications').select('*').is('read_at', null).order('created_at', { ascending: false })).map(r => fromRow('notifications', r));
      },
      async seen(limit = 100) {
        return check(await sb.from('notifications').select('*').not('read_at', 'is', null).order('created_at', { ascending: false }).limit(limit)).map(r => fromRow('notifications', r));
      },
      async markRead(ids) { if (ids.length) ok(await sb.from('notifications').update({ read_at: now() }).in('id', ids)); },
      async markAllRead() { ok(await sb.from('notifications').update({ read_at: now() }).is('read_at', null)); },
      async registerPushToken(token, platform) {
        ok(await sb.from('push_tokens').upsert({ user_id: await uid(), token, platform }, { onConflict: 'user_id,token' }));
      },
      async unregisterPushToken(token) { ok(await sb.from('push_tokens').delete().eq('token', token)); },
      async markReadFor(target, targetId) {
        ok(await sb.from('notifications').update({ read_at: now() }).eq('target_type', target).eq('target_id', targetId).is('read_at', null));
      },
    },
    audit: {
      async list(o = {}) {
        let q = sb.from('audit_log').select('*').order('at', { ascending: false }).limit(o.limit ?? 200);
        if (o.table) q = q.eq('table_name', o.table);
        if (o.rowId) q = q.eq('row_id', o.rowId);
        return check(await q).map(r => fromRow('audit_log', r));
      },
    },
    voice: {
      async parse(text, context) {
        const { data, error } = await sb.functions.invoke('voice-parse', { body: { text, context } });
        if (error) {
          // Poruka funkcije ({ error }) umesto opšte greške
          let msg = 'Obrada komande nije uspela. Proveri internet i probaj ponovo.';
          try { const b = await (error as { context?: Response }).context?.json(); if (b?.error) msg = b.error; } catch { /* ostaje opšta poruka */ }
          throw new ApiError(msg, 'voice');
        }
        return voiceResultSchema.parse(data);
      },
    },
    subscribe(onChange) {
      const ch = sb.channel('poznan-changes').on('postgres_changes', { event: '*', schema: 'public' }, p => onChange(p.table)).subscribe();
      return () => { void sb.removeChannel(ch); };
    },
  };
}
