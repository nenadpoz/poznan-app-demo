-- Vreme podrazumevanog podsetnika na dan roka:
--   profiles.notif.taskTime   lično podešavanje (Obaveštenja), npr. '08:00'; bez njega 06:00
--   tasks.due_time            vreme izabrano samo za taj zadatak; null znači „po podešavanjima“ svakog primaoca
-- Kad je zadatak za oba i nema svoje vreme, svako dobija podsetnik u svoje vreme.
alter table public.tasks add column due_time text check (due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Obaveštenje jednoj osobi (isto kao notify_task_people, ali za jednog primaoca)
create or replace function public.notify_task_user(t public.tasks, uid uuid, kind text, body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (to_user, from_user, type, target_type, target_id, text)
  values (uid, null, kind, 'task', t.id, left(body, 300));
$$;
revoke execute on function public.notify_task_user(public.tasks, uuid, text, text) from public, authenticated, anon;

create or replace function public.fire_task_alerts() returns int
language plpgsql security definer set search_path = public as $$
declare
  loc timestamp := now() at time zone 'Europe/Belgrade';
  today date := loc::date;
  r record;
  tr public.tasks;
  n int := 0;
begin
  -- 1a) Podsetnici iz forme (isti trenutak se šalje jednom)
  for r in
    select t, u as at from public.tasks t cross join lateral unnest(t.reminders) u
    where t.deleted_at is null and t.status <> 'zavrseno' and t.due is not null
      and u <= now() and u > now() - interval '1 day'
  loop
    insert into public.task_alerts (task_id, kind, at) values ((r.t).id, 'reminder', r.at) on conflict do nothing;
    if found then
      perform public.notify_task_people(r.t, 'task_reminder',
        public.task_reminder_text((r.t).title, (r.t).due - (r.at at time zone 'Europe/Belgrade')::date));
      n := n + 1;
    end if;
  end loop;

  -- 1b) Podrazumevani na dan roka: vreme zadatka, inače lično vreme primaoca, inače 06:00
  for r in
    select t.id, x.at, array_agg(p.user_id) as users
    from public.tasks t
    join public.profiles p on t.assignee = 'oba' or t.assignee = p.slug
    join public.admins a on a.user_id = p.user_id
    cross join lateral (
      select (t.due + coalesce(t.due_time, case when p.notif ->> 'taskTime' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then p.notif ->> 'taskTime' end, '06:00')::time) at time zone 'Europe/Belgrade' as at
    ) x
    where t.deleted_at is null and t.status <> 'zavrseno' and t.due is not null
      and t.due between today - 1 and today
      and x.at <= now() and x.at > now() - interval '1 day'
      -- samo ako je zadatak postojao u to vreme
      and t.created_at < x.at
    group by t.id, x.at
  loop
    insert into public.task_alerts (task_id, kind, at) values (r.id, 'reminder', r.at) on conflict do nothing;
    if found then
      select * into tr from public.tasks where id = r.id;
      perform public.notify_task_user(tr, u, 'task_due', public.task_reminder_text(tr.title, 0)) from unnest(r.users) u;
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
