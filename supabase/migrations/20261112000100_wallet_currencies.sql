-- Stanje novca po valutama (zahtev vlasnika 12. nov 2026.).
-- Svaki račun (firma, keš) vodi dinare, evre i dolare odvojeno, u iznosu kako je unet (17.400 EUR ostaje 17.400 EUR).
-- `amount` (dinari po kursu tog dana) ostaje za limite, PDV i profit. Ukupno stanje u dinarima (`balance`) je
-- zbir valuta po današnjem kursu. Trošak plaćen iz više valuta je više redova sa istim split_id (kao plaćanje iz više izvora).
-- Prenos može biti i zamena valute (npr. 100.000 RSD u 845 EUR), i na istom računu.

-- ---------- Početno stanje po valuti ----------
alter table public.accounts
  add column opening_eur numeric(14,2) not null default 0,
  add column opening_usd numeric(14,2) not null default 0;
comment on column public.accounts.opening_balance is 'Početno stanje u dinarima (RSD)';

-- ---------- Prenos: primljena valuta i iznos (zamena valute) ----------
alter table public.transfers
  add column to_currency text check (to_currency in ('RSD', 'EUR', 'USD')),
  add column to_amount_original numeric(14,2) check (to_amount_original > 0);
update public.transfers set to_currency = currency, to_amount_original = amount_original where to_currency is null;
alter table public.transfers alter column to_currency set not null, alter column to_amount_original set not null;

-- Isti račun je dozvoljen samo kad se menja valuta
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.transfers'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%from_account_id <> to_account_id%'
  loop
    execute format('alter table public.transfers drop constraint %I', c);
  end loop;
end $$;
alter table public.transfers add constraint transfers_account_or_currency
  check (from_account_id <> to_account_id or to_currency <> currency);

-- Bez zamene primljeno je isto što je dato; kod zamene primljeni iznos je obavezan
create or replace function public.transfer_to_side() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.to_currency := coalesce(new.to_currency, new.currency);
  if new.to_currency = new.currency then
    new.to_amount_original := new.amount_original;
  elsif new.to_amount_original is null then
    raise exception 'Upiši koliko je primljeno u %', new.to_currency using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger transfer_to_side before insert or update on public.transfers
  for each row execute function public.transfer_to_side();

-- ---------- Stanje računa po valutama ----------
-- rsd/eur/usd: stanje u svakoj valuti; balance: sve valute u dinarima po današnjem kursu.
create or replace view public.account_balances with (security_invoker = true) as
with moves as (
  select t.account_id, t.currency, t.date,
         case when t.type = 'prihod' then 1 else -1 end * coalesce(t.amount_original, t.amount) as amt
    from public.transactions t where t.deleted_at is null and t.account_id is not null
  union all
  select x.from_account_id, x.currency, x.date, -x.amount_original from public.transfers x where x.deleted_at is null
  union all
  select x.to_account_id, x.to_currency, x.date, x.to_amount_original from public.transfers x where x.deleted_at is null
  union all
  select o.account_id, o.currency, o.date, o.amount_original
    from public.owner_contributions o where o.deleted_at is null and o.account_id is not null
),
wallet as (
  select a.id,
    a.opening_balance + coalesce(sum(m.amt) filter (where m.currency = 'RSD'), 0) as rsd,
    a.opening_eur + coalesce(sum(m.amt) filter (where m.currency = 'EUR'), 0) as eur,
    a.opening_usd + coalesce(sum(m.amt) filter (where m.currency = 'USD'), 0) as usd
  from public.accounts a
  left join moves m on m.account_id = a.id and (a.opening_date is null or m.date >= a.opening_date)
  group by a.id
)
select
  a.id as account_id, a.kind, a.company_id, a.name, a.opening_balance,
  round(w.rsd + w.eur * coalesce(public.fx_rate_for('EUR', current_date), 0)
              + w.usd * coalesce(public.fx_rate_for('USD', current_date), 0), 2) as balance,
  greatest(
    (select max(t.updated_at) from public.transactions t where t.account_id = a.id),
    (select max(x.updated_at) from public.transfers x where a.id in (x.from_account_id, x.to_account_id)),
    (select max(o.updated_at) from public.owner_contributions o where o.account_id = a.id),
    a.updated_at
  ) as changed_at,
  w.rsd, w.eur, w.usd, a.opening_eur, a.opening_usd
from public.accounts a
join wallet w on w.id = a.id
where a.deleted_at is null;

grant select on public.account_balances to authenticated;
grant execute on function public.fx_rate_for(text, date) to authenticated;
