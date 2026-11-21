-- Dokumentacija (zahtev vlasnika 21. nov 2026.): u Podešavanjima lista dokumenata (ugovori, dozvole, osiguranja…).
-- Dokument ima naziv, jedan fajl (PDF, PNG ili JPG), datum isteka, opis i komentare.
-- Podsetnik za istek je zadatak vezan za dokument (tasks.document_id): rok je dan isteka, zadužena osoba se bira,
-- a podrazumevani podsetnik je mesec dana pre isteka (pravi ga aplikacija, kao i dodatne podsetnike).
-- Fajl je u privatnom bucketu „documents“, putanja „<id dokumenta>/<uuid>.<pdf|png|jpg>“.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy documents_admin on storage.objects for all to authenticated
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text check (length(description) <= 2000),
  expires_on date,
  storage_path text unique,
  file_name text,
  content_type text check (content_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer check (size_bytes >= 0),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz,
  check ((storage_path is null) = (content_type is null))
);
create index on public.documents (expires_on) where deleted_at is null;

create trigger touch before update on public.documents for each row execute function public.touch_row();
create trigger audit after insert or update or delete on public.documents for each row execute function public.audit_row_change();
alter table public.documents enable row level security;
create policy admin_all on public.documents for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Zadatak (podsetnik) vezan za dokument
alter table public.tasks add column document_id uuid references public.documents (id);
create index on public.tasks (document_id) where document_id is not null;

-- Brisanje dokumenta briše (meko) i njegove nezavršene zadatke
create or replace function public.document_soft_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update public.tasks set deleted_at = now() where document_id = new.id and deleted_at is null and status <> 'zavrseno';
  end if;
  return new;
end $$;
create trigger document_soft_delete after update of deleted_at on public.documents
  for each row execute function public.document_soft_delete();

-- Komentari i obaveštenja i na dokumentu
alter table public.comments drop constraint comments_target_type_check;
alter table public.comments add constraint comments_target_type_check
  check (target_type in ('task', 'job', 'company', 'transaction', 'transfer', 'contribution', 'document'));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check
  check (target_type in ('task', 'job', 'company', 'transaction', 'transfer', 'contribution', 'document'));
