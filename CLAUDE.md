# Poznan App

Interna aplikacija za dva vlasnika (Nenad i Jovan) za upravljanje sa više firmi, prihodima, troškovima i klijentima.
Oba korisnika su admini sa istim pravima. Svaka izmena se beleži u logove (ko, šta, kada, stara i nova vrednost).

## Faze
1. **Demo** (`demo/index.html`): klikabilan HTML prototip, bez build alata. Završeno.
2. **Core** (ovaj repo): `packages/shared`, `packages/api`, `supabase/`. Trenutna faza.
3. **Mobile** ([poznan-app-mobile](https://github.com/nenadpoz/poznan-app-mobile)): Expo (React Native) + TypeScript, pun offline, prvo Android, zatim iOS.
4. **Web** ([poznan-app-web](https://github.com/nenadpoz/poznan-app-web)): Next.js App Router.

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

## Repo (core)
```
demo/             HTML demo (faza 1)
packages/shared/  @poznan/shared: tipovi, zod, poslovna pravila, tema (+ testovi)
packages/api/     @poznan/api: interfejs, Supabase adapter, TanStack Query hookovi
supabase/         migracije, RLS, audit trigger, RPC, seed
docs/
```
Mobile i web su posebni repoi i koriste pakete kao git zavisnost (vidi docs/architecture.md).
pnpm workspaces, TypeScript strict. pnpm nije globalno instaliran: `corepack pnpm@9.12.3 install`, `corepack pnpm@9.12.3 -r test`, `corepack pnpm@9.12.3 -r typecheck`.
Izmene šeme idu kao nova migracija u `supabase/migrations`, nikad izmenom postojeće posle objave.

## Demo
Otvori `demo/index.html` u Chrome-u. Stanje se čuva u `localStorage` (ključ `poznan-demo-v7`). Za povratak primera obriši taj ključ u alatima pregledača. Demo prikazuje samo tokove ekrana (lozinke se ne proveravaju). Podešavanja imaju Firme, Logove, Kategorije poslova, Kategorije prometa, Boje traka limita, Obaveštenja, Lozinku i Temu (boje, obaveštenja i tema lično po nalogu), kao u mobilnoj aplikaciji. Limiti i backup su opisani u docs/domain.md, ali se u demou ne prikazuju.
