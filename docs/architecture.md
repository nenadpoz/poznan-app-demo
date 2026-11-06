# Arhitektura

## Pregled
Tri repozitorijuma:

| Repo | Sadržaj |
|---|---|
| **poznan-app-demo** (ovaj, „core“) | `supabase/` (šema, RLS, audit, Edge Functions), `packages/shared` (tipovi, zod, poslovna pravila, tema), `packages/api` (zajednički API sloj), `docs/`, `demo/` |
| **poznan-app-mobile** | Expo aplikacija (Android, pa iOS), pun offline |
| **poznan-app-web** | Next.js aplikacija, online |

```
mobile (Expo) ── @poznan/api (mobile adapter) ── PowerSync SQLite (offline) ─┐
                                                                             ├─ Supabase
web (Next.js) ── @poznan/api (web adapter) ───── Supabase JS + Realtime ─────┘   (Postgres, Auth, Storage,
                         │                                                        Edge Functions, pg_cron, Realtime)
                  @poznan/shared (tipovi, zod, pravila, tema)
```

- Ekrani nikad ne zovu Supabase direktno. `@poznan/api` izlaže iste funkcije i hookove (`useJobs()`, `jobs.finish()`…) sa dve implementacije: mobile čita/piše lokalni SQLite, web radi direktno sa Supabase-om.
- Supabase je jedini izvor istine. Audit, pristup i obaveštenja rade u bazi (triggeri, RLS), ne u aplikaciji.
- Mobile i web koriste `@poznan/shared` i `@poznan/api` iz ovog repoa kao git zavisnost (`github:nenadpoz/poznan-app-demo#<tag>&path:packages/shared`). Kasnije, ako zatreba, objavljuju se na GitHub Packages. Svaka promena paketa dobija tag (`shared-v0.x`), a aplikacije podižu verziju svesno.

## Tehnologije
| Sloj | Izbor |
|---|---|
| Jezik | TypeScript strict svuda |
| Paketi u core repou | pnpm workspaces, Vitest za testove |
| Mobile | Expo SDK + React Native, Expo Router, EAS Build + EAS Update |
| Offline sync (mobile) | PowerSync (SQLite na telefonu, sync rules, red izmena) |
| Web | Next.js App Router, `@supabase/ssr`, TanStack Query, Supabase Realtime, hosting na Vercel-u |
| Backend | Supabase (EU, Frankfurt): Postgres, Auth (email + lozinka, bez registracije), Storage, Edge Functions, pg_cron, Realtime |
| Validacija | zod šeme u `@poznan/shared`, iste za forme, API i Edge Functions |
| Push | `expo-notifications`; Android direktno preko Firebase-a (FCM HTTP v1 iz `notify-dispatch`), iOS kasnije preko Expo Push API |
| Email | Resend iz Edge Function-a |
| Glas | `expo-speech-recognition` (sr-RS, na Androidu Googleov prepoznavač) + Edge Function `voice-parse` (Google Gemini `gemini-3.5-flash-lite` preko Interactions API-ja, besplatan nivo, `store: false`, JSON odgovor po šemi; `voiceResultSchema` i `matchClient` u `@poznan/shared`, `api.voice.parse`) |
| Testovi | Vitest (shared, api), pgTAP (RLS, triggeri), Playwright (web), Maestro (mobile) |

## Model podataka (`supabase/migrations`)
Sve tabele: `id uuid`, `created_at`, `updated_at`, `updated_by`, i `deleted_at` (meko brisanje, zbog offline sinhronizacije). Iznosi su `numeric(14,2)` u RSD.

