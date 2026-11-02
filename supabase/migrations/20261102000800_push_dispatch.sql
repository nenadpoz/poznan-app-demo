-- Slanje obaveštenja na telefon (push): notifications je „outbox“, Edge Function notify-dispatch ga prazni.
-- Funkciju pokreće okidač pri novom obaveštenju i pg_cron svakog minuta (za odložena, van vremena slanja).
-- Adresa projekta i service_role ključ se čitaju iz Vault-a (project_url, service_role_key), kao za kurs NBS.

-- Novi tip: zadatak dodeljen drugom vlasniku
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'reply', 'reminder', 'job_start', 'task_due', 'task_assigned', 'limit'));

-- Zadatak dodeljen drugom vlasniku (ili obojici) → obaveštenje njemu
create or replace function public.notify_task_assigned() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or (tg_op = 'UPDATE' and new.assignee is not distinct from old.assignee) then return new; end if;
  insert into public.notifications (to_user, from_user, type, target_type, target_id, text)
  select p.user_id, me, 'task_assigned', 'task', new.id, left(new.title, 300)
  from public.profiles p
  where p.user_id <> me and (new.assignee = 'oba' or new.assignee = p.slug);
  return new;
end $$;
create trigger notify_task_assigned after insert or update of assignee on public.tasks
  for each row execute function public.notify_task_assigned();

-- Poziv funkcije za slanje; bez tajni u Vault-u ne radi ništa (obaveštenja ostaju u zvoncu)
create or replace function public.kick_notify_dispatch() returns void
language plpgsql security definer set search_path = public as $$
declare u text; k text;
begin
  select decrypted_secret into u from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into k from vault.decrypted_secrets where name = 'service_role_key';
  if u is null or k is null then return; end if;
  perform net.http_post(url := u || '/functions/v1/notify-dispatch', body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || k));
end $$;
revoke execute on function public.kick_notify_dispatch() from authenticated, anon;

create or replace function public.notification_kick() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.kick_notify_dispatch();
  return null;
end $$;
create trigger kick after insert on public.notifications
  for each statement execute function public.notification_kick();

-- Odložena (van vremena slanja) i podsetnici: svakog minuta, samo ako ima šta da se šalje
select cron.schedule('notify-dispatch', '* * * * *', $$
  select public.kick_notify_dispatch()
  where exists (select 1 from public.notifications where push_state = 'pending' and send_after <= now());
$$);
