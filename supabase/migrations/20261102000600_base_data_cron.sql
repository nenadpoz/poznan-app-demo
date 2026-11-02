-- Osnovni podaci bez kojih aplikacija ne radi, i rasporedi (pg_cron).
-- Primer podataka (klijenti, početno stanje) ostaje samo u seed.sql za lokalni razvoj.

-- Jedan red podešavanja (limiti 6.000.000 i 8.000.000 RSD)
insert into public.settings (id) values (true) on conflict do nothing;

-- Firme vlasnika; svaka automatski dobija svoj račun. PIB, MB i adresa se unose u Podešavanjima.
insert into public.companies (id, name, form, phase, activity, icon) values
  ('00000000-0000-0000-0000-0000000000d1', 'Poznan Drill', 'pausal', 'aktivna', 'Bušenje bunara', 'drill'),
  ('00000000-0000-0000-0000-0000000000d2', 'Poznan Trans', 'pausal', 'aktivna', 'Drumski prevoz robe', 'truck')
on conflict (id) do nothing;

insert into public.labels (name, color)
select v.name, v.color from (values ('Bušenje bunara', 0), ('Servis pumpe', 1), ('Prevoz', 2), ('Iskop', 3), ('Ostalo', 5)) as v(name, color)
where not exists (select 1 from public.labels l where lower(l.name) = lower(v.name) and l.deleted_at is null);

-- ---------- Rasporedi ----------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Podsetnici za uplatu, svakog minuta
select cron.schedule('job-reminders', '* * * * *', $$ select public.fire_due_reminders(); $$);

-- Kurs NBS radnim danima (lista izlazi oko 8h; 12h i 16h su rezerva).
-- Adresa funkcije i ključ se čitaju iz Vault-a (jednom po projektu, vidi supabase/README.md); u kodu nema ključeva.
select cron.schedule('fx-rates', '15 8,12,16 * * 1-5', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/fx-rates',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'))
  );
$$);