| Tabela | Ključna polja |
|---|---|
| `admins` | `user_id` |
| `profiles` | `user_id`, `slug` (`nenad`/`jovan`), `name`, `currency` (prikaz EUR/USD/RSD, podrazumevano EUR), `theme`, `bar_colors jsonb`, `notif jsonb` (kanali, email, vremena, vrste) |
| `settings` | jedan red: `pausal_limit`, `pdv_threshold`, `warn_pct`, `crit_pct` |
| `companies` | `name, form, phase, address, pib, mb, activity, founded, monthly_fee, notes, icon, logo_path` |
| `company_history` | `company_id, kind` (`phase`/`form`/`edit`), `from_value, to_value, changes jsonb, effective_date, note` |
| `clients` | `kind` (`fizicko`/`pravno`), `name, pib, mb, city, address, phone, email, note` |
| `labels` | kategorije: `name` (jedinstven), `color` 0–5 |
| `jobs` (poslovi, prikazuju se i u kalendaru) | `client_id, label_id, assignee`, `start_date, start_time, end_time, status` (`cekanje`/`proces`/`uplata`/`zavrseno`), `end_date, description, work_address, work_city` |
| `job_pending_items` | očekivane stavke: `job_id, company_id` (null = keš), `amount, description, invoice_no` |
| `job_reminders` | `job_id, remind_at, audience` (`me`/`both`), `created_by, note, fired_at` |
| `suppliers` | saradnici: `kind, name, service, pib, mb, contact_person, city, address, phone, email, note`; `transactions.supplier_id` (samo trošak) |
| `photos` | `target_type` (`client`/`supplier`/`job`/`task`), `target_id, storage_path, created_by`; fajl u privatnom Storage bucketu `photos` (`<vrsta>/<id>/<uuid>.jpg`) |
| `job_photos` | ne koristi se (zamenjena tabelom `photos`) |
| `tasks` | `title, assignee, due, status, done_at, done_by, job_id, notes, reminders, due_time` (bez klijenta; `task_alerts` beleži poslate podsetnike, pg_cron `fire_task_alerts` svakog minuta) |
| `comments` | `target_type` (`task`/`job`/`company`/`transaction`/`transfer`/`contribution`), `target_id, parent_id, user_id, text` |
| `transactions` | `type, amount` (RSD), `amount_original, currency, fx_rate, account_id, created_by, date, company_id` (izvodi se iz računa), `client_id, category, vat, description` (u aplikaciji „Komentar“), `job_id, invoice_no, salary_to` (plata vlasniku), `pending_client` (čeka klijenta) |
| `owner_contributions` | ulog vlasnika: `owner, account_id, amount` (RSD), `amount_original, currency, fx_rate, date, note, created_by`; nije prihod, ulazi u stanje računa |
| `accounts` | račun firme (`company_id`) ili jedna zaliha keša (`kind = cash`); `opening_balance, opening_date` |
| `transfers` | podizanje/polaganje: `from_account_id, to_account_id, amount` (RSD), `amount_original, currency, fx_rate, date, note, created_by` |
| `fx_rates` | `date, eur, usd` (srednji kurs NBS), puni Edge Function `fx-rates` |
| `account_balances` (view) | stanje = početno + prihodi − troškovi ± prenosi |
| `invoice_counters` | `company_id, year, last_no` (brojevi faktura bez preskakanja) |
| `notifications` | `to_user, from_user, type` (`comment`/`reply`/`reminder`/`job_start`/`task_due`/`task_reminder`/`task_overdue`/`task_assigned`/`limit`/`tx_*`), `target_type, target_id, comment_id, text, read_at, push_state, email_state, send_after` |
| `push_tokens` | `user_id, token, platform` |
| `start_prompts` | `user_id, job_id, start_key` (pitanje „počeo posao“ jednom po korisniku) |
| `audit_log` | samo čitanje: `user_id, table_name, action, old jsonb, new jsonb, at, client_at` |
| `backups` | `ts, size, by` |

