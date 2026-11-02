# Roadmap

## Faza 1: Klikabilan demo ✅
- [x] `demo/index.html` sa svim tokovima (vidi `docs/domain.md`), objavljen kao deljeni link.

## Faza 2: Core (ovaj repo)
- [x] Dokumentacija domena i arhitekture.
- [ ] Workspace: pnpm, TypeScript strict, Vitest.
- [ ] `@poznan/shared`: tipovi, zod šeme, poslovna pravila (limiti, PDV, statusi posla, naplata, faktura, obaveštenja, period zarade), tema; testovi.
- [ ] `supabase/`: šema, RLS, audit trigger, RPC (`finish_job`, `set_job_awaiting_payment`, `next_invoice_no`), seed iz demoa; pgTAP testovi.
- [ ] `@poznan/api`: interfejs repozitorijuma + web adapter (Supabase) + mobile adapter (PowerSync); TanStack Query hookovi.
- [ ] Edge Functions: `notify-dispatch`, `invoice-pdf`, `voice-parse`, `backup-drive`, `admin-reset-password`; pg_cron poslovi.
- [ ] Supabase projekti `dev` i `prod`.

## Faza 3: Mobile (poseban repo, Android pa iOS)
- [ ] Expo + Expo Router, tema, prijava.
- [x] Računi firmi i zaliha keša, prenosi (podizanje), brojač stanja na naslovnoj, EUR/RSD prikaz sa srednjim kursom NBS (domain.md, odeljak 15). Prvo migracija i pravila u core-u.
- [ ] PowerSync (pun offline).
- [ ] Ekrani: Pregled, Promet, Poslovi (lista, kalendar, kartica, naplata, faktura, podsetnici), Zadaci, Klijenti, Firme, Podešavanja, Logovi.
- [ ] Push notifikacije (`expo-notifications`): komentari, odgovori, podsetnici, početak posla, rokovi, limit.
- [ ] Glasovne komande.
- [ ] EAS interni build za oba telefona, zatim iOS.

## Faza 4: Web (poseban repo)
- [ ] Next.js App Router na `@poznan/api` (web adapter), isti ekrani, raspored za veliki ekran.
- [ ] Vercel, preview po grani.

## Kasnije
- [ ] Slanje faktura na SEF.
- [ ] Backup na Google Drive.
