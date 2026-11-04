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

## Push obaveštenja (notify-dispatch)
Tabela `notifications` je outbox. Pri svakom novom obaveštenju (i pg_cron svakog minuta za odložena) baza poziva
Edge Function `notify-dispatch` sa ključem iz Vault-a (iste tajne kao za kurs: `project_url`, `service_role_key`).
Funkcija poštuje lična podešavanja (push, vreme slanja, vrste događaja); tokeni telefona su u `push_tokens`.
Android šalje direktno preko Firebase-a (FCM HTTP v1, bez expo.dev): ključ servisnog naloga iz Firebase konzole
(Project settings → Service accounts) je tajna `FCM_SERVICE_ACCOUNT`. Expo push token (iOS, kasnije) ide preko Expo push servisa.
Email još nije povezan.
```bash
supabase secrets set FCM_SERVICE_ACCOUNT="$(cat putanja/do/kljuca.json)"
supabase functions deploy notify-dispatch
```

## Probni podaci
`scripts/test-data.mjs seed` ubacuje probne klijente, poslove, zadatke, promet (6 meseci), prenose i ulog; `clear` ih briše.
Probni redovi imaju id koji počinje sa `7e570000-`, pa `clear` ne dira prave podatke. Za vreme testiranja početni datum
računa (sa početnim stanjem 0) ide 7 meseci unazad da bi se probni promet video u stanju; `clear` ga vraća.
```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<ključ> node supabase/scripts/test-data.mjs seed
```

## Reset lozinke (email šablon)
Aplikacija resetuje lozinku kodom iz emaila, ne linkom. U Supabase Dashboard → Authentication → Emails → **Reset Password** šablon mora da sadrži `{{ .Token }}`, npr.:

- Subject: `Poznan: kod za novu lozinku`
- Body: `<h2>Nova lozinka</h2><p>Tvoj kod za postavljanje nove lozinke je:</p><h1 style="letter-spacing:4px">{{ .Token }}</h1><p>Kod važi 1 sat. Ako nisi tražio novu lozinku, ignoriši ovaj email.</p>`

Ugrađeni Supabase email server šalje svega nekoliko poruka na sat i samo adresama članova tima projekta. Za pouzdano slanje podesi svoj SMTP (Authentication → Emails → SMTP Settings).
Promena, postavljanje i reset lozinke se beleže u audit_log (`table_name = 'nalog'`) preko triggera na `auth.users` (migracija 0900).

## Backup (Google Drive)
Svake noći GitHub Actions (`.github/workflows/backup.yml`) pravi dump baze i šalje ga u folder **Poznan backup** na Google Drive-u.
Jedan backup je folder `GGGG-MM-DD_HHMM` sa fajlovima `roles.sql.gz`, `schema.sql.gz`, `data.sql.gz` (kompletna baza) i `public-data.sql.gz` (podaci aplikacije).
Čuva se poslednjih 30 dana. Ako backup ne uspe, GitHub šalje email.

**Jednokratno podešavanje** (tajne `RCLONE_DRIVE_TOKEN` i `SUPABASE_DB_URL` u repou; lozinka se nigde ne ispisuje):
```bash
supabase/scripts/backup-setup.sh
```
`SUPABASE_DB_URL` je **Session pooler** URI (Dashboard → Connect), jer GitHub nema IPv6 za direktnu vezu.

**Ručni backup** (npr. pre nove migracije):
```bash
gh workflow run backup.yml
```

**Lista backupa** (na Mac-u posle podešavanja):
```bash
rclone lsd "poznan-gdrive:Poznan backup"
```

**Vraćanje na istom projektu** (podaci aplikacije; šema i nalozi ostaju). Prvo se automatski pravi backup trenutnog stanja (`…_pre-vracanja`), pa se u jednoj transakciji brišu i učitavaju sve tabele iz `public`, bez okidanja triggera. Na kraju jedan zapis u logovima. Tabela `backups` posle vraćanja ima stanje iz backupa.
GitHub → Actions → **Vrati backup** → Run workflow, ili:
```bash
gh workflow run restore.yml -f backup=2026-11-03_0200 -f potvrda=VRATI
```

**Kompletna baza u novi projekat** (ako se izgubi ceo projekat): preuzmi folder sa Drive-a, raspakuj i učitaj psql-om 17 ili novijim:
```bash
gunzip *.gz
psql --single-transaction -v ON_ERROR_STOP=1 -f roles.sql -f schema.sql -c 'SET session_replication_role = replica' -f data.sql -d "<URI novog projekta>"
```

GitHub isključuje zakazane poslove u javnom repou posle 60 dana bez ijednog commita (stigne email upozorenja); tada ga ponovo uključi u Actions → Backup baze.
