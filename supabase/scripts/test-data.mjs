#!/usr/bin/env node
/**
 * Probni podaci za testiranje aplikacije na pravom projektu, i njihovo brisanje.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/scripts/test-data.mjs seed
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/scripts/test-data.mjs clear
 *
 * Svaki probni red ima id koji počinje sa 7e570000- (TEST), pa `clear` briše tačno te redove
 * (i njihove stavke u audit logu), a pravi podaci ostaju netaknuti. Ključ se ne čuva u kodu.
 */
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error('Postavi SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function rest(method, path, body) {
  // Redovi imaju različita polja (PostgREST traži ista u jednom upisu), pa se šalju jedan po jedan
  if (method === 'POST' && Array.isArray(body)) {
    const out = [];
    for (const row of body) out.push(...(await rest(method, path, row)));
    return out;
  }
  const r = await fetch(`${URL}/rest/v1/${path}`, { method, headers: { ...H, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
}

// Deterministički id-jevi: 7e570000-0000-4000-8000-<tabela><redni broj>
const TABLES = { clients: 1, jobs: 2, tasks: 3, transactions: 4, transfers: 5, owner_contributions: 6 };
const id = (table, n) => `7e570000-0000-4000-8000-${String(TABLES[table]).padStart(4, '0')}${String(n).padStart(8, '0')}`;
const MAX = 200;
const allIds = table => Array.from({ length: MAX }, (_, i) => id(table, i + 1));

const iso = d => d.toISOString().slice(0, 10);
const today = new Date();
const daysAgo = n => iso(new Date(today.getTime() - n * 864e5));
const daysAhead = n => iso(new Date(today.getTime() + n * 864e5));

async function seed() {
  const accounts = await rest('GET', 'accounts?select=id,kind,company_id,name&deleted_at=is.null');
  const profiles = await rest('GET', 'profiles?select=user_id,slug');
  const labels = await rest('GET', 'labels?select=id,name&deleted_at=is.null');
  const acc = name => accounts.find(a => a.name === name)?.id;
  const DRILL = acc('Poznan Drill'), TRANS = acc('Poznan Trans'), KES = accounts.find(a => a.kind === 'cash')?.id;
  const user = slug => profiles.find(p => p.slug === slug)?.user_id;
  const N = user('nenad'), J = user('jovan');
  const label = name => labels.find(l => l.name === name)?.id ?? null;
  if (!DRILL || !TRANS || !KES || !N || !J) throw new Error('Nedostaju računi ili profili');

  const clients = [
    { kind: 'fizicko', name: 'Dragana Petrović', city: 'Šabac', address: 'Kralja Petra I 12', phone: '+381 64 111 2233' },
    { kind: 'fizicko', name: 'Milan Jovanović', city: 'Bogatić', address: 'Vojvode Mišića 3', phone: '+381 63 444 5566' },
    { kind: 'fizicko', name: 'Ana Stojanović', city: 'Loznica', address: 'Jadranska 7', phone: '+381 65 222 3344' },
    { kind: 'fizicko', name: 'Milica Ilić', city: 'Šabac', address: 'Masarikova 21', phone: '+381 60 555 1212' },
    { kind: 'pravno', name: 'Agro Drina DOO', city: 'Loznica', address: 'Drinska 21', pib: '109876543', mb: '21345678', email: 'kancelarija@agrodrina.rs', contact_person: 'Petar Marković' },
    { kind: 'pravno', name: 'Mačva Gradnja DOO', city: 'Šabac', address: 'Industrijska 9', pib: '108765432', mb: '20456789', email: 'office@macvagradnja.rs', contact_person: 'Ivana Lukić' },
  ].map((c, i) => ({ id: id('clients', i + 1), ...c }));
  await rest('POST', 'clients', clients);
  const K = i => clients[i].id;

  const jobs = [
    { client_id: K(0), label_id: label('Bušenje bunara'), assignee: 'oba', start_date: daysAhead(1), start_time: '08:00', end_time: '15:00', status: 'cekanje', description: 'Bunar 40 m, dvorište iza kuće' },
    { client_id: K(4), label_id: label('Servis pumpe'), assignee: 'nenad', start_date: daysAgo(0), start_time: '10:00', end_time: '12:00', status: 'proces', description: 'Zamena potapajuće pumpe' },
    { client_id: K(5), label_id: label('Prevoz'), assignee: 'jovan', start_date: daysAhead(3), start_time: '07:30', status: 'cekanje', description: 'Prevoz šljunka, 3 ture', work_address: 'Gradilište Benska bara' },
    { client_id: K(1), label_id: label('Iskop'), assignee: 'oba', start_date: daysAgo(6), status: 'uplata', description: 'Iskop za septičku jamu' },
    { client_id: K(2), label_id: label('Bušenje bunara'), assignee: 'oba', start_date: daysAgo(20), status: 'zavrseno', end_date: daysAgo(18), description: 'Bunar 32 m' },
    { client_id: K(3), label_id: null, assignee: 'jovan', start_date: null, status: 'cekanje', description: 'Pogledati teren za bunar' },
  ].map((j, i) => ({ id: id('jobs', i + 1), ...j }));
  await rest('POST', 'jobs', jobs);

  const tasks = [
    { title: 'Kupiti PVC cevi za bunar (40 m)', assignee: 'jovan', due: daysAhead(1), status: 'proces', job_id: jobs[0].id },
    { title: 'Poslati Ani cenu prevoza', assignee: 'nenad', due: daysAhead(2), status: 'cekanje' },
    { title: 'Naplatiti zaostatak od Milice', assignee: 'jovan', due: daysAgo(2), status: 'proces' },
    { title: 'Registrovati kamion', assignee: 'nenad', due: daysAhead(6), status: 'cekanje' },
    { title: 'Servis bušilice', assignee: 'oba', due: null, status: 'cekanje' },
  ].map((t, i) => ({ id: id('tasks', i + 1), ...t }));
  await rest('POST', 'tasks', tasks);

  // Promet poslednjih 6 meseci (RSD; EUR samo za dane za koje postoji kurs)
  const tx = [];
  const add = (o) => tx.push({ id: id('transactions', tx.length + 1), currency: 'RSD', vat: 0, ...o });
  for (let mo = 5; mo >= 0; mo--) {
    const d = n => daysAgo(mo * 30 + n);
    add({ type: 'prihod', amount_original: 180000 + mo * 15000, account_id: DRILL, date: d(3), category: 'Usluga', client_id: K(mo % 4), description: 'Bušenje bunara', created_by: N });
    add({ type: 'prihod', amount_original: 95000 + mo * 8000, account_id: TRANS, date: d(5), category: 'Usluga', client_id: K(5), description: 'Prevoz materijala', created_by: J });
    add({ type: 'prihod', amount_original: 40000, account_id: KES, date: d(8), category: 'Usluga', client_id: K((mo + 1) % 4), description: 'Servis pumpe', created_by: J });
    add({ type: 'trosak', amount_original: 32000, account_id: DRILL, date: d(4), category: 'Materijal', description: 'Cevi i filteri', created_by: N });
    add({ type: 'trosak', amount_original: 18000, account_id: TRANS, date: d(6), category: 'Gorivo', created_by: J });
    add({ type: 'trosak', amount_original: 12000, account_id: KES, date: d(9), category: 'Alat', created_by: N });
    if (mo > 0) {
      add({ type: 'trosak', amount_original: 60000, account_id: DRILL, date: d(1), category: 'Plata', salary_to: 'nenad', created_by: N });
      add({ type: 'trosak', amount_original: 60000, account_id: DRILL, date: d(1), category: 'Plata', salary_to: 'jovan', created_by: N });
    }
  }
  add({ type: 'trosak', amount_original: 15000, account_id: TRANS, date: daysAgo(0), category: 'Knjigovođa', description: 'Knjigovođa za oktobar', created_by: J });
  add({ type: 'prihod', amount_original: 250, currency: 'EUR', account_id: KES, date: daysAgo(0), category: 'Usluga', pending_client: true, description: 'Hitna intervencija', created_by: N });
  add({ type: 'trosak', amount_original: 500, currency: 'EUR', account_id: KES, date: daysAgo(0), category: 'Plata', salary_to: 'jovan', created_by: N });
  await rest('POST', 'transactions', tx);

  await rest('POST', 'transfers', [
    { id: id('transfers', 1), from_account_id: DRILL, to_account_id: KES, amount: 50000, amount_original: 50000, currency: 'RSD', date: daysAgo(12), note: 'Podignuto za materijal', created_by: N },
    { id: id('transfers', 2), from_account_id: KES, to_account_id: TRANS, amount: 30000, amount_original: 30000, currency: 'RSD', date: daysAgo(40), created_by: J },
  ]);
  await rest('POST', 'owner_contributions', [
    { id: id('owner_contributions', 1), owner: 'jovan', account_id: TRANS, amount: 100000, amount_original: 100000, currency: 'RSD', date: daysAgo(25), note: 'Za registraciju kamiona', created_by: J },
  ]);
  // Stanje računa broji promet od početnog datuma; da bi se probni promet video u stanju, datum ide 7 meseci unazad
  // (samo za račune koji još nemaju početno stanje). `clear` ga vraća na dan kada je račun napravljen.
  for (const a of await rest('GET', 'accounts?select=id,opening_balance,opening_date,created_at&deleted_at=is.null')) {
    if (Number(a.opening_balance) === 0 && a.opening_date === a.created_at.slice(0, 10)) await rest('PATCH', `accounts?id=eq.${a.id}`, { opening_date: daysAgo(210) });
  }
  console.log(`Ubačeno: ${clients.length} klijenata, ${jobs.length} poslova, ${tasks.length} zadataka, ${tx.length} unosa prometa, 2 prenosa, 1 ulog.`);
}

async function clear() {
  // Redosled zbog stranih ključeva: zavisni redovi prvo
  const order = ['tasks', 'transactions', 'transfers', 'owner_contributions', 'jobs', 'clients'];
  let total = 0;
  for (const t of order) {
    const ids = allIds(t);
    const rows = await rest('DELETE', `${t}?id=in.(${ids.join(',')})`);
    total += rows?.length ?? 0;
    await rest('DELETE', `audit_log?table_name=eq.${t}&row_id=in.(${ids.join(',')})`);
    console.log(`${t}: obrisano ${rows?.length ?? 0}`);
  }
  for (const a of await rest('GET', 'accounts?select=id,opening_balance,opening_date,created_at&deleted_at=is.null')) {
    if (Number(a.opening_balance) === 0 && a.opening_date < a.created_at.slice(0, 10)) {
      await rest('PATCH', `accounts?id=eq.${a.id}`, { opening_date: a.created_at.slice(0, 10) });
    }
  }
  console.log(`Ukupno obrisano probnih redova: ${total}. Početni datum računa je vraćen.`);
}

const cmd = process.argv[2];
if (cmd === 'seed') await seed();
else if (cmd === 'clear') await clear();
else console.log('Upotreba: node supabase/scripts/test-data.mjs seed|clear');
