// Edge Function: šalje obaveštenja na telefon iz tabele notifications (outbox).
// Android: direktno preko Firebase-a (FCM HTTP v1), ključ servisnog naloga je tajna FCM_SERVICE_ACCOUNT u Supabase-u.
// Expo push token (iOS, kasnije): preko Expo push servisa.
// Pokreće je baza (okidač pri novom obaveštenju i pg_cron svakog minuta) sa service_role ključem iz Vault-a.
// Ne prima podatke spolja: samo obradi redove koji čekaju.
//
// Za svakog primaoca poštuje lična podešavanja (profiles.notif): push uključen, vreme slanja (od–do,
// po vremenu u Srbiji; van vremena se odlaže do početka, osim podsetnika zadatka) i vrste događaja (početak posla, zadaci, limit).
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
/** Podsetnici zadatka stižu u vreme koje je vlasnik izabrao (i u 06:00 na dan roka), i van vremena slanja. */
const EXACT_TIME = new Set(['task_reminder', 'task_due']);
const EVENT: Record<string, string | null> = { comment: null, reply: null, reminder: null, job_start: 'start', task_due: 'tasks', task_assigned: 'tasks', task_reminder: 'tasks', task_overdue: 'tasks', limit: 'limit', tx_income: 'promet', tx_expense: 'promet', tx_transfer: 'promet', tx_contribution: 'promet', tx_edit: 'promet', tx_delete: 'promet' };

function titleOf(n: Notif, from: string): string {
  switch (n.type) {
    case 'comment': return `${from} je komentarisao`;
    case 'reply': return `${from} je odgovorio`;
    case 'reminder': return 'Podsetnik za uplatu';
    case 'job_start': return 'Posao počinje';
    case 'task_due': return 'Rok zadatka je danas';
    case 'task_reminder': return 'Podsetnik za zadatak';
    case 'task_overdue': return 'Da li je zadatak završen?';
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
    if (!EXACT_TIME.has(n.type) && !inWindow(now, win)) {
      // Van vremena slanja: stiže kad vreme počne
      await set(n.id, { send_after: new Date(Date.now() + minutesUntil(win.from, now) * 60_000).toISOString() });
      continue;
    }
    const mine = (tokens ?? []).filter(t => t.user_id === n.to_user).map(t => t.token as string);
    if (!mine.length) { await set(n.id, { push_state: 'skipped', email_state: 'skipped' }); continue; }
    const from = n.from_user ? prof.get(n.from_user)?.name ?? 'Poznan' : 'Poznan';
    for (const to of mine) messages.push({ n, to, title: titleOf(n, from), body: n.text ?? '' });
  }

  const ok = new Set<string>(), bad = new Set<string>();
  const result = (m: { n: Notif; to: string }, good: boolean, gone: boolean) => {
    if (good) ok.add(m.n.id); else bad.add(m.n.id);
    // Telefon koji više nije registrovan: token se briše
    if (gone) void sb.from('push_tokens').delete().eq('token', m.to);
  };
  const isExpo = (t: string) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');

  // Android: Firebase (FCM HTTP v1), jedna poruka po telefonu
  const fcm = messages.filter(m => !isExpo(m.to));
  if (fcm.length) {
    const auth = await fcmAuth();
    for (const m of fcm) {
      if (!auth) { result(m, false, false); continue; }
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({
          message: {
            token: m.to,
            notification: { title: m.title, body: m.body },
            data: { notificationId: m.n.id, target: m.n.target_type ?? '', targetId: m.n.target_id ?? '' },
            android: { priority: 'HIGH', notification: { channel_id: 'default', sound: 'default' } },
          },
        }),
      });
      const err = res.ok ? '' : await res.text();
      result(m, res.ok, res.status === 404 || err.includes('UNREGISTERED'));
    }
  }

  // Expo push: do 100 poruka po pozivu
  const expo = messages.filter(m => isExpo(m.to));
  for (let i = 0; i < expo.length; i += 100) {
    const batch = expo.slice(i, i + 100);
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch.map(m => ({
        to: m.to, title: m.title, body: m.body, sound: 'default', priority: 'high', channelId: 'default',
        data: { notificationId: m.n.id, target: m.n.target_type, targetId: m.n.target_id },
      }))),
    });
    const out = res.ok ? ((await res.json()) as { data: { status: string; details?: { error?: string } }[] }).data : [];
    batch.forEach((m, k) => result(m, out[k]?.status === 'ok', out[k]?.details?.error === 'DeviceNotRegistered'));
  }

  // Obaveštenje je poslato ako je stiglo bar na jedan telefon
  for (const id of ok) await set(id, { push_state: 'sent', email_state: 'skipped' });
  for (const id of bad) if (!ok.has(id)) await set(id, { push_state: 'failed', email_state: 'skipped' });
  const sent = ok.size;
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

/** Pristupni token za Firebase iz ključa servisnog naloga (JWT potpisan RS256, važi sat vremena). */
async function fcmAuth(): Promise<{ token: string; projectId: string } | null> {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT');
  if (!raw) { console.error('Nema tajne FCM_SERVICE_ACCOUNT'); return null; }
  const sa = JSON.parse(raw) as { client_email: string; private_key: string; project_id: string; token_uri?: string };
  const aud = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const enc = (o: unknown) => b64(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud, iat: now, exp: now + 3600 })}`;
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), ch => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const res = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64(sig)}` }),
  });
  if (!res.ok) { console.error('Firebase prijava nije uspela', res.status); return null; }
  return { token: ((await res.json()) as { access_token: string }).access_token, projectId: sa.project_id };
}
