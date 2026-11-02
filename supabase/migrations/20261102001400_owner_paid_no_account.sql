-- Trošak koji je vlasnik platio iz svog novčanika nema račun ni firmu: novac nije izašao ni sa računa firme ni iz keša.
-- Ni ulog nastao uz takav trošak nema račun, pa stanje nijednog računa ne menja; trošak ulazi u ukupan profit,
-- ulog u plate i uloge. Ostali prometi i ulozi i dalje moraju imati račun.
alter table public.transactions
  alter column account_id drop not null,
  add constraint transactions_account_or_owner check (account_id is not null or paid_by is not null);
alter table public.owner_contributions
  alter column account_id drop not null,
  add constraint owner_contributions_account_or_tx check (account_id is not null or transaction_id is not null);

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
    new.fx_rate := coalesce(public.eur_rate_for(new.date), new.fx_rate);
    if new.fx_rate is null then raise exception 'Nema kursa EUR za %', new.date using errcode = 'P0001'; end if;
  end if;
  new.amount := round(new.amount_original * new.fx_rate, 2);
  if tg_op = 'UPDATE' then new.created_by := old.created_by; end if;
  return new;
end $$;

-- Postojeći troškovi koje je platio vlasnik: bez računa (trigger sync_owner_paid prenosi to i na ulog)
update public.transactions set account_id = null where paid_by is not null and account_id is not null;
