// Edge Function: šalje obaveštenja na telefon (Expo push) iz tabele notifications (outbox).
// Pokreće je baza (okidač pri novom obaveštenju i pg_cron svakog minuta) sa service_role ključem iz Vault-a.
// Ne prima podatke spolja: samo obradi redove koji čekaju.
//
// Za svakog primaoca poštuje lična podešavanja (profiles.notif): push uključen, vreme slanja (od–do,
// po vremenu u Srbiji; van vremena se odlaže do početka) i vrste događaja (početak posla, zadaci, limit).
// Email još nije povezan (nema servisa za slanje), pa se email deo označava kao preskočen.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Win = { from: string; to: string };
type Prefs = { push?: boolean; pushWin?: Win; ev?: Record<string, boolean> };
type Notif = { id: string; to_user: string; from_user: string | null; type: string; target_type: string | null; target_id: string | null; text: string | null };

const TZ = 'Europe/Belgrade';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/** Trenutno vreme u Srbiji kao HH:MM. */
const nowHHMM = () => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const inWindow = (t: string, w: Win) => (w.from === w.to ? true : w.from < w.to ? t >= w.from && t < w.to : t >= w.from || t < w.to);
/** Za koliko minuta počinje prozor (za odlaganje). */
function minutesUntil(from: string, now: string): number {
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const d = m(from) - m(now);
  return d > 0 ? d : d + 1440;
}
/** Vrsta obaveštenja → podešavanje „Šta šaljemo“ (komentari i podsetnici idu uvek). */
const EVENT: Record<string, string | null> = { comment: null, reply: null, reminder: null, job_start: 'start', task_due: 'tasks', task_assigned: 'tasks', limit: 'limit', tx_income: 'promet', tx_expense: 'promet', tx_transfer: 'promet', tx_contribution: 'promet', tx_edit: 'promet', tx_delete: 'promet' };

function titleOf(n: Notif, from: string): string {
  switch (n.type) {
    case 'comment': return `${from} je komentarisao`;
    case 'reply': return `${from} je odgovorio`;
    case 'reminder': return 'Podsetnik za uplatu';
    case 'job_start': return 'Posao počinje';
    case 'task_due': return 'Zadatak za danas';
    case 'task_assigned': return `${from} ti je dodelio zadatak`;
    case 'limit': return 'Limit firme';
    case 'tx_income': return `${from} je uneo prihod`;
    case 'tx_expense': return `${from} je uneo trošak`;
    case 'tx_transfer': return `${from} je uneo prenos`;
    case 'tx_contribution': return `${from} je uneo ulog`;
    case 'tx_edit': return `${from} je izmenio promet`;
    case 'tx_delete': return `${from} je obrisao promet`;
    default: return 'Poznan';
  }
}

Deno.serve(async req => {
  // Samo service role (baza); potpis JWT-a proverava Supabase gateway
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (jwtRole(token) !== 'service_role') return new Response('Nema pristupa', { status: 401 });
  const { data: rows, error } = await sb.from('notifications').select('id,to_user,from_user,type,target_type,target_id,text')
    .eq('push_state', 'pending').lte('send_after', new Date().toISOString()).order('created_at').limit(100);
  if (error) return new Response(error.message, { status: 500 });
  const list = (rows ?? []) as Notif[];
  if (!list.length) return Response.json({ sent: 0 });

  const users = [...new Set(list.flatMap(n => [n.to_user, n.from_user].filter(Boolean) as string[]))];
  const { data: profiles } = await sb.from('profiles').select('user_id,name,notif').in('user_id', users);
  const { data: tokens } = await sb.from('push_tokens').select('user_id,token').in('user_id', users);
  const prof = new Map((profiles ?? []).map(p => [p.user_id as string, p as { name: string; notif: Prefs }]));
  const now = nowHHMM();

  const set = (id: string, patch: Record<string, unknown>) => sb.from('notifications').update(patch).eq('id', id);
  const messages: { n: Notif; to: string; title: string; body: string }[] = [];

  for (const n of list) {
    const p = prof.get(n.to_user)?.notif ?? {};
    const ev = EVENT[n.type];
    if (p.push === false || (ev && p.ev?.[ev] === false)) { await set(n.id, { push_state: 'skipped', email_state: 'skipped' }); continue; }
    const win = p.pushWin ?? { from: '07:00', to: '21:00' };
    if (!inWindow(now, win)) {
      // Van vremena slanja: stiže kad vreme počne
      await set(n.id, { send_after: new Date(Date.now() + minutesUntil(win.from, now) * 60_000).toISOString() });
      continue;
    }
    const mine = (tokens ?? []).filter(t => t.user_id === n.to_user).map(t => t.token as string);
    if (!mine.length) { await set(n.id, { push_state: 'skipped', email_state: 'skipped' }); continue; }
    const from = n.from_user ? prof.get(n.from_user)?.name ?? 'Poznan' : 'Poznan';
    for (const to of mine) messages.push({ n, to, title: titleOf(n, from), body: n.text ?? '' });
  }

  // Expo push: do 100 poruka po pozivu
  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch.map(m => ({
        to: m.to, title: m.title, body: m.body, sound: 'default', priority: 'high', channelId: 'default',
        data: { notificationId: m.n.id, target: m.n.target_type, targetId: m.n.target_id },
      }))),
    });
    const out = res.ok ? ((await res.json()) as { data: { status: string; details?: { error?: string } }[] }).data : [];
    const ok = new Set<string>(), bad = new Set<string>();
    batch.forEach((m, k) => {
      const r = out[k];
      if (r?.status === 'ok') { ok.add(m.n.id); sent++; } else bad.add(m.n.id);
      // Telefon koji više nije registrovan: token se briše
      if (r?.details?.error === 'DeviceNotRegistered') void sb.from('push_tokens').delete().eq('token', m.to);
    });
    for (const id of ok) await set(id, { push_state: 'sent', email_state: 'skipped' });
    for (const id of bad) if (!ok.has(id)) await set(id, { push_state: 'failed', email_state: 'skipped' });
  }
  return Response.json({ sent, processed: list.length });
});

/** Uloga iz JWT-a (bez provere potpisa; to radi gateway). */
function jwtRole(token: string): string | null {
  try {
    const part = token.split('.')[1] ?? '';
    return (JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='))) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}
