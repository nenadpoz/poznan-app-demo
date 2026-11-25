-- Zauzeće prostora (zahtev vlasnika 25. nov 2026.): u Podešavanjima traka koliko je popunjena baza i prostor za fajlove
-- u odnosu na granice plana. Supabase besplatni plan: baza 500 MB, fajlovi 1 GB; posle prelaska na veći plan
-- menjaju se granice u settings (Pro: baza 8 GB, fajlovi 100 GB).
alter table public.settings
  add column db_limit_mb integer not null default 500 check (db_limit_mb > 0),
  add column storage_limit_mb integer not null default 1024 check (storage_limit_mb > 0);

-- Veličina baze i zbir veličina fajlova u skladištu (samo čita; samo za vlasnike)
create or replace function public.storage_usage() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Nema pristupa' using errcode = '42501'; end if;
  return json_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
    'files', (select count(*) from storage.objects)
  );
end $$;
revoke execute on function public.storage_usage() from anon, public;
grant execute on function public.storage_usage() to authenticated;
