-- Računi (firme + zaliha keša), prenosi, kursna lista NBS i valuta prikaza.
-- Svaka transakcija ima račun (izvor ili odredište), originalni iznos i valutu, kurs tog dana
-- i `amount` u dinarima (za limite, zbirove i stanje). Prenos nije prihod ni trošak.

-- ---------- Kursna lista ----------
create table public.fx_rates (
  date date primary key, -- datum kursne liste NBS
  eur numeric(10,4) not null check (eur > 0), -- srednji kurs: 1 EUR = x RSD
  source text not null default 'nbs',
  fetched_at timestamptz not null default now()
);

-- Kurs za dan: lista tog dana ili poslednja pre (vikend, praznik)
create or replace function public.eur_rate_for(p_date date) returns numeric
language sql stable security definer set search_path = public as $$
  select eur from public.fx_rates where date <= p_date order by date desc limit 1;
$$;

-- ---------- Računi ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('company', 'cash')),
  company_id uuid unique references public.companies (id),
  name text not null,
  opening_balance numeric(14,2) not null default 0, -- RSD
  opening_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz,
  check ((kind = 'company') = (company_id is not null))
);
create unique index accounts_one_cash on public.accounts (kind) where kind = 'cash';

insert into public.accounts (kind, name) values ('cash', 'Keš');
insert into public.accounts (kind, company_id, name) select 'company', id, name from public.companies;

-- Nova firma dobija svoj račun; naziv računa prati naziv firme
create or replace function public.company_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.accounts (kind, company_id, name) values ('company', new.id, new.name);
  elsif new.name is distinct from old.name then
    update public.accounts set name = new.name where company_id = new.id;
  end if;
  return new;
end $$;
create trigger company_account after insert or update of name on public.companies
  for each row execute function public.company_account();

-- ---------- Transakcije: račun, valuta, kurs, ko je uneo ----------
alter table public.transactions
  add column account_id uuid references public.accounts (id),
  add column currency text not null default 'RSD' check (currency in ('RSD', 'EUR')),
  add column amount_original numeric(14,2),
  add column fx_rate numeric(10,4),
  add column created_by uuid default auth.uid() references auth.users (id);

update public.transactions t set
  account_id = coalesce((select id from public.accounts a where a.company_id = t.company_id), (select id from public.accounts where kind = 'cash')),
  amount_original = amount, fx_rate = 1;

alter table public.transactions alter column account_id set not null, alter column amount_original set not null;
create index on public.transactions (account_id, date);

/*
 * Račun je izvor istine za firmu: company_id se izvodi iz računa.
 * Stari pozivi bez računa (npr. finish_job sa company_id) dobijaju račun firme ili keš.
 * Dinarski iznos = originalni × kurs tog dana (za RSD kurs je 1).
 */
create or replace function public.tx_account_currency() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  if new.account_id is null then
    select * into a from public.accounts where deleted_at is null and
      (case when new.company_id is null then kind = 'cash' else company_id = new.company_id end);
  else
    select * into a from public.accounts where id = new.account_id;
  end if;
  if a.id is null then raise exception 'Račun ne postoji' using errcode = 'P0001'; end if;
  new.account_id := a.id;
  new.company_id := a.company_id;

  new.amount_original := coalesce(new.amount_original, new.amount);
  if new.currency = 'RSD' then
    new.fx_rate := 1;
  elsif tg_op = 'INSERT' or new.fx_rate is null or new.date is distinct from old.date
        or new.amount_original is distinct from old.amount_original or new.currency is distinct from old.currency then
    -- Kurs se uzima pri unosu (i pri promeni datuma, iznosa ili valute), posle se ne menja
    new.fx_rate := coalesce(public.eur_rate_for(new.date), new.fx_rate);
    if new.fx_rate is null then raise exception 'Nema kursa EUR za %', new.date using errcode = 'P0001'; end if;
  end if;
  new.amount := round(new.amount_original * new.fx_rate, 2);
  if tg_op = 'UPDATE' then new.created_by := old.created_by; end if;
  return new;
end $$;
create trigger tx_account_currency before insert or update on public.transactions
  for each row execute function public.tx_account_currency();

-- ---------- Prenosi (podizanje / polaganje keša) ----------
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.accounts (id),
  to_account_id uuid not null references public.accounts (id),
  amount numeric(14,2) not null check (amount > 0), -- RSD
  currency text not null default 'RSD' check (currency in ('RSD', 'EUR')),
  amount_original numeric(14,2) not null check (amount_original > 0),
  fx_rate numeric(10,4),
  date date not null default current_date,
  note text,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz,
  check (from_account_id <> to_account_id)
);
create index on public.transfers (date);

create or replace function public.transfer_currency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.currency = 'RSD' then
    new.fx_rate := 1;
  elsif tg_op = 'INSERT' or new.fx_rate is null or new.date is distinct from old.date
        or new.amount_original is distinct from old.amount_original or new.currency is distinct from old.currency then
    new.fx_rate := coalesce(public.eur_rate_for(new.date), new.fx_rate);
    if new.fx_rate is null then raise exception 'Nema kursa EUR za %', new.date using errcode = 'P0001'; end if;
  end if;
  new.amount := round(new.amount_original * new.fx_rate, 2);
  if tg_op = 'UPDATE' then new.created_by := old.created_by; end if;
  return new;
end $$;
create trigger transfer_currency before insert or update on public.transfers
  for each row execute function public.transfer_currency();

-- ---------- Stanje računa ----------
create view public.account_balances with (security_invoker = true) as
select
  a.id as account_id, a.kind, a.company_id, a.name, a.opening_balance,
  a.opening_balance
    + coalesce((select sum(case when t.type = 'prihod' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id and t.deleted_at is null and t.date >= a.opening_date), 0)
    + coalesce((select sum(x.amount) from public.transfers x where x.to_account_id = a.id and x.deleted_at is null and x.date >= a.opening_date), 0)
    - coalesce((select sum(x.amount) from public.transfers x where x.from_account_id = a.id and x.deleted_at is null and x.date >= a.opening_date), 0)
    as balance,
  greatest(
    (select max(t.updated_at) from public.transactions t where t.account_id = a.id),
    (select max(x.updated_at) from public.transfers x where a.id in (x.from_account_id, x.to_account_id)),
    a.updated_at
  ) as changed_at
from public.accounts a
where a.deleted_at is null;

-- ---------- Valuta prikaza po nalogu ----------
alter table public.profiles add column currency text not null default 'EUR' check (currency in ('EUR', 'RSD'));

-- ---------- Touch, audit, RLS ----------
create trigger touch before update on public.accounts for each row execute function public.touch_row();
create trigger audit after insert or update or delete on public.accounts for each row execute function public.audit_row_change();
create trigger touch before update on public.transfers for each row execute function public.touch_row();
create trigger audit after insert or update or delete on public.transfers for each row execute function public.audit_row_change();

alter table public.accounts enable row level security;
create policy admin_all on public.accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
alter table public.transfers enable row level security;
create policy admin_all on public.transfers for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Kursnu listu upisuje samo Edge Function (service role); svi admini je čitaju
alter table public.fx_rates enable row level security;
create policy fx_read on public.fx_rates for select to authenticated using (public.is_admin());

grant select on public.account_balances to authenticated;
grant execute on function public.eur_rate_for(date) to authenticated;
