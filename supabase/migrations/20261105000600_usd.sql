-- Promet i u dolarima (USD), uz dinare i evre. Kurs je srednji kurs NBS kao za EUR, u istoj kursnoj listi.
-- `amount` ostaje u dinarima (limiti, zbirovi, stanje); originalni iznos, valuta i kurs tog dana se čuvaju.

-- ---------- Kursna lista ----------
alter table public.fx_rates add column usd numeric(10,4) check (usd > 0); -- 1 USD = x RSD

-- Postojeći dani (srednji kurs NBS, kurs.resenje.org)
update public.fx_rates f set usd = v.usd from (values
  ('2026-10-30'::date, 105.0560), ('2026-11-02'::date, 105.0793), ('2026-11-03'::date, 105.0012),
  ('2026-11-04'::date, 104.7020), ('2026-11-05'::date, 104.4050)
) as v(date, usd) where f.date = v.date and f.usd is null;

-- Kurs valute za dan: lista tog dana ili poslednja pre (vikend, praznik). RSD = 1.
create or replace function public.fx_rate_for(p_currency text, p_date date) returns numeric
language sql stable security definer set search_path = public as $$
  select case p_currency
    when 'RSD' then 1::numeric
    when 'EUR' then (select eur from public.fx_rates where date <= p_date order by date desc limit 1)
    when 'USD' then (select usd from public.fx_rates where date <= p_date and usd is not null order by date desc limit 1)
  end;
$$;

-- ---------- Dozvoljene valute ----------
alter table public.transactions drop constraint transactions_currency_check,
  add constraint transactions_currency_check check (currency in ('RSD', 'EUR', 'USD'));
alter table public.transfers drop constraint transfers_currency_check,
  add constraint transfers_currency_check check (currency in ('RSD', 'EUR', 'USD'));
alter table public.owner_contributions drop constraint owner_contributions_currency_check,
  add constraint owner_contributions_currency_check check (currency in ('RSD', 'EUR', 'USD'));
-- Valuta prikaza (lično)
alter table public.profiles drop constraint profiles_currency_check,
  add constraint profiles_currency_check check (currency in ('RSD', 'EUR', 'USD'));

-- ---------- Preračun u dinare ----------
-- Promet (isto kao 20261102001400, samo kurs po valuti)
create or replace function public.tx_account_currency() returns trigger
language plpgsql security definer set search_path = public as $$
declare a public.accounts;
begin
  if new.paid_by is not null then
    new.account_id := null;
    new.company_id := null;
  else
    if new.account_id is null then
      select * into a from public.accounts where deleted_at is null and
        (case when new.company_id is null then kind = 'cash' else company_id = new.company_id end);
    else
      select * into a from public.accounts where id = new.account_id;
    end if;
    if a.id is null then raise exception 'Račun ne postoji' using errcode = 'P0001'; end if;
    new.account_id := a.id;
    new.company_id := a.company_id;
  end if;

  new.amount_original := coalesce(new.amount_original, new.amount);
  if new.currency = 'RSD' then
    new.fx_rate := 1;
  elsif tg_op = 'INSERT' or new.fx_rate is null or new.date is distinct from old.date
        or new.amount_original is distinct from old.amount_original or new.currency is distinct from old.currency then
    -- Kurs se uzima pri unosu (i pri promeni datuma, iznosa ili valute), posle se ne menja
    new.fx_rate := coalesce(public.fx_rate_for(new.currency, new.date), case when tg_op = 'INSERT' or new.currency = old.currency then new.fx_rate end);
    if new.fx_rate is null then raise exception 'Nema kursa % za %', new.currency, new.date using errcode = 'P0001'; end if;
  end if;
  new.amount := round(new.amount_original * new.fx_rate, 2);
  if tg_op = 'UPDATE' then new.created_by := old.created_by; end if;
  return new;
end $$;

-- Prenos i ulog vlasnika (isti trigger)
create or replace function public.transfer_currency() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.currency = 'RSD' then
    new.fx_rate := 1;
  elsif tg_op = 'INSERT' or new.fx_rate is null or new.date is distinct from old.date
        or new.amount_original is distinct from old.amount_original or new.currency is distinct from old.currency then
    new.fx_rate := coalesce(public.fx_rate_for(new.currency, new.date), case when tg_op = 'INSERT' or new.currency = old.currency then new.fx_rate end);
    if new.fx_rate is null then raise exception 'Nema kursa % za %', new.currency, new.date using errcode = 'P0001'; end if;
  end if;
  new.amount := round(new.amount_original * new.fx_rate, 2);
  if tg_op = 'UPDATE' then new.created_by := old.created_by; end if;
  return new;
end $$;
