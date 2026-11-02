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

Raspored je u migraciji `20261102000600_base_data_cron.sql`. Adresa i ključ se čitaju iz Vault-a,
pa se jednom po projektu dodaju dve tajne (Dashboard → Integrations → Vault → Add new secret, ili SQL editor):
```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
select vault.create_secret('<service_role_key>', 'service_role_key'); -- Settings → API Keys → Legacy → service_role
```
Funkcija prihvata samo token sa ulogom `service_role` (potpis proverava gateway).
NBS objavljuje listu oko 8h; poziv u 12h i 16h je rezerva.

Prvo punjenje (npr. poslednjih 30 dana) radi se ručnim pozivom sa `{"date": "YYYY-MM-DD"}`.

## Podsetnici za uplatu
Raspored `job-reminders` (svakog minuta) je u istoj migraciji.

## Projekti
- `poznan-app` (ref `nczptyiamjlvgsryiivk`, Frankfurt): repo je povezan (`supabase link`), migracije se puštaju sa `npx -y supabase@2.54.11 db push`.
