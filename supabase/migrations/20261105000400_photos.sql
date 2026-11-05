-- Slike uz klijenta, saradnika, posao i zadatak (jedna ili više). Fajl je u privatnom Storage bucketu „photos“,
-- putanja „<vrsta>/<id>/<uuid>.jpg“; red u tabeli photos je ono što aplikacija vidi i što ide u logove.
-- Uklanjanje slike: red se meko briše (ostaje u logovima), a fajl se briše iz bucketa.
-- job_photos (iz prve šeme) se ne koristi; ostaje dok se ne obriše posebnom migracijom.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy photos_admin on storage.objects for all to authenticated
  using (bucket_id = 'photos' and public.is_admin())
  with check (bucket_id = 'photos' and public.is_admin());

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('client', 'supplier', 'job', 'task')),
  target_id uuid not null,
  storage_path text not null unique,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz
);
create index on public.photos (target_type, target_id) where deleted_at is null;

create trigger touch before update on public.photos for each row execute function public.touch_row();
create trigger audit after insert or update or delete on public.photos for each row execute function public.audit_row_change();
alter table public.photos enable row level security;
create policy admin_all on public.photos for all to authenticated using (public.is_admin()) with check (public.is_admin());
