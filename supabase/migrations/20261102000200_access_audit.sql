-- Pristup (RLS), audit trigger i pravila koja čuva baza.

-- ---------- Pomoćne funkcije ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.my_slug() returns text
language sql stable security definer set search_path = public as $$
  select slug from public.profiles where user_id = auth.uid();
$$;

-- updated_at / updated_by postavlja baza, ne aplikacija
create or replace function public.touch_row() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

-- Audit: staro i novo stanje, ko, kada; client_at iz reda (izmena napravljena offline)
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and (o - 'updated_at' - 'updated_by' - 'client_at') = (n - 'updated_at' - 'updated_by' - 'client_at') then
    return new; -- ništa se suštinski nije promenilo
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

-- ---------- Triggeri na svim tabelama sa podacima ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'settings', 'companies', 'company_history', 'clients', 'labels', 'jobs', 'job_pending_items',
    'job_reminders', 'job_photos', 'appointments', 'tasks', 'comments', 'transactions'
  ] loop
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_row()', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- ---------- Pravila ----------
-- Firma sa prometom ne može da se obriše (ni meko)
create or replace function public.guard_company_delete() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'DELETE' or (new.deleted_at is not null and old.deleted_at is null))
     and exists (select 1 from public.transactions where company_id = old.id and deleted_at is null) then
    raise exception 'Firma ima promet i ne može da se obriše. Zatvori je umesto brisanja.' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger guard_delete before update or delete on public.companies
  for each row execute function public.guard_company_delete();

-- Promena faze ili oblika upisuje istoriju (ako je aplikacija nije već upisala preko change_company_phase)
create or replace function public.company_form_history() returns trigger
language plpgsql as $$
begin
  if new.form is distinct from old.form then
    insert into public.company_history (company_id, kind, from_value, to_value, effective_date)
    values (new.id, 'form', old.form, new.form, current_date);
  end if;
  return new;
end $$;
create trigger form_history after update of form on public.companies
  for each row execute function public.company_form_history();

-- Status „Završeno“ i „Čeka uplatu“ menjaju se samo kroz RPC (finish_job, set_job_awaiting_payment)
create or replace function public.guard_job_status() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status and new.status in ('zavrseno', 'uplata')
     and coalesce(current_setting('poznan.via_rpc', true), '') <> 'on' then
    raise exception 'Status % se postavlja kroz naplatu posla.', new.status using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger guard_status before update of status on public.jobs
  for each row execute function public.guard_job_status();

-- Zadatak: done_at/done_by prate status
create or replace function public.task_done() returns trigger
language plpgsql as $$
begin
  if new.status = 'zavrseno' and (tg_op = 'INSERT' or old.status <> 'zavrseno') then
    new.done_at := now(); new.done_by := auth.uid();
  elsif new.status <> 'zavrseno' then
    new.done_at := null; new.done_by := null;
  end if;
  return new;
end $$;
create trigger task_done before insert or update of status on public.tasks
  for each row execute function public.task_done();

-- Komentar → obaveštenje drugom vlasniku (zvonce, push, email idu iz istog reda)
create or replace function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (to_user, from_user, type, target_type, target_id, comment_id, text)
  select a.user_id, new.user_id, case when new.parent_id is null then 'comment' else 'reply' end,
         new.target_type, new.target_id, new.id, left(new.text, 300)
  from public.admins a where a.user_id <> new.user_id;
  return new;
end $$;
create trigger notify after insert on public.comments
  for each row execute function public.notify_comment();

-- ---------- RLS ----------
do $$
declare t text;
begin
  -- Zajedničke tabele: oba admina sve vide i menjaju
  foreach t in array array[
    'settings', 'companies', 'company_history', 'clients', 'labels', 'jobs', 'job_pending_items',
    'job_reminders', 'job_photos', 'appointments', 'tasks', 'transactions', 'backups'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

alter table public.admins enable row level security;
create policy admins_read on public.admins for select to authenticated using (public.is_admin());

-- Profili: oba vide oba (imena, boje traka), menja se samo svoj
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Komentari: čitaju i pišu oba, menja i briše samo autor
alter table public.comments enable row level security;
create policy comments_read on public.comments for select to authenticated using (public.is_admin());
create policy comments_insert on public.comments for insert to authenticated with check (public.is_admin() and user_id = auth.uid());
create policy comments_own on public.comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy comments_delete_own on public.comments for delete to authenticated using (user_id = auth.uid());

-- Lično: svako samo svoje
alter table public.notifications enable row level security;
create policy notif_own_read on public.notifications for select to authenticated using (to_user = auth.uid());
create policy notif_own_update on public.notifications for update to authenticated using (to_user = auth.uid()) with check (to_user = auth.uid());

alter table public.push_tokens enable row level security;
create policy push_own on public.push_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.start_prompts enable row level security;
create policy prompts_own on public.start_prompts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Brojači i audit: samo čitanje (piše baza)
alter table public.invoice_counters enable row level security;
create policy counters_read on public.invoice_counters for select to authenticated using (public.is_admin());

alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_log from authenticated, anon;
