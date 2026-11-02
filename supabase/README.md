# Supabase

- `migrations/`: šema, RLS, audit, RPC. Nova izmena = nova migracija, nikad izmena objavljene.
- `seed.sql`: primer podataka za `supabase db reset`.
- `functions/`: Edge Functions.

## Kurs EUR (fx-rates)
Srednji kurs NBS se upisuje u `fx_rates` jednom dnevno. EUR transakcija za dan bez kursa se odbija,
zato kurs mora da postoji pre unosa (funkcija uzima poslednju listu pre traženog dana, npr. za vikend petkovu).

```bash
supabase functions deploy fx-rates
```

Raspored (SQL editor, jednom po projektu; ključ se čuva u Vault-u, ne u kodu):
```sql
select vault.create_secret('<service_role_key>', 'service_role_key');
select cron.schedule('fx-rates', '15 8,12,16 * * 1-5', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/fx-rates',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'))
  );
$$);
```
NBS objavljuje listu oko 8h; poziv u 12h i 16h je rezerva.

Prvo punjenje (npr. poslednjih 30 dana) radi se ručnim pozivom sa `{"date": "YYYY-MM-DD"}`.

## Podsetnici za uplatu
```sql
select cron.schedule('job-reminders', '* * * * *', $$ select public.fire_due_reminders(); $$);
```
