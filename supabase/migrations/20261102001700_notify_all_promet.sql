-- Svaki promet ide drugom vlasniku kao obaveštenje (zvonce, baner i push), ne samo nov prihod i trošak:
--   tx_transfer      nov prenos (podizanje ili polaganje keša)
--   tx_contribution  nov ulog vlasnika (ulog koji baza sama pravi uz trošak koji je platio vlasnik ne šalje se posebno)
--   tx_edit          izmena prihoda, troška ili uloga (iznos, datum, kategorija, komentar, klijent, račun…)
--   tx_delete        brisanje prihoda, troška, uloga ili prenosa
-- Trošak iz više izvora (isti split_id) daje jedno obaveštenje i pri izmeni i pri brisanju.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('comment', 'reply', 'reminder', 'job_start', 'task_due', 'task_assigned', 'limit',
                  'tx_income', 'tx_expense', 'tx_transfer', 'tx_contribution', 'tx_edit', 'tx_delete'));
alter table public.notifications drop constraint notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check
  check (target_type in ('task', 'job', 'company', 'transaction', 'transfer', 'contribution'));

-- Obaveštenje svim ostalim vlasnicima
create or replace function public.notify_others(kind text, ttype text, tid uuid, body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (to_user, from_user, type, target_type, target_id, text)
  select a.user_id, auth.uid(), kind, ttype, tid, left(body, 300)
  from public.admins a where a.user_id <> auth.uid();
$$;
revoke execute on function public.notify_others(text, text, uuid, text) from public, authenticated, anon;

-- Izmena i brisanje prihoda i troška
create or replace function public.notify_transaction_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  total numeric;
  what text;
  kind text;
  body text;
begin
  if auth.uid() is null or old.deleted_at is not null then return null; end if;
  if new.deleted_at is not null then
    kind := 'tx_delete';
  elsif (new.amount_original, new.currency, new.date, new.type, new.category, new.description, new.client_id,
         new.account_id, new.salary_to, new.paid_by, new.job_id)
        is distinct from
        (old.amount_original, old.currency, old.date, old.type, old.category, old.description, old.client_id,
         old.account_id, old.salary_to, old.paid_by, old.job_id) then
    kind := 'tx_edit';
  else
    return null;
  end if;
  if new.split_id is not null then
    select sum(amount_original) into total from public.transactions
    where split_id = new.split_id and (kind = 'tx_delete' or deleted_at is null);
  else
    total := new.amount_original;
  end if;
  what := case when new.salary_to is not null
               then 'Plata · ' || (select name from public.profiles where slug = new.salary_to)
               else coalesce(nullif(new.description, ''), new.category) end;
  body := left(case when new.type = 'prihod' then 'Prihod' else 'Trošak' end || ' · ' || public.fmt_amount(total, new.currency) || ' · ' || what, 300);
  -- Više izvora: jedno obaveštenje za ceo trošak (redovi se menjaju istim zahtevom)
  if new.split_id is not null and exists (
       select 1 from public.notifications n
       where n.type = kind and n.from_user = auth.uid() and n.text = body and n.created_at > now() - interval '1 minute') then
    return null;
  end if;
  perform public.notify_others(kind, case when kind = 'tx_delete' then null else 'transaction' end,
    case when kind = 'tx_delete' then null else new.id end, body);
  return null;
end $$;
revoke execute on function public.notify_transaction_change() from public, authenticated, anon;
create trigger notify_transaction_change after update on public.transactions
  for each row execute function public.notify_transaction_change();

-- Prenos: nov i obrisan (prenos se ne menja)
create or replace function public.notify_transfer() returns trigger
language plpgsql security definer set search_path = public as $$
declare body text;
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'UPDATE' and not (old.deleted_at is null and new.deleted_at is not null) then return null; end if;
  if tg_op = 'INSERT' and new.deleted_at is not null then return null; end if;
  body := public.fmt_amount(new.amount_original, new.currency) || ' · '
       || coalesce((select name from public.accounts where id = new.from_account_id), '—') || ' → '
       || coalesce((select name from public.accounts where id = new.to_account_id), '—')
       || coalesce(' · ' || nullif(new.note, ''), '');
  if tg_op = 'INSERT' then
    perform public.notify_others('tx_transfer', 'transfer', new.id, body);
  else
    perform public.notify_others('tx_delete', null, null, 'Prenos · ' || body);
  end if;
  return null;
end $$;
revoke execute on function public.notify_transfer() from public, authenticated, anon;
create trigger notify_transfer after insert or update of deleted_at on public.transfers
  for each row execute function public.notify_transfer();

-- Ulog vlasnika: nov, izmenjen i obrisan (osim uloga koji prati trošak; za njega stiže obaveštenje o trošku)
create or replace function public.notify_contribution() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  kind text;
  body text;
begin
  if auth.uid() is null or new.transaction_id is not null then return null; end if;
  if tg_op = 'INSERT' then
    if new.deleted_at is not null then return null; end if;
    kind := 'tx_contribution';
  elsif old.deleted_at is not null then
    return null;
  elsif new.deleted_at is not null then
    kind := 'tx_delete';
  elsif (new.owner, new.account_id, new.amount_original, new.currency, new.date, new.note)
        is distinct from (old.owner, old.account_id, old.amount_original, old.currency, old.date, old.note) then
    kind := 'tx_edit';
  else
    return null;
  end if;
  body := 'Ulog · ' || coalesce((select name from public.profiles where slug = new.owner), new.owner) || ' · '
       || public.fmt_amount(new.amount_original, new.currency) || coalesce(' · ' || nullif(new.note, ''), '');
  perform public.notify_others(kind, case when kind = 'tx_delete' then null else 'contribution' end,
    case when kind = 'tx_delete' then null else new.id end, body);
  return null;
end $$;
revoke execute on function public.notify_contribution() from public, authenticated, anon;
create trigger notify_contribution after insert or update on public.owner_contributions
  for each row execute function public.notify_contribution();
