-- Lično podešavanje: dugme glasovne komande na ekranu (podrazumevano vidljivo).
-- Kao tema i boje, menja samo izgled za taj nalog, pa ne ide u logove.
alter table public.profiles add column voice_button boolean not null default true;

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- Polja koja se ne beleže (tehnička, i lična podešavanja u profiles)
  skip text[] := array['updated_at', 'updated_by', 'client_at']
    || case when tg_table_name = 'profiles' then array['currency', 'theme', 'bar_colors', 'notif', 'voice_button'] else array[]::text[] end;
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and (o - skip) = (n - skip) then
    return new; -- ništa se suštinski nije promenilo
  end if;
  if tg_table_name = 'profiles' then
    o := o - array['currency', 'theme', 'bar_colors', 'notif', 'voice_button'];
    n := n - array['currency', 'theme', 'bar_colors', 'notif', 'voice_button'];
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
