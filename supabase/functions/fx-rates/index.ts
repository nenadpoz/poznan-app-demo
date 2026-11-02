// Edge Function: preuzima srednji kurs NBS za EUR i upisuje ga u public.fx_rates.
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
  // Samo service role (pg_cron) sme da upisuje kurs
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Nema pristupa', { status: 401 });
  }

  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  const day = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : 'today';

  const res = await fetch(`https://kurs.resenje.org/api/v1/currencies/eur/rates/${day}`);
  if (!res.ok) return new Response(`Kurs nije dostupan (${res.status})`, { status: 502 });
  const r = (await res.json()) as NbsRate;
  if (r.code !== 'EUR' || !(r.exchange_middle > 0)) return new Response('Neispravan odgovor izvora', { status: 502 });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Upisuje se pod datumom liste (date_from); za vikend to je petkova lista, pa nema duplikata
  const { error } = await sb.from('fx_rates').upsert({ date: r.date_from, eur: r.exchange_middle, source: 'nbs', fetched_at: new Date().toISOString() });
  if (error) return new Response(error.message, { status: 500 });

  return Response.json({ date: r.date_from, eur: r.exchange_middle });
});
