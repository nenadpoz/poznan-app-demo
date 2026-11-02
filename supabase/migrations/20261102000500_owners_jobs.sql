-- Plate i ulozi vlasnika, unos koji čeka klijenta, kalendar nad poslovima (bez termina).

-- ---------- Plata: trošak sa oznakom kome je isplaćena ----------
-- „Obojica“ su dva reda sa istim iznosom (sa računa se skida dvostruko).
alter table public.transactions
  add column salary_to text check (salary_to in ('nenad', 'jovan')),
  add column pending_client boolean not null default false, -- „podseti me kasnije“: klijent se dodaje naknadno
  add constraint transactions_salary_trosak check (salary_to is null or type = 'trosak');
create index on public.transactions (salary_to, date) where salary_to is not null;

-- Plata nema klijenta ni PDV; kad se klijent poveže, podsetnik se gasi
create or replace function public.tx_salary_client() returns trigger
language plpgsql as $$
begin
  if new.salary_to is not null then
    new.category := 'Plata';
    new.client_id := null;
    new.vat := 0;
    new.pending_client := false;
  end if;
  if new.client_id is not null then new.pending_client := false; end if;
  return new;
end $$;
create trigger tx_salary_client before insert or update on public.transactions
  for each row execute function public.tx_salary_client();

-- ---------- Ulog vlasnika (sopstveni novac u firmu ili keš) ----------
-- Nije prihod: ne ulazi u limite, PDV ni profit; samo povećava stanje računa.
create table public.owner_contributions (
  id uuid primary key default gen_random_uuid(),
  owner text not null check (owner in ('nenad', 'jovan')),
  account_id uuid not null references public.accounts (id),
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
  client_at timestamptz
);
create index on public.owner_contributions (date);
create index on public.owner_contributions (account_id, date);

-- Isti preračun kao kod prenosa: kurs tog dana, iznos u dinarima
create trigger contribution_currency before insert or update on public.owner_contributions
  for each row execute function public.transfer_currency();
create trigger touch before update on public.owner_contributions for each row execute function public.touch_row();
create trigger audit after insert or update or delete on public.owner_contributions for each row execute function public.audit_row_change();
alter table public.owner_contributions enable row level security;
create policy admin_all on public.owner_contributions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Stanje računa uključuje uloge ----------
create or replace view public.account_balances with (security_invoker = true) as
select
  a.id as account_id, a.kind, a.company_id, a.name, a.opening_balance,
  a.opening_balance
    + coalesce((select sum(case when t.type = 'prihod' then t.amount else -t.amount end)
                from public.transactions t where t.account_id = a.id and t.deleted_at is null and t.date >= a.opening_date), 0)
    + coalesce((select sum(x.amount) from public.transfers x where x.to_account_id = a.id and x.deleted_at is null and x.date >= a.opening_date), 0)
    - coalesce((select sum(x.amount) from public.transfers x where x.from_account_id = a.id and x.deleted_at is null and x.date >= a.opening_date), 0)
    + coalesce((select sum(o.amount) from public.owner_contributions o where o.account_id = a.id and o.deleted_at is null and o.date >= a.opening_date), 0)
    as balance,
  greatest(
    (select max(t.updated_at) from public.transactions t where t.account_id = a.id),
    (select max(x.updated_at) from public.transfers x where a.id in (x.from_account_id, x.to_account_id)),
    (select max(o.updated_at) from public.owner_contributions o where o.account_id = a.id),
    a.updated_at
  ) as changed_at
from public.accounts a
where a.deleted_at is null;

-- ---------- Kalendar prikazuje poslove; termini se ukidaju ----------
alter table public.jobs add column end_time time;
alter table public.jobs add constraint jobs_time_order check (end_time is null or start_time is null or end_time > start_time);
drop table public.appointments;
