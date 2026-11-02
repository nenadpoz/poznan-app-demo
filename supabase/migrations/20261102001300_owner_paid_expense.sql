-- Trošak koji vlasnik plati iz svog novčanika, i trošak plaćen iz više izvora (npr. Jovan 400 €, Nenad 500 €).
-- Svaki izvor je jedan red troška; redovi istog plaćanja imaju isti split_id.
-- Red koji je platio vlasnik (paid_by) vodi se na izabrani račun (keš ili firma), a baza za njega sama pravi
-- ulog tog vlasnika na isti račun: stanje računa se ne menja, trošak ulazi u profit, ulog u plate i uloge.
alter table public.transactions
  add column paid_by text check (paid_by in ('nenad', 'jovan')),
  add column split_id uuid,
  add constraint transactions_paid_by_trosak check (paid_by is null or type = 'trosak');
create index on public.transactions (split_id) where split_id is not null;

alter table public.owner_contributions
  add column transaction_id uuid unique references public.transactions (id);

-- Ulog prati trošak: nastaje, menja se i briše zajedno sa njim
create or replace function public.sync_owner_paid() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.paid_by is not null and new.type = 'trosak' and new.deleted_at is null then
    insert into public.owner_contributions
      (owner, account_id, amount, currency, amount_original, fx_rate, date, note, created_by, transaction_id)
    values
      (new.paid_by, new.account_id, new.amount, new.currency, new.amount_original, new.fx_rate, new.date,
       left('Plaćeno za: ' || coalesce(nullif(new.description, ''), new.category), 300), new.created_by, new.id)
    on conflict (transaction_id) do update set
      owner = excluded.owner, account_id = excluded.account_id, amount = excluded.amount, currency = excluded.currency,
      amount_original = excluded.amount_original, fx_rate = excluded.fx_rate, date = excluded.date, note = excluded.note,
      deleted_at = null;
  else
    update public.owner_contributions set deleted_at = now()
    where transaction_id = new.id and deleted_at is null;
  end if;
  return null;
end $$;
create trigger sync_owner_paid after insert or update on public.transactions
  for each row execute function public.sync_owner_paid();