Pravila koja čuva baza:
- Firma sa prometom ne može da se obriše (trigger).
- Posao može u `zavrseno` samo uz upis prihoda ili eksplicitno „bez naplate“ (RPC `finish_job`), a u `uplata` uz očekivane stavke (RPC `set_job_awaiting_payment`). Oba su transakcija u bazi.
- „Uplaćeno, posao završen“ (`mark_job_paid`) pretvara očekivane stavke u prihode sa istim brojevima faktura.
- Broj fakture se dodeljuje u bazi (`assign_invoice_no` → `next_invoice_no(company_id, year)`), da dva telefona offline ne dobiju isti broj; offline faktura čeka mrežu.
- Promena faze ide kroz `change_company_phase` (datum i komentar koje korisnik zada); promena oblika upisuje istoriju triggerom.
- `jobs.status` u `uplata`/`zavrseno` može samo kroz RPC (trigger odbija direktan upis).
- Komentar automatski pravi obaveštenje drugom vlasniku (trigger); podsetnike za uplatu ispaljuje `fire_due_reminders()` iz pg_cron-a.

## Pristup i audit
- RLS na svim tabelama: pristup samo za `auth.uid()` iz `admins`. Nalozi se prave pozivnicom.
- `profiles`, `notifications`, `push_tokens`, `start_prompts`: svako vidi i menja samo svoje.
- Komentar briše samo autor (RLS).
- Trigger `audit_row_change()` na svim tabelama upisuje staro i novo stanje, korisnika i `client_at` (kad je izmena nastala na telefonu).

## Offline (mobile)
- PowerSync sync rules: oba admina dobijaju sve deljene tabele + samo svoje lične redove. Slike po potrebi (attachments queue).
- Pisanje ide u lokalni SQLite odmah, pa u red; connector šalje na Supabase kad ima mreže, kroz iste RLS i zod provere.
- Sukobi: poslednja izmena reda pobeđuje; audit čuva obe verzije.
- Ne radi offline: glasovno parsiranje, slanje push/email-a, dodela broja fakture (forma ostaje dostupna). Slike se snimaju offline i šalju kasnije.
- Prva prijava mora online; posle toga sesija važi offline.

## Obaveštenja (jedan tok za zvonce, push i email)
1. **Nastanak**: trigger na `comments` (komentar, odgovor) upisuje red u `notifications` za drugog korisnika. pg_cron svakog minuta pravi obaveštenja za: podsetnike za uplatu, početak posla, rok zadatka danas, prelazak firme preko 80%/95% limita.
2. **Zvonce**: `notifications` je izvor liste i brojača (web preko Realtime-a, mobile preko PowerSync-a).
3. **Slanje**: Edge Function `notify-dispatch` (pg_cron svakog minuta) šalje push i email po ličnim podešavanjima: kanal i vrsta uključeni, unutar vremena od–do, inače `send_after` = početak prozora.
4. Dodir na push otvara isti ekran kao klik u zvoncu.

## Edge Functions
`voice-parse`, `notify-dispatch`, `invoice-pdf` (PDF fakture iz podataka u bazi), `admin-reset-password`.

## Backup
GitHub Actions svake noći: `supabase db dump` (uloge, šema, podaci, posebno `public`) → gzip → Google Drive preko rclone-a (scope `drive.file`), poslednjih 30 dana. Vraćanje podataka aplikacije je ručni workflow `restore.yml` (prvo novi backup, pa u jednoj transakciji brisanje i učitavanje `public`). Detalji u `supabase/README.md`.

## Tema
- Tokeni boja za svetlu i tamnu temu u `@poznan/shared/theme` (isti nazivi kao u demou: `bg, surface, fg, muted, accent, good, warn, bad, info, lc0–lc5`…). Mobile ih koristi preko konteksta, web preko CSS promenljivih.

## Okruženja
- Dva Supabase projekta (`dev`, `prod`), migracije preko Supabase CLI-ja, tipovi se generišu iz baze u `@poznan/shared`.
- Web: Vercel preview za svaku granu. Mobile: EAS kanali `development`, `preview`, `production`.
