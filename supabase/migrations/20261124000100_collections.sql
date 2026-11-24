-- Kolekcije (zahtev vlasnika 24. nov 2026.): u Podešavanjima folderi sa nazivom (npr. „Osnove geologije“),
-- a u svakom više PDF-ova, slika (PNG, JPG) i linkova (naziv + adresa). Fajlovi su u privatnom bucketu „documents“, putanja
-- „kolekcije/<id kolekcije>/<uuid>.<pdf|png|jpg>“. Brisanje je meko (ostaje u logovima); fajl briše aplikacija.

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  description text check (length(description) <= 1000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);

create table public.collection_files (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id),
  name text not null check (length(btrim(name)) between 1 and 200),
  storage_path text unique,
  content_type text check (content_type in ('application/pdf', 'image/png', 'image/jpeg')),
  url text check (url ~* '^https?://'),
  size_bytes integer check (size_bytes >= 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz,
  -- Stavka je fajl (putanja i vrsta) ili link (adresa)
  check ((url is null) = (storage_path is not null) and (storage_path is null) = (content_type is null))
);
create index on public.collection_files (collection_id) where deleted_at is null;

-- Brisanje kolekcije briše (meko) i njene fajlove
create or replace function public.collection_soft_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.collection_files set deleted_at = now() where collection_id = new.id and deleted_at is null;
  end if;
  return new;
end $$;
create trigger collection_soft_delete after update of deleted_at on public.collections
  for each row execute function public.collection_soft_delete();

create trigger touch before update on public.collections for each row execute function public.touch_row();
create trigger audit after insert or update or delete on public.collections for each row execute function public.audit_row_change();
create trigger touch before update on public.collection_files for each row execute function public.touch_row();
create trigger audit after insert or update or delete on public.collection_files for each row execute function public.audit_row_change();
alter table public.collections enable row level security;
create policy admin_all on public.collections for all to authenticated using (public.is_admin()) with check (public.is_admin());
alter table public.collection_files enable row level security;
create policy admin_all on public.collection_files for all to authenticated using (public.is_admin()) with check (public.is_admin());
