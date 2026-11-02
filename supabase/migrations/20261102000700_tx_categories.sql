-- Kategorije prometa (prihodi i troškovi): dodaju se i brišu u Podešavanjima.
-- Unos prometa čuva naziv kategorije (transactions.category), pa brisanje kategorije ne menja postojeće unose.
-- „Plata“ nije ovde: postavlja je isplata plate.
create table public.tx_categories (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('prihod', 'trosak')),
  name text not null check (length(trim(name)) > 0),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create unique index tx_categories_name_uq on public.tx_categories (type, lower(name)) where deleted_at is null;

insert into public.tx_categories (type, name, sort) values
  ('prihod', 'Usluga', 1), ('prihod', 'Prodaja robe', 2), ('prihod', 'Održavanje', 3), ('prihod', 'Ostalo', 99),
  ('trosak', 'Materijal', 1), ('trosak', 'Gorivo', 2), ('trosak', 'Knjigovođa', 3), ('trosak', 'Porez i doprinosi', 4),
  ('trosak', 'Oprema', 5), ('trosak', 'Zakup', 6), ('trosak', 'Alat', 7), ('trosak', 'Ostalo', 99);

create trigger touch before update on public.tx_categories for each row execute function public.touch_row();
create trigger audit after insert or update or delete on public.tx_categories for each row execute function public.audit_row_change();
alter table public.tx_categories enable row level security;
create policy admin_all on public.tx_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
