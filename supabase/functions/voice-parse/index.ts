// Edge Function: glasovna komanda. Prima izdiktiran (i ispravljen) tekst i vraća nameru i polja za formu
// (novi klijent, posao, zadatak ili promet). Ništa ne čuva: aplikacija otvara popunjenu formu za potvrdu.
//
// Model je Google Gemini (gemini-3.5-flash-lite, besplatan nivo), JSON odgovor po šemi ispod, preko Interactions API-ja.
// Ključ je tajna GEMINI_API_KEY u Supabase-u (aistudio.google.com → Get API key).
// Razgovor se ne čuva kod Google-a (store: false). Na besplatnom nivou Google može da koristi poslate tekstove za
// poboljšanje svojih modela; zato AI dobija samo tekst, današnji datum i nazive firmi i kategorija, bez spiska klijenata.
// Za drugi model (Claude, lokalni preko Ollama) menja se samo funkcija `ask`; oblik odgovora ostaje isti.

type Ctx = {
  today: string;
  companies: { id: string; name: string }[];
  categoriesIn: string[];
  categoriesOut: string[];
  jobLabels: string[];
};

const MODEL = 'gemini-3.5-flash-lite';
const URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// Šema bez anyOf (Gemini preporučuje jednostavne šeme): prazno polje je null
const str = { type: ['string', 'null'] };
const oneOf = (values: string[]) => ({ type: ['string', 'null'], enum: [...values, null] });
const obj = (props: Record<string, unknown>) => ({ type: 'object', properties: props, required: Object.keys(props) });
const who = oneOf(['nenad', 'jovan', 'oba']);

const SCHEMA = {
  type: 'object',
  required: ['intent', 'client', 'job', 'task', 'tx'],
  properties: {
    intent: { type: 'string', enum: ['klijent', 'posao', 'zadatak', 'promet', 'nepoznato'] },
    client: obj({
      kind: oneOf(['fizicko', 'pravno']),
      name: str, phone: str, email: str, address: str, city: str, pib: str, mb: str, contactPerson: str, note: str,
      supplier: { type: ['boolean', 'null'] }, service: str,
    }),
    job: obj({
      clientName: str, description: str, label: str, date: str, startTime: str, endTime: str, address: str, city: str, assignee: who,
    }),
    task: obj({ title: str, note: str, dueDate: str, assignee: who }),
    tx: obj({
      type: oneOf(['prihod', 'trosak']),
      amount: { type: ['number', 'null'] },
      currency: oneOf(['RSD', 'EUR', 'USD']),
      companyId: str, cash: { type: ['boolean', 'null'] }, category: str, clientName: str, note: str, date: str,
    }),
  },
};

const DAYS = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];

