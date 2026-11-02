# Poznan App (core)

Upravljanje firmama, prometom, poslovima i klijentima za dva vlasnika.

- **Demo:** otvori `[demo](https://nenadpoz.github.io/poznan-app-demo/demo/)` u Chrome-u.
- **Paketi:** `packages/shared` (pravila, zod, tema), `packages/api` (API sloj za oba klijenta).
- **Baza:** `supabase/` (migracije, RLS, audit, RPC).
- **Aplikacije:** [poznan-app-mobile](https://github.com/nenadpoz/poznan-app-mobile) (Expo), [poznan-app-web](https://github.com/nenadpoz/poznan-app-web) (Next.js).
- **Dokumentacija:** [docs/](docs/) (domen, arhitektura, roadmap).

```bash
corepack pnpm@9.12.3 install
corepack pnpm@9.12.3 -r test
```
