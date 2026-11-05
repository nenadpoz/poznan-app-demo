-- Saradnici: od koga se kupuje materijal ili traži usluga (dobavljači, majstori, prevoznici…).
-- Nezavisni od klijenata i firmi. Trošak (keš ili preko firme) može da se veže za saradnika.
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'fizicko' check (kind in ('fizicko', 'pravno')),
  name text not null check (length(trim(name)) > 0),
  -- šta radi ili prodaje, npr. „PVC cevi“, „Iskop bagerom“
  service text,
  pib text,
  mb text,
  contact_person text,
  city text,
  address text,
  phone text,
  email text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  deleted_at timestamptz,
  client_at timestamptz,
  check (kind = 'pravno' or (pib is null and mb is null))
);
create index on public.suppliers (name);

create trigger touch before update on public.suppliers for each row execute function public.touch_row();
create trigger audit after insert or update or delete on public.suppliers for each row execute function public.audit_row_change();
alter table public.suppliers enable row level security;
create policy admin_all on public.suppliers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Trošak kod saradnika (samo trošak, ne prihod)
alter table public.transactions add column supplier_id uuid references public.suppliers (id);
alter table public.transactions add constraint transactions_supplier_check check (supplier_id is null or type = 'trosak');
create index on public.transactions (supplier_id) where supplier_id is not null;
