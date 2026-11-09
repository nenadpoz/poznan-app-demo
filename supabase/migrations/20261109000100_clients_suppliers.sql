-- Saradnik je klijent sa oznakom (zahtev vlasnika 9. nov 2026.): od njega kupujemo ili radi uslugu za nas.
-- Klijent dobija oznaku `supplier` i polje `service` (šta radi ili prodaje). Postojeći saradnici prelaze u klijente
-- sa istim id-jem (slike i troškovi ostaju vezani), a tabela suppliers se više ne koristi (redovi se meko brišu).

alter table public.clients
  add column supplier boolean not null default false,
  add column service text;
create index on public.clients (supplier) where supplier and deleted_at is null;

-- Saradnici u klijente (isti id, isti podaci)
insert into public.clients (id, kind, name, pib, mb, contact_person, city, address, phone, email, note, supplier, service, created_at)
select id, kind, name, pib, mb, contact_person, city, address, phone, email, note, true, service, created_at
from public.suppliers
where deleted_at is null
on conflict (id) do nothing;

-- Slike saradnika postaju slike klijenta (isti id)
update public.photos set target_type = 'client'
where target_type = 'supplier' and target_id in (select id from public.clients where supplier);

-- Trošak kod saradnika: saradnik postaje klijent tog troška (ako trošak već nema klijenta)
update public.transactions set client_id = supplier_id
where supplier_id is not null and client_id is null and supplier_id in (select id from public.clients);

-- Stara tabela se ne koristi
update public.suppliers set deleted_at = now() where deleted_at is null;
