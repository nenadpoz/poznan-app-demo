-- Lična podešavanja prikaza na nalogu (valuta prikaza, tema, boje traka limita, obaveštenja) ne idu u logove:
-- menjaju samo izgled za tog korisnika, ne podatke. Izmena imena ili emaila profila se i dalje beleži.
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Polja koja se ne beleže (tehnička, i lična podešavanja u profiles)
  skip text[] := array['updated_at', 'updated_by', 'client_at']
    || case when tg_table_name = 'profiles' then array['currency', 'theme', 'bar_colors', 'notif'] else array[]::text[] end;
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and (o - skip) = (n - skip) then
    return new; -- ništa se suštinski nije promenilo
  end if;
  if tg_table_name = 'profiles' then
    o := o - array['currency', 'theme', 'bar_colors', 'notif'];
    n := n - array['currency', 'theme', 'bar_colors', 'notif'];
  end if;
  insert into public.audit_log (user_id, table_name, row_id, action, old, new, client_at)
  values (
    auth.uid(), tg_table_name,
    coalesce(n ->> 'id', o ->> 'id', n ->> 'user_id', o ->> 'user_id'),
    lower(tg_op), o, n,
    nullif(coalesce(n ->> 'client_at', o ->> 'client_at'), '')::timestamptz
  );
  return coalesce(new, old);
end $$;

-- Postojeći zapisi koji su menjali samo lična podešavanja
delete from public.audit_log
where table_name = 'profiles' and action = 'update'
  and (old - array['currency', 'theme', 'bar_colors', 'notif', 'updated_at', 'updated_by', 'client_at'])
    = (new - array['currency', 'theme', 'bar_colors', 'notif', 'updated_at', 'updated_by', 'client_at']);
