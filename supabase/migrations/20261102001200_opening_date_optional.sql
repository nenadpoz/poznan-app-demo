-- Početni datum računa nije obavezan: bez njega se u stanje broji sav promet (i unet unazad, npr. ulog od prošlog meseca).
-- Datum se zadaje samo uz početno stanje (Stanje računa → početno stanje od datuma).
alter table public.accounts alter column opening_date drop not null, alter column opening_date drop default;
update public.accounts set opening_date = null where opening_balance = 0;

create or replace view public.account_balances with (security_invoker = true) as
select
  a.id as account_id, a.kind, a.company_id, a.name, a.opening_balance,
  a.opening_balance
    + coalesce((select sum(case when t.type = 'prihod' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id and t.deleted_at is null and (a.opening_date is null or t.date >= a.opening_date)), 0)
    + coalesce((select sum(x.amount) from public.transfers x where x.to_account_id = a.id and x.deleted_at is null and (a.opening_date is null or x.date >= a.opening_date)), 0)
    - coalesce((select sum(x.amount) from public.transfers x where x.from_account_id = a.id and x.deleted_at is null and (a.opening_date is null or x.date >= a.opening_date)), 0)
    + coalesce((select sum(o.amount) from public.owner_contributions o where o.account_id = a.id and o.deleted_at is null and (a.opening_date is null or o.date >= a.opening_date)), 0)
    as balance,
  greatest(
    (select max(t.updated_at) from public.transactions t where t.account_id = a.id),
    (select max(x.updated_at) from public.transfers x where a.id in (x.from_account_id, x.to_account_id)),
    (select max(o.updated_at) from public.owner_contributions o where o.account_id = a.id),
    a.updated_at
  ) as changed_at
from public.accounts a
where a.deleted_at is null;
