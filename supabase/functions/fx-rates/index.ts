// Edge Function: preuzima srednji kurs NBS za EUR i USD i upisuje ga u public.fx_rates.
// Poziva je pg_cron radnim danima (vidi supabase/README.md). Može i ručno: POST /functions/v1/fx-rates {"date":"2026-11-02"}.
// Izvor: kurs.resenje.org, javni API koji prenosi kursnu listu NBS (exchange_middle = srednji kurs).
import { createClient } from 'npm:@supabase/supabase-js@2';

interface NbsRate {
  code: string;
  date: string; // dan za koji je traženo
  date_from: string; // datum kursne liste koja važi
  exchange_middle: number;
}

Deno.serve(async req => {
  // Samo service role (pg_cron) sme da upisuje kurs. Potpis JWT-a proverava Supabase gateway (verify_jwt),
  // ovde se proverava uloga iz tokena (ključ u okruženju funkcije može biti nov format pa se ne poredi tekst).
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (jwtRole(token) !== 'service_role') {
    return new Response('Nema pristupa', { status: 401 });
  }

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const day = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : 'today';

  const get = async (cur: 'eur' | 'usd') => {
    const res = await fetch(`https://kurs.resenje.org/api/v1/currencies/${cur}/rates/${day}`);
    if (!res.ok) throw new Error(`Kurs ${cur.toUpperCase()} nije dostupan (${res.status})`);
    const r = (await res.json()) as NbsRate;
    if (r.code !== cur.toUpperCase() || !(r.exchange_middle > 0)) throw new Error('Neispravan odgovor izvora');
    return r;
  };
  let eur: NbsRate, usd: NbsRate;
  try { [eur, usd] = await Promise.all([get('eur'), get('usd')]); }
  catch (e) { return new Response(e instanceof Error ? e.message : 'Kurs nije dostupan', { status: 502 }); }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Upisuje se pod datumom liste (date_from); za vikend to je petkova lista, pa nema duplikata.
  // Obe valute su u istoj kursnoj listi, pa imaju isti datum.
  const { error } = await sb.from('fx_rates').upsert({
    date: eur.date_from, eur: eur.exchange_middle, usd: usd.date_from === eur.date_from ? usd.exchange_middle : null,
    source: 'nbs', fetched_at: new Date().toISOString(),
  });
  if (error) return new Response(error.message, { status: 500 });

  return Response.json({ date: eur.date_from, eur: eur.exchange_middle, usd: usd.exchange_middle });
});

/** Uloga iz JWT-a (bez provere potpisa; to radi gateway). */
function jwtRole(token: string): string | null {
  try {
    const part = token.split('.')[1] ?? '';
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}
