-- Podsetnici zadatka i pitanje posle roka:
--   tasks.reminders   podsetnici (datum i vreme) koje vlasnik doda u formi; ne u prošlost, ne posle dana roka
--   task_reminder     push u izabrano vreme: „Ostalo je još 2 dana do završetka zadatka „X““
--   task_due          podrazumevani podsetnik na dan roka u 06:00 (i kad nijedan nije dodat)
--   task_overdue      dan posle roka (u 08:00), ako zadatak nije završen: da li je završen ili da se promeni rok
-- Sve ide osobi koja je zadužena (obojici kad je zadatak za oba). Vreme je po Srbiji (Europe/Belgrade).
alter table public.tasks add column reminders timestamptz[] not null default '{}';

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'reply', 'reminder', 'job_start', 'task_due', 'task_assigned', 'limit',
                  'tx_income', 'tx_expense', 'tx_transfer', 'tx_contribution', 'tx_edit', 'tx_delete',
                  'task_reminder', 'task_overdue'));

-- Šta je već poslato (da isti podsetnik ne ode dvaput). Samo baza piše ovde, aplikacija ne vidi tabelu.
create table public.task_alerts (
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind text not null check (kind in ('reminder', 'overdue')),
  at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (task_id, kind, at)
);
alter table public.task_alerts enable row level security;

-- Provera podsetnika pri čuvanju zadatka (isto pravilo kao taskRemindersError u @poznan/shared)
create or replace function public.check_task_reminders() returns trigger
language plpgsql as $$
declare
  due_end timestamptz;
  added timestamptz[];
begin
  new.reminders := coalesce(array(select distinct x from unnest(new.reminders) x order by x), '{}');
  if cardinality(new.reminders) = 0 then return new; end if;
  if new.due is null then raise exception 'Za podsetnik prvo izaberi rok.' using errcode = 'P0001'; end if;
  if cardinality(new.reminders) > 10 then raise exception 'Najviše 10 podsetnika.' using errcode = 'P0001'; end if;
  due_end := (new.due + 1)::timestamp at time zone 'Europe/Belgrade';
  if exists (select 1 from unnest(new.reminders) x where x >= due_end) then
    raise exception 'Podsetnik ne može biti posle roka.' using errcode = 'P0001';
  end if;
  added := array(select x from unnest(new.reminders) x
                 where tg_op = 'INSERT' or not x = any (old.reminders));
  -- Malo slobode za sat na telefonu
  if exists (select 1 from unnest(added) x where x < now() - interval '5 minutes') then
    raise exception 'Podsetnik ne može biti u prošlosti.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger check_reminders before insert or update of reminders, due on public.tasks
  for each row execute function public.check_task_reminders();

-- Tekst podsetnika prema broju dana do roka (isto kao taskReminderText)
create or replace function public.task_reminder_text(title text, days int) returns text
language sql immutable as $$
  select case
    when days <= 0 then 'Danas je rok za zadatak „' || title || '“'
    when days % 10 = 1 and days % 100 <> 11 then 'Ostao je još ' || days || ' dan do završetka zadatka „' || title || '“'
    else 'Ostalo je još ' || days || ' dana do završetka zadatka „' || title || '“'
  end;
$$;

-- Obaveštenje osobi zaduženoj za zadatak (obojici kad je za oba)
create or replace function public.notify_task_people(t public.tasks, kind text, body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (to_user, from_user, type, target_type, target_id, text)
  select p.user_id, null, kind, 'task', t.id, left(body, 300)
  from public.profiles p join public.admins a on a.user_id = p.user_id
  where t.assignee = 'oba' or t.assignee = p.slug;
$$;
revoke execute on function public.notify_task_people(public.tasks, text, text) from public, authenticated, anon;

-- Pokreće pg_cron svakog minuta
create or replace function public.fire_task_alerts() returns int
language plpgsql security definer set search_path = public as $$
declare
  loc timestamp := now() at time zone 'Europe/Belgrade';
  today date := loc::date;
  r record;
  n int := 0;
begin
  -- 1) Podsetnici iz forme i podrazumevani na dan roka u 06:00 (isti trenutak se šalje jednom)
  for r in
    select t, x.at, x.dflt from public.tasks t
    cross join lateral (
      select u as at, false as dflt from unnest(t.reminders) u
      union all
      select (t.due + time '06:00') at time zone 'Europe/Belgrade', true
    ) x
    where t.deleted_at is null and t.status <> 'zavrseno' and t.due is not null
      and x.at <= now() and x.at > now() - interval '1 day'
      -- podrazumevani samo ako je zadatak postojao u 06:00 tog dana
      and (not x.dflt or t.created_at < x.at)
  loop
    insert into public.task_alerts (task_id, kind, at) values ((r.t).id, 'reminder', r.at) on conflict do nothing;
    if found then
      perform public.notify_task_people(r.t, case when r.dflt then 'task_due' else 'task_reminder' end,
        public.task_reminder_text((r.t).title, (r.t).due - (r.at at time zone 'Europe/Belgrade')::date));
      n := n + 1;
    end if;
  end loop;

  -- 2) Dan posle roka, od 08:00: pitanje da li je zadatak završen (jednom po roku; posle promene roka ponovo)
  if loc::time >= time '08:00' then
    for r in
      select t from public.tasks t
      where t.deleted_at is null and t.status <> 'zavrseno' and t.due is not null
        and t.due < today and t.due >= today - 2
        and t.created_at < (t.due + 1)::timestamp at time zone 'Europe/Belgrade'
    loop
      insert into public.task_alerts (task_id, kind, at)
      values ((r.t).id, 'overdue', (r.t).due::timestamp at time zone 'Europe/Belgrade') on conflict do nothing;
      if found then
        perform public.notify_task_people(r.t, 'task_overdue',
          'Rok za zadatak „' || (r.t).title || '“ je bio ' || case when (r.t).due = today - 1 then 'juče' else 'pre ' || (today - (r.t).due) || ' dana' end
          || '. Ako je završen, označi ga. Ako nije, promeni rok.');
        n := n + 1;
      end if;
    end loop;
  end if;
  return n;
end $$;
revoke execute on function public.fire_task_alerts() from public, authenticated, anon;

select cron.schedule('task-alerts', '* * * * *', $$ select public.fire_task_alerts(); $$);
