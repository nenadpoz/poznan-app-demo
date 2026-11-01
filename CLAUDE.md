# Poznan App

Interna aplikacija za dva vlasnika (Nenad i Jovan) za upravljanje sa više firmi, prihodima, troškovima i klijentima.
Oba korisnika su admini sa istim pravima. Svaka izmena se beleži u logove (ko, šta, kada, stara i nova vrednost).

## Faze
1. **Demo** (`demo/index.html`): klikabilan HTML prototip, bez build alata. Trenutna faza.
2. **Mobile** (`apps/mobile`): Expo (React Native) + TypeScript, prvo Android, zatim iOS.
3. **Web** (`apps/web`): Next.js App Router.

Detalji: [docs/roadmap.md](docs/roadmap.md), [docs/domain.md](docs/domain.md), [docs/architecture.md](docs/architecture.md).

## Pravila
- UI je na srpskom, latinica. Valuta je RSD, format `1.234.567 RSD`, datumi `21. okt 2026.`.
- Web i mobile koriste **isti API**: sve ide kroz `packages/api`. Ekrani nikada ne zovu Supabase direktno.
- Poslovna pravila (paušal limit, PDV prag, rokovi) žive u `packages/shared` i pokrivena su testovima.
- Limiti nisu hardkodovani u UI-ju. Čitaju se iz podešavanja (podrazumevano 6.000.000 i 8.000.000 RSD).
- Klijenti su nezavisni od firmi. Veza klijent–firma nastaje samo preko transakcije (usluge). Transakcija može biti i bez firme (keš bez računa).
- Svaka izmena podataka mora proći kroz audit log. U bazi to radi trigger, ne kod aplikacije.
- Glasovna komanda nikada ne čuva direktno. Uvek otvara popunjenu formu za potvrdu.
- Tema: svetla, tamna i sistemska. Boje samo preko tokena (`packages/shared/theme`), bez literalnih boja u komponentama.

## Monorepo
```
demo/             HTML demo (faza 1)
apps/mobile/      Expo
apps/web/         Next.js
packages/api/     zajednički API sloj (Supabase klijent + TanStack Query hookovi)
packages/shared/  tipovi, zod, poslovna pravila, tema
supabase/         migracije, RLS, edge functions
docs/
```
Planirano: pnpm workspaces + Turborepo, TypeScript strict.

## Demo
Otvori `demo/index.html` u Chrome-u. Stanje se čuva u `localStorage` (ključ `poznan-demo-v7`). Za povratak primera obriši taj ključ u alatima pregledača. Demo prikazuje samo tokove ekrana, pa Podešavanja imaju samo Firme, Logove, Kategorije poslova, Boje traka limita i Obaveštenja (oba lično po nalogu). Tema, lozinka, limiti i backup su opisani u docs/domain.md, ali se u demou ne prikazuju.
