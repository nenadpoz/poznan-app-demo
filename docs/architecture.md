# Arhitektura

## Pregled
```
apps/mobile (Expo)  ─┐
                     ├─> packages/api ──> Supabase (Postgres + Auth + Storage + Edge Functions)
apps/web (Next.js)  ─┘        │
                       packages/shared (tipovi, zod, poslovna pravila, tema)
```
- **Isti API za web i mobile.** `packages/api` izlaže tipizovane funkcije (`clients.list`, `transactions.create`...) i TanStack Query hookove. Obe aplikacije koriste samo njih.
- Backend je jedan: Supabase. Poslovna pravila koja moraju biti tačna (audit, pristup) žive u bazi.

## Tehnologije
| Sloj | Izbor |
|---|---|
| Mobile | Expo + React Native + TypeScript, Expo Router, TanStack Query |
| Web | Next.js App Router, isti `packages/api` |
| Monorepo | pnpm workspaces + Turborepo |
| Baza / Auth / Slike | Supabase Postgres, Supabase Auth (email + lozinka, 2 naloga: pozivnica za prvo postavljanje lozinke, reset preko email linka, admin reset preko Edge Function sa service ključem), Supabase Storage |
| Validacija | zod, šeme dele web i mobile |

## Audit log
- Postgres trigger `audit_row_change()` na svim tabelama upisuje u `audit_log`: `user_id` (iz `auth.uid()`), tabela, akcija, `old` i `new` JSONB, vreme.
- Aplikacija ne može da zaobiđe log. Tabela `audit_log` je samo za čitanje iz klijenta.

## Pristup
- RLS: pristup imaju samo korisnici iz tabele `admins` (dva naloga). Registracija je isključena.

## Glasovne komande
1. **Govor u tekst**: on-device prepoznavanje na Androidu (`expo-speech-recognition`, jezik `sr-RS`). Besplatno, radi i bez slanja zvuka na server.
2. **Tekst u strukturu**: Supabase Edge Function `voice-parse` šalje tekst Claude API-ju (Haiku) sa tool definicijama `create_client`, `create_transaction`, `update_client`... Model vraća strukturisan predlog.
3. **Potvrda**: aplikacija otvara popunjenu formu. Ništa se ne čuva bez potvrde.

Zašto ne lokalni model kao prvi izbor: mali modeli na telefonu (Gemma preko MediaPipe ili llama.rn) rade offline, ali slabije razumeju srpski padež i adrese, a aplikacija postaje teža za stotine MB. Za dva korisnika cloud parsiranje košta zanemarljivo. Lokalni model ostaje opcija iza istog interfejsa `parseVoiceCommand(text)`.

## Backup
- `pg_cron` pokreće Edge Function `backup-drive` svakih N dana.
- Funkcija pravi JSON export svih tabela i kopira slike iz Storage-a, pa ih šalje na Google Drive (OAuth nalog vlasnika, folder „Poznan / Backup“). Čuva poslednjih 10 backup-a.
- Rezultat se upisuje u `backups` i u audit log.

## Tema
- Tokeni boja za svetlu i tamnu temu u `packages/shared/theme`. Mobile ih koristi preko konteksta, web preko CSS promenljivih.
- Izbor teme je po korisniku i čuva se u profilu.
