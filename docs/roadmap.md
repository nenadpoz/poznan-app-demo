# Roadmap

## Faza 1: Klikabilan demo (u toku)
- [x] `demo/index.html`: svi ekrani, kalendar poslova (mesec, nedelja, dan), zadaci sa zaduženjima, lozinke, primer podataka, logovi, glasovni unos (simulacija parsiranja), light/dark tema.
- [ ] Feedback od oba vlasnika, izmene toka i polja.

## Faza 2: Mobilna aplikacija (Android)
- [ ] Monorepo: pnpm + Turborepo, `packages/shared`, `packages/api`.
- [ ] Supabase: šema, RLS, audit trigger, Storage za slike.
- [ ] Expo app: login, kalendar, zadaci, firme, klijenti, promet, dashboard, logovi, podešavanja, tema.
- [ ] Glasovne komande: `expo-speech-recognition` + Edge Function `voice-parse`.
- [ ] Push notifikacije (`expo-notifications` + Edge Function na pg_cron): kad dođe datum i vreme početka posla koji je Na čekanju, stiže obaveštenje „Da li da prebacim [klijent] · [vrsta posla] u U procesu?“. Dodir otvara isto pitanje u aplikaciji. U demou se pitanje pojavljuje samo dok je aplikacija otvorena.
- [ ] Email obaveštenja (Edge Function + email servis): ista obaveštenja kao push, na adresu koju svaki korisnik upiše u Podešavanja → Obaveštenja. Slanje poštuje lična podešavanja (kanali i vrste obaveštenja).
- [ ] Backup na Google Drive (pg_cron + Edge Function).
- [ ] Interni build (EAS) za oba telefona.

## Faza 3: iOS i web
- [ ] iOS build iz iste Expo baze.
- [ ] Next.js web app na istom `packages/api`.
