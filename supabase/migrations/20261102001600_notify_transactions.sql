-- Obaveštenje drugom vlasniku kad jedan unese prihod ili trošak (zvonce, baner u aplikaciji i push).
-- Trošak iz više izvora (isti split_id) daje jedno obaveštenje sa ukupnim iznosom.
-- Dodir na obaveštenje otvara detalje unosa (target_type = 'transaction').
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'reply', 'reminder', 'job_start', 'task_due', 'task_assigned', 'limit', 'tx_income', 'tx_expense'));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check
  check (target_type in ('task', 'job', 'company', 'transaction'));

-- Iznos kao u aplikaciji: 1.234.567 ili 1.234,50, sa valutom
create or replace function public.fmt_amount(n numeric, cur text) returns text
language sql immutable as $$
  select replace(replace(replace(
           to_char(n, case when n = trunc(n) then 'FM999,999,999,990' else 'FM999,999,999,990.00' end),
         ',', '~'), '.', ','), '~', '.') || ' ' || cur
$$;

create or replace function public.notify_transaction() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  total numeric;
  what text;
begin
  if me is null or new.deleted_at is not null then return null; end if;
  -- Više izvora: samo prvi red plaćanja pravi obaveštenje (svi redovi su upisani istim insertom)
  if new.split_id is not null then
    if exists (select 1 from public.notifications n join public.transactions t on t.id = n.target_id
               where n.target_type = 'transaction' and t.split_id = new.split_id) then
      return null;
    end if;
    select sum(amount_original) into total from public.transactions where split_id = new.split_id and deleted_at is null;
  else
    total := new.amount_original;
  end if;
  what := case when new.salary_to is not null
               then 'Plata · ' || (select name from public.profiles where slug = new.salary_to)
               else coalesce(nullif(new.description, ''), new.category) end;
  insert into public.notifications (to_user, from_user, type, target_type, target_id, text)
  select a.user_id, me, case when new.type = 'prihod' then 'tx_income' else 'tx_expense' end, 'transaction', new.id,
         left(public.fmt_amount(total, new.currency) || ' · ' || what, 300)
  from public.admins a where a.user_id <> me;
  return null;
end $$;
revoke execute on function public.notify_transaction() from authenticated, anon;
create trigger notify_transaction after insert on public.transactions
  for each row execute function public.notify_transaction();

-- Uživo osvežavanje na drugom telefonu (Realtime, uz RLS): obaveštenja i promet
do $$
declare t text;
begin
  foreach t in array array['notifications', 'transactions', 'owner_contributions', 'transfers'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