function system(ctx: Ctx): string {
  const day = DAYS[new Date(`${ctx.today}T12:00:00Z`).getUTCDay()];
  return `Ti čitaš glasovne komande za internu aplikaciju firme (Srbija). Vlasnici su Nenad i Jovan.
Tekst je izdiktiran na srpskom (latinica ili ćirilica) i može imati greške prepoznavanja govora. Odredi šta korisnik želi i izvuci polja.

Namere:
- "klijent": novi klijent ili saradnik (popuni "client").
- "posao": novi posao kod klijenta, npr. ugradnja, popravka, bušenje (popuni "job").
- "zadatak": nešto što treba uraditi ili ne zaboraviti (popuni "task").
- "promet": prihod (naplata, uplata) ili trošak (gorivo, materijal, plaćanje) (popuni "tx").
- "nepoznato": ništa od toga.
Objekti za druge namere ostaju, ali su im sva polja null.

Pravila:
- Imena ljudi i mesta piši u nominativu, latinicom, sa velikim početnim slovom: "Igora Petrovića" → "Igor Petrović", "u Sremskoj Mitrovici" → "Sremska Mitrovica", "iz Šapca" → "Šabac".
- Adresa je ulica i broj u nominativu: "na adresi Petra Preradovića broj 13" → "Petra Preradovića 13". Mesto ide u "city", ne u adresu.
- Telefon samo ciframa, kako je izgovoren ("064 543 4334" → "0645434334").
- client.kind: "pravno" za firmu (DOO, AD, preduzetnik, "pravno lice"), inače "fizicko".
- client.supplier: true kad je to saradnik (dobavljač, majstor, prevoznik, "saradnik", od njega kupujemo), inače false; client.service je šta radi ili prodaje ("Iskop bagerom", "PVC cevi").
- Datumi u formatu YYYY-MM-DD, vreme HH:MM. Danas je ${ctx.today} (${day}). "sutra", "prekosutra", "u petak", "15. novembra" pretvori u datum (dan u nedelji znači prvi sledeći takav dan).
- Iznosi kao broj: "12 hiljada" → 12000, "milion i po" → 1500000, "35.000" → 35000. Valuta RSD ako se ne kaže drugačije ("evra" → EUR, "dolara" → USD).
- tx.cash = true kad se kaže keš, gotovina ili bez računa; tada je companyId null.
- tx.companyId: id firme sa spiska ispod kad se firma pomene (i skraćeno, npr. "Drill", "Trans"), inače null.
- tx.category i job.label biraj samo sa spiskova ispod, inače null.
- assignee: "nenad", "jovan" ili "oba" samo ako se kaže kome je, inače null.
- "note"/"description": ostatak koji opisuje stvar ("zainteresovan za zamenu stolarije"), bez ponavljanja imena, telefona i adrese.
- Ne izmišljaj: polje koje nije rečeno je null.

Firme: ${ctx.companies.map(c => `${c.name} (id ${c.id})`).join('; ') || 'nema'}
Kategorije prihoda: ${ctx.categoriesIn.join(', ') || 'nema'}
Kategorije troškova: ${ctx.categoriesOut.join(', ') || 'nema'}
Kategorije poslova: ${ctx.jobLabels.join(', ') || 'nema'}`;
}

/** Jedan poziv modela; vraća JSON po šemi. */
async function ask(text: string, ctx: Ctx): Promise<unknown> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('Nema GEMINI_API_KEY');
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', 'Api-Revision': '2026-05-20' },
    body: JSON.stringify({
      model: MODEL,
      system_instruction: system(ctx),
      input: text,
      response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
      generation_config: { max_output_tokens: 2000 },
      store: false,
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const it = await res.json() as { status?: string; steps?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  if (it.status && it.status !== 'completed') throw new Error(`Gemini status ${it.status}`);
  const out = (it.steps ?? []).filter(st => st.type === 'model_output')
    .flatMap(st => st.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('');
  if (!out.trim()) throw new Error('Prazan odgovor');
  // Za svaki slučaj: bez ```json okvira
  return JSON.parse(out.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, ''));
}

function jwtRole(token: string): string | null {
  try { return JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))).role ?? null; } catch { return null; }
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  // Samo prijavljeni korisnik; potpis JWT-a proverava Supabase gateway
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (jwtRole(token) !== 'authenticated') return json({ error: 'Nema pristupa' }, 401);
  let body: { text?: unknown; context?: Partial<Ctx> };
  try { body = await req.json(); } catch { return json({ error: 'Neispravan zahtev' }, 400); }
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : '';
  if (!text) return json({ error: 'Tekst je prazan' }, 400);
  const c = body.context ?? {};
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, 50) as string[] : []);
  const ctx: Ctx = {
    today: typeof c.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.today) ? c.today : new Date().toISOString().slice(0, 10),
    companies: Array.isArray(c.companies) ? c.companies.filter(x => x && typeof x.id === 'string' && typeof x.name === 'string').slice(0, 20) : [],
    categoriesIn: list(c.categoriesIn), categoriesOut: list(c.categoriesOut), jobLabels: list(c.jobLabels),
  };
  try {
    return json(await ask(text, ctx));
  } catch (e) {
    console.error('voice-parse', e instanceof Error ? e.message : e);
    return json({ error: 'AI trenutno ne može da obradi komandu. Probaj ponovo.' }, 502);
  }
});
